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
        policy.SetIsOriginAllowed(origin =>
                  origin.StartsWith("http://localhost:") ||
                  origin.StartsWith("http://127.0.0.1:") ||
                  origin.EndsWith(".vercel.app"))
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
                ""Photos"" text[] NOT NULL DEFAULT '{}',
                ""Videos"" text[] NOT NULL DEFAULT '{}'
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
                ""Photos"" text[] NOT NULL DEFAULT '{}',
                ""Videos"" text[] NOT NULL DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS ""DocumentChunks"" (
                ""Id"" uuid PRIMARY KEY,
                ""PropertyId"" uuid NOT NULL REFERENCES ""Properties""(""Id"") ON DELETE CASCADE,
                ""Content"" text NOT NULL DEFAULT '',
                ""Source"" text NOT NULL DEFAULT '',
                ""Embedding"" vector(1536),
                ""CreatedAt"" timestamp with time zone NOT NULL
            );
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
app.MapControllers();

app.Run();