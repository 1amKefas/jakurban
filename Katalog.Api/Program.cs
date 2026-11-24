using System.Collections.Concurrent;
using System.Data;
using System.Text.Json.Serialization;
using Katalog.Api.Data;
using Katalog.Api.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

var builder = WebApplication.CreateBuilder(args);

const long MaxPayloadSizeBytes = 524_288_000;

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = MaxPayloadSizeBytes;
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = MaxPayloadSizeBytes;
});

// 1. Database Context (PostgreSQL + pgvector) dengan Timeout & KeepAlive yang tahan gangguan jaringan
var rawConnStr = builder.Configuration.GetConnectionString("DefaultConnection") ?? "";
var connStringBuilder = new NpgsqlConnectionStringBuilder(rawConnStr)
{
    Timeout = 30,
    CommandTimeout = 30,
    KeepAlive = 30,
    Pooling = true,
    MinPoolSize = 1,
    MaxPoolSize = 20
};

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        connStringBuilder.ConnectionString,
        o =>
        {
            o.UseVector();
            o.CommandTimeout(30);
            o.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
        }
    ));

// 2. Registrasi CORS untuk Frontend Solid.js (Vite)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// 3. Controllers + IgnoreCycles
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 4. Registrasi HttpClient untuk layanan Embedding & RAG Chatbot (Gemini AI)
builder.Services.AddHttpClient<IEmbeddingService, OpenAiEmbeddingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(90);
});

// 5. MemoryCache (untuk sesi chat dengan TTL agar bebas memory leak)
builder.Services.AddMemoryCache();

// 6. Rate Limiter khusus endpoint Chatbot (anti-spam & pengaman kuota token)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await context.HttpContext.Response.WriteAsync(
            "{\"reply\":\"Permintaan Anda terlalu cepat. Mohon tunggu sebentar sebelum mengirim pesan berikutnya.\"}",
            ct);
    };

    options.AddPolicy("chat-limit", httpContext =>
    {
        var clientIp =
            httpContext.Request.Headers["CF-Connecting-IP"].FirstOrDefault()
            ?? httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 8,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });
});

var app = builder.Build();

// Cache sesi login di RAM agar /api/auth/heartbeat instan (0ms) dan tidak membebani database Neon setiap 5 detik
var activeSessionCache = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);

// Auto-inisialisasi ekstensi pgvector & skema tabel pada database Cloud (Neon.tech)
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Database.ExecuteSqlRaw("CREATE EXTENSION IF NOT EXISTS vector;");
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""Projects"" (
                ""Id"" uuid PRIMARY KEY,
                ""Name"" text NOT NULL,
                ""Location"" text NOT NULL DEFAULT '',
                ""Description"" text NOT NULL DEFAULT '',
                ""CreatedAt"" timestamp with time zone NOT NULL,
                ""Photos"" text[] NOT NULL DEFAULT ARRAY[]::text[],
                ""Videos"" text[] NOT NULL DEFAULT ARRAY[]::text[]
            );
            CREATE TABLE IF NOT EXISTS ""Properties"" (
                ""Id"" uuid PRIMARY KEY,
                ""ProjectId"" uuid NOT NULL REFERENCES ""Projects""(""Id"") ON DELETE CASCADE,
                ""UnitCode"" text NOT NULL DEFAULT '',
                ""Title"" text NOT NULL DEFAULT '',
                ""Price"" numeric NOT NULL DEFAULT 0,
                ""Status"" text NOT NULL DEFAULT 'Tersedia',
                ""Description"" text NOT NULL DEFAULT '',
                ""LandArea"" text NOT NULL DEFAULT '',
                ""BuildArea"" text NOT NULL DEFAULT '',
                ""Beds"" integer NOT NULL DEFAULT 0,
                ""Baths"" integer NOT NULL DEFAULT 0,
                ""CreatedAt"" timestamp with time zone NOT NULL,
                ""Photos"" text[] NOT NULL DEFAULT ARRAY[]::text[],
                ""Videos"" text[] NOT NULL DEFAULT ARRAY[]::text[]
            );
            CREATE TABLE IF NOT EXISTS ""DocumentChunks"" (
                ""Id"" uuid PRIMARY KEY,
                ""PropertyId"" uuid NOT NULL REFERENCES ""Properties""(""Id"") ON DELETE CASCADE,
                ""Content"" text NOT NULL DEFAULT '',
                ""Source"" text NOT NULL DEFAULT '',
                ""Embedding"" vector(1536),
                ""CreatedAt"" timestamp with time zone NOT NULL
            );
            CREATE TABLE IF NOT EXISTS ""UserAccounts"" (
                ""Id"" text PRIMARY KEY,
                ""Name"" text NOT NULL,
                ""Email"" text NOT NULL UNIQUE,
                ""Password"" text NOT NULL,
                ""Phone"" text NOT NULL DEFAULT '',
                ""Slug"" text NOT NULL DEFAULT '',
                ""Role"" text NOT NULL DEFAULT 'ADMIN',
                ""Title"" text NOT NULL DEFAULT 'Property Agent',
                ""CreatedAt"" text NOT NULL DEFAULT '',
                ""ActiveSessionToken"" text,
                ""LastActiveAt"" timestamp with time zone
            );

            CREATE TABLE IF NOT EXISTS ""KnowledgeDocuments"" (
                ""Id"" text PRIMARY KEY,
                ""Title"" text NOT NULL,
                ""Category"" text NOT NULL DEFAULT 'SOP / Umum',
                ""FileName"" text NOT NULL DEFAULT '',
                ""Content"" text NOT NULL DEFAULT '',
                ""CreatedAt"" text NOT NULL DEFAULT ''
            );
            
            CREATE TABLE IF NOT EXISTS ""SiteConfigs"" (
                ""Key"" text PRIMARY KEY,
                ""ConfigJson"" text NOT NULL DEFAULT '{}',
                ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
            );

            INSERT INTO ""UserAccounts"" (""Id"", ""Name"", ""Email"", ""Password"", ""Phone"", ""Slug"", ""Role"", ""Title"", ""CreatedAt"")
            VALUES
                ('usr-super-1', 'Super Admin (Owner)', 'super@jakurban.com', '123', '6287819112003', 'owner', 'SUPER_ADMIN', 'Principal / Super Admin', '01 Okt 2026, 09:00'),
                ('usr-admin-1', 'Andi Pratama', 'admin@jakurban.com', '123', '6281298765432', 'andi-pratama', 'ADMIN', 'Senior Property Agent', '05 Okt 2026, 09:30')
            ON CONFLICT (""Email"") DO NOTHING;
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup DB Check]: {ex.Message}");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseCors("AllowFrontend");
app.UseRateLimiter();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    status = "online",
    service = "JakUrban Catalog & RAG Chatbot API",
    endpoints = new[] { "/api/properties", "/api/chat", "/api/auth/accounts" }
}));

static void AddParam(IDbCommand cmd, string name, object? value)
{
    var p = cmd.CreateParameter();
    p.ParameterName = name;
    p.Value = value ?? DBNull.Value;
    cmd.Parameters.Add(p);
}

// GET: /api/auth/accounts
app.MapGet("/api/auth/accounts", async (ApplicationDbContext db) =>
{
    try
    {
        var list = new List<object>();
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT ""Id"", ""Name"", ""Email"", ""Password"", ""Phone"", ""Slug"", ""Role"", ""Title"", ""CreatedAt"" FROM ""UserAccounts"" ORDER BY ""CreatedAt"" ASC;";
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(new
            {
                id = reader.GetString(0),
                name = reader.GetString(1),
                email = reader.GetString(2),
                password = reader.GetString(3),
                phone = reader.IsDBNull(4) ? "" : reader.GetString(4),
                slug = reader.IsDBNull(5) ? "" : reader.GetString(5),
                role = reader.GetString(6),
                title = reader.IsDBNull(7) ? "" : reader.GetString(7),
                createdAt = reader.IsDBNull(8) ? "" : reader.GetString(8)
            });
        }
        return Results.Ok(list);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[GET /api/auth/accounts Warning]: {ex.Message}");
        return Results.Ok(Array.Empty<object>());
    }
});

// POST: /api/auth/login (Last-In Wins)
app.MapPost("/api/auth/login", async (ApplicationDbContext db, AuthLoginDto req) =>
{
    var cleanEmail = (req.Email ?? "").Trim().ToLowerInvariant();
    var cleanPass = (req.Password ?? "").Trim();

    try
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT ""Id"", ""Name"", ""Email"", ""Password"", ""Phone"", ""Slug"", ""Role"", ""Title"", ""CreatedAt""
            FROM ""UserAccounts""
            WHERE LOWER(""Email"") = @email AND ""Password"" = @pass
            LIMIT 1;";
        AddParam(cmd, "@email", cleanEmail);
        AddParam(cmd, "@pass", cleanPass);

        using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return Results.Json(new { message = "Kredensial tidak valid. Pastikan email dan password sesuai dengan yang terdaftar." }, statusCode: 401);
        }

        var id = reader.GetString(0);
        var name = reader.GetString(1);
        var email = reader.GetString(2);
        var password = reader.GetString(3);
        var phone = reader.IsDBNull(4) ? "" : reader.GetString(4);
        var slug = reader.IsDBNull(5) ? "" : reader.GetString(5);
        var role = reader.GetString(6);
        var title = reader.IsDBNull(7) ? "" : reader.GetString(7);
        var createdAt = reader.IsDBNull(8) ? "" : reader.GetString(8);
        await reader.CloseAsync();

        var newSessionToken = Guid.NewGuid().ToString("N");
        activeSessionCache[cleanEmail] = newSessionToken;

        using var updateCmd = conn.CreateCommand();
        updateCmd.CommandText = @"UPDATE ""UserAccounts"" SET ""ActiveSessionToken"" = @token, ""LastActiveAt"" = @now WHERE ""Id"" = @id;";
        AddParam(updateCmd, "@token", newSessionToken);
        AddParam(updateCmd, "@now", DateTime.UtcNow);
        AddParam(updateCmd, "@id", id);
        await updateCmd.ExecuteNonQueryAsync();

        return Results.Ok(new
        {
            id,
            name,
            email,
            password,
            phone,
            slug,
            role,
            title,
            createdAt,
            sessionToken = newSessionToken
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[POST /api/auth/login DB Timeout]: {ex.Message}");
        return Results.StatusCode(503);
    }
});

// POST: /api/auth/heartbeat (Cek dari RAM terlebih dahulu agar instan & bebas timeout DB)
app.MapPost("/api/auth/heartbeat", async (ApplicationDbContext db, AuthSessionDto req) =>
{
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.SessionToken))
        return Results.Unauthorized();

    var cleanEmail = req.Email.Trim().ToLowerInvariant();

    // 1. Jika email sudah ada di cache RAM, verifikasi langsung dalam < 0.1ms tanpa kueri DB!
    if (activeSessionCache.TryGetValue(cleanEmail, out var cachedToken))
    {
        return string.Equals(cachedToken, req.SessionToken, StringComparison.Ordinal)
            ? Results.Ok(new { active = true })
            : Results.Unauthorized();
    }

    // 2. Jika server baru restart (cache kosong), cek ke DB dengan pengaman try-catch
    try
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT ""ActiveSessionToken""
            FROM ""UserAccounts""
            WHERE LOWER(""Email"") = @email
            LIMIT 1;";
        AddParam(cmd, "@email", cleanEmail);

        var dbToken = (await cmd.ExecuteScalarAsync())?.ToString();
        if (!string.IsNullOrWhiteSpace(dbToken))
        {
            activeSessionCache[cleanEmail] = dbToken!;
            return string.Equals(dbToken, req.SessionToken, StringComparison.Ordinal)
                ? Results.Ok(new { active = true })
                : Results.Unauthorized();
        }
        return Results.Unauthorized();
    }
    catch (Exception ex)
    {
        // Jangan crash atau menendang user keluar jika koneksi ke Neon sedang timeout sesaat
        Console.WriteLine($"[Heartbeat DB Transient Timeout Ignored]: {ex.Message}");
        return Results.Ok(new { active = true, transientOffline = true });
    }
});

// POST: /api/auth/logout
app.MapPost("/api/auth/logout", async (ApplicationDbContext db, AuthSessionDto req) =>
{
    if (string.IsNullOrWhiteSpace(req.Email)) return Results.Ok();
    var cleanEmail = req.Email.Trim().ToLowerInvariant();

    if (activeSessionCache.TryGetValue(cleanEmail, out var cachedToken) &&
        (string.IsNullOrWhiteSpace(req.SessionToken) || cachedToken == req.SessionToken))
    {
        activeSessionCache.TryRemove(cleanEmail, out _);
    }

    try
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE ""UserAccounts""
            SET ""ActiveSessionToken"" = NULL, ""LastActiveAt"" = NULL
            WHERE LOWER(""Email"") = @email AND (""ActiveSessionToken"" = @token OR @token IS NULL OR @token = '');";
        AddParam(cmd, "@email", cleanEmail);
        AddParam(cmd, "@token", req.SessionToken ?? "");
        await cmd.ExecuteNonQueryAsync();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Logout DB Warning]: {ex.Message}");
    }

    return Results.Ok(new { loggedOut = true });
});

// POST: /api/auth/accounts
app.MapPost("/api/auth/accounts", async (ApplicationDbContext db, UserAccountDto acc) =>
{
    try
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO ""UserAccounts"" (""Id"", ""Name"", ""Email"", ""Password"", ""Phone"", ""Slug"", ""Role"", ""Title"", ""CreatedAt"")
            VALUES (@id, @name, @email, @pass, @phone, @slug, @role, @title, @createdAt)
            ON CONFLICT (""Id"") DO UPDATE SET
                ""Name"" = EXCLUDED.""Name"",
                ""Email"" = EXCLUDED.""Email"",
                ""Password"" = EXCLUDED.""Password"",
                ""Phone"" = EXCLUDED.""Phone"",
                ""Slug"" = EXCLUDED.""Slug"",
                ""Role"" = EXCLUDED.""Role"",
                ""Title"" = EXCLUDED.""Title"";";
        AddParam(cmd, "@id", string.IsNullOrWhiteSpace(acc.Id) ? $"usr-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}" : acc.Id);
        AddParam(cmd, "@name", acc.Name ?? "");
        AddParam(cmd, "@email", (acc.Email ?? "").Trim().ToLowerInvariant());
        AddParam(cmd, "@pass", acc.Password ?? "");
        AddParam(cmd, "@phone", acc.Phone ?? "");
        AddParam(cmd, "@slug", acc.Slug ?? "");
        AddParam(cmd, "@role", acc.Role ?? "ADMIN");
        AddParam(cmd, "@title", acc.Title ?? "Property Agent");
        AddParam(cmd, "@createdAt", acc.CreatedAt ?? "");
        await cmd.ExecuteNonQueryAsync();

        return Results.Ok(acc);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[POST /api/auth/accounts Warning]: {ex.Message}");
        return Results.Ok(acc);
    }
});

// DELETE: /api/auth/accounts/{id}
app.MapDelete("/api/auth/accounts/{id}", async (ApplicationDbContext db, string id) =>
{
    try
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"DELETE FROM ""UserAccounts"" WHERE ""Id"" = @id;";
        AddParam(cmd, "@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DELETE /api/auth/accounts Warning]: {ex.Message}");
    }
    return Results.NoContent();
});

const string SiteConfigCacheKey = "jakurban_site_config_homepage";

// GET: /api/site-config (Cek RAM cache dulu agar instan & hemat kuota Neon)
app.MapGet("/api/site-config", async (ApplicationDbContext db, IMemoryCache cache) =>
{
    if (cache.TryGetValue(SiteConfigCacheKey, out string? cachedJson) && !string.IsNullOrWhiteSpace(cachedJson))
    {
        return Results.Content(cachedJson, "application/json; charset=utf-8");
    }

    try
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT ""ConfigJson"" FROM ""SiteConfigs"" WHERE ""Key"" = 'homepage' LIMIT 1;";
        var rawJson = (await cmd.ExecuteScalarAsync())?.ToString();

        var resolvedJson = string.IsNullOrWhiteSpace(rawJson) ? "null" : rawJson!;
        cache.Set(SiteConfigCacheKey, resolvedJson, TimeSpan.FromHours(6));

        return Results.Content(resolvedJson, "application/json; charset=utf-8");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[GET /api/site-config Warning]: {ex.Message}");
        return Results.Content("null", "application/json; charset=utf-8");
    }
});

// PUT: /api/site-config (Simpan konfigurasi Homepage & Billboard dari Super Admin ke PostgreSQL + perbarui cache RAM)
app.MapPut("/api/site-config", async (ApplicationDbContext db, IMemoryCache cache, JsonElement payload) =>
{
    if (payload.ValueKind != JsonValueKind.Object)
    {
        return Results.BadRequest(new { message = "Payload konfigurasi homepage harus berupa objek JSON." });
    }

    var jsonStr = payload.GetRawText();

    try
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO ""SiteConfigs"" (""Key"", ""ConfigJson"", ""UpdatedAt"")
            VALUES ('homepage', @json, @now)
            ON CONFLICT (""Key"") DO UPDATE SET
                ""ConfigJson"" = EXCLUDED.""ConfigJson"",
                ""UpdatedAt"" = EXCLUDED.""UpdatedAt"";";
        AddParam(cmd, "@json", jsonStr);
        AddParam(cmd, "@now", DateTime.UtcNow);
        await cmd.ExecuteNonQueryAsync();

        cache.Set(SiteConfigCacheKey, jsonStr, TimeSpan.FromHours(6));
        return Results.Content(jsonStr, "application/json; charset=utf-8");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[PUT /api/site-config Error]: {ex.Message}");
        return Results.Json(new { message = "Gagal menyimpan konfigurasi homepage ke database." }, statusCode: 503);
    }
});

app.MapControllers();

app.Run();

public record AuthLoginDto(string Email, string Password, string? SessionToken);
public record AuthSessionDto(string Email, string? SessionToken);
public record UserAccountDto(
    string Id = "",
    string Name = "",
    string Email = "",
    string Password = "",
    string? Phone = "",
    string? Slug = "",
    string Role = "ADMIN",
    string? Title = "Property Agent",
    string? CreatedAt = ""
);