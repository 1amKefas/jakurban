using System.Data;
using System.Text.Json.Serialization;
using Katalog.Api.Data;
using Katalog.Api.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Batas maksimal ukuran request body (500 MB) untuk mengakomodasi unggahan Multi-Foto & Video Base64
const long MaxPayloadSizeBytes = 524_288_000;

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = MaxPayloadSizeBytes;
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = MaxPayloadSizeBytes;
});

// 1. Database Context (PostgreSQL + pgvector)
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseVector()
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

// 4. Registrasi HttpClient untuk layanan Embedding & Multi-Model RAG Chatbot (Gemini AI)
builder.Services.AddHttpClient<IEmbeddingService, OpenAiEmbeddingService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(35);
});

var app = builder.Build();

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
            INSERT INTO ""UserAccounts"" (""Id"", ""Name"", ""Email"", ""Password"", ""Phone"", ""Slug"", ""Role"", ""Title"", ""CreatedAt"")
            VALUES
                ('usr-super-1', 'Super Admin (Owner)', 'super@jakurban.com', '123', '6287819112003', 'owner', 'SUPER_ADMIN', 'Principal / Super Admin', '01 Okt 2026, 09:00'),
                ('usr-admin-1', 'Andi Pratama', 'admin@jakurban.com', '123', '6281298765432', 'andi-pratama', 'ADMIN', 'Senior Property Agent', '05 Okt 2026, 10:30')
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
app.UseAuthorization();

// Endpoint status utama
app.MapGet("/", () => Results.Ok(new
{
    status = "online",
    service = "JakUrban Catalog & RAG Chatbot API",
    endpoints = new[] { "/api/properties", "/api/chat", "/api/auth/accounts" }
}));

// Helper parameter SQL
static void AddParam(IDbCommand cmd, string name, object? value)
{
    var p = cmd.CreateParameter();
    p.ParameterName = name;
    p.Value = value ?? DBNull.Value;
    cmd.Parameters.Add(p);
}

// GET: /api/auth/accounts (Sinkronisasi daftar akun di semua browser)
app.MapGet("/api/auth/accounts", async (ApplicationDbContext db) =>
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
});

// POST: /api/auth/login (Skema Last-In Wins: Login baru selalu diizinkan & otomatis menggugurkan sesi perangkat lama)
app.MapPost("/api/auth/login", async (ApplicationDbContext db, AuthLoginDto req) =>
{
    var cleanEmail = (req.Email ?? "").Trim().ToLowerInvariant();
    var cleanPass = (req.Password ?? "").Trim();

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

    // Selalu buat token sesi baru untuk menimpa sesi lama (Last-In Wins)
    var newSessionToken = Guid.NewGuid().ToString("N");

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
});

// POST: /api/auth/heartbeat (Menjaga sesi tetap aktif selama tab terbuka)
app.MapPost("/api/auth/heartbeat", async (ApplicationDbContext db, AuthSessionDto req) =>
{
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.SessionToken))
        return Results.Unauthorized();

    var conn = db.Database.GetDbConnection();
    if (conn.State != ConnectionState.Open) await conn.OpenAsync();

    using var cmd = conn.CreateCommand();
    cmd.CommandText = @"
        UPDATE ""UserAccounts""
        SET ""LastActiveAt"" = @now
        WHERE LOWER(""Email"") = @email AND ""ActiveSessionToken"" = @token;";
    AddParam(cmd, "@now", DateTime.UtcNow);
    AddParam(cmd, "@email", req.Email.Trim().ToLowerInvariant());
    AddParam(cmd, "@token", req.SessionToken);

    var affected = await cmd.ExecuteNonQueryAsync();
    return affected > 0 ? Results.Ok(new { active = true }) : Results.Unauthorized();
});

// POST: /api/auth/logout (Melepas kunci sesi saat user keluar atau menutup tab)
app.MapPost("/api/auth/logout", async (ApplicationDbContext db, AuthSessionDto req) =>
{
    if (string.IsNullOrWhiteSpace(req.Email)) return Results.Ok();

    var conn = db.Database.GetDbConnection();
    if (conn.State != ConnectionState.Open) await conn.OpenAsync();

    using var cmd = conn.CreateCommand();
    cmd.CommandText = @"
        UPDATE ""UserAccounts""
        SET ""ActiveSessionToken"" = NULL, ""LastActiveAt"" = NULL
        WHERE LOWER(""Email"") = @email AND (""ActiveSessionToken"" = @token OR @token IS NULL OR @token = '');";
    AddParam(cmd, "@email", req.Email.Trim().ToLowerInvariant());
    AddParam(cmd, "@token", req.SessionToken ?? "");
    await cmd.ExecuteNonQueryAsync();

    return Results.Ok(new { loggedOut = true });
});

// POST: /api/auth/accounts (Tambah / Update akun oleh Super Admin)
app.MapPost("/api/auth/accounts", async (ApplicationDbContext db, UserAccountDto acc) =>
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
});

// DELETE: /api/auth/accounts/{id}
app.MapDelete("/api/auth/accounts/{id}", async (ApplicationDbContext db, string id) =>
{
    var conn = db.Database.GetDbConnection();
    if (conn.State != ConnectionState.Open) await conn.OpenAsync();

    using var cmd = conn.CreateCommand();
    cmd.CommandText = @"DELETE FROM ""UserAccounts"" WHERE ""Id"" = @id;";
    AddParam(cmd, "@id", id);
    await cmd.ExecuteNonQueryAsync();
    return Results.NoContent();
});

app.MapControllers();

app.Run();

public record AuthLoginDto(string Email, string Password, string? SessionToken);
public record AuthSessionDto(string Email, string? SessionToken);
public record UserAccountDto(string Id, string Name, string Email, string Password, string? Phone, string? Slug, string Role, string? Title, string? CreatedAt);