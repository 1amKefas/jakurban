using System.Data;
using System.Text.RegularExpressions;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Katalog.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Katalog.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MediaController> _logger;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".webp", ".jpg", ".jpeg", ".png"
    };

    public MediaController(
        ApplicationDbContext context,
        IConfiguration configuration,
        ILogger<MediaController> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    private (AmazonS3Client Client, string BucketName, string PublicBaseUrl)? CreateR2Client()
    {
        var accountId = _configuration["CloudflareR2:AccountId"]?.Trim();
        var accessKey = _configuration["CloudflareR2:AccessKeyId"]?.Trim();
        var secretKey = _configuration["CloudflareR2:SecretAccessKey"]?.Trim();
        var bucketName = _configuration["CloudflareR2:BucketName"]?.Trim() ?? "jakhome-media";
        var publicBaseUrl = _configuration["CloudflareR2:PublicBaseUrl"]?.Trim().TrimEnd('/');

        if (string.IsNullOrWhiteSpace(accountId) ||
            string.IsNullOrWhiteSpace(accessKey) ||
            string.IsNullOrWhiteSpace(secretKey) ||
            string.IsNullOrWhiteSpace(publicBaseUrl))
        {
            return null;
        }

        var credentials = new BasicAWSCredentials(accessKey, secretKey);
        var s3Config = new AmazonS3Config
        {
            ServiceURL = $"https://{accountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true
        };

        return (new AmazonS3Client(credentials, s3Config), bucketName, publicBaseUrl);
    }

    private static async Task<string> UploadStreamToR2Async(
        AmazonS3Client s3Client,
        string bucketName,
        string publicBaseUrl,
        Stream stream,
        string extension,
        string contentType,
        CancellationToken ct)
    {
        var objectKey = $"properties/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var putRequest = new PutObjectRequest
        {
            BucketName = bucketName,
            Key = objectKey,
            InputStream = stream,
            ContentType = contentType,
            DisablePayloadSigning = true,
            DisableDefaultChecksumValidation = true
        };
        putRequest.Headers.CacheControl = "public, max-age=31536000, immutable";

        await s3Client.PutObjectAsync(putRequest, ct);
        return $"{publicBaseUrl}/{objectKey}";
    }

    [HttpPost("upload")]
    [RequestSizeLimit(10_485_760)]
    public async Task<IActionResult> UploadImage(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "File gambar tidak ditemukan." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "Ukuran foto maksimal 5 MB." });

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            return BadRequest(new { message = "Format file harus .webp, .jpg, .jpeg, atau .png." });

        var r2 = CreateR2Client();
        if (r2 == null)
            return StatusCode(500, new { message = "Konfigurasi Cloudflare R2 belum lengkap di server." });

        try
        {
            using var s3Client = r2.Value.Client;
            await using var stream = file.OpenReadStream();
            var url = await UploadStreamToR2Async(
                s3Client,
                r2.Value.BucketName,
                r2.Value.PublicBaseUrl,
                stream,
                ext,
                file.ContentType ?? "image/webp",
                ct);

            return Ok(new { url });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gagal upload foto ke Cloudflare R2.");
            return StatusCode(500, new { message = "Gagal mengunggah foto ke penyimpanan CDN." });
        }
    }

    /// <summary>
    /// Memigrasikan seluruh foto Base64 lama di tabel Projects dan Properties ke Cloudflare R2.
    /// </summary>
    [HttpPost("migrate-base64")]
    public async Task<IActionResult> MigrateLegacyBase64Photos(CancellationToken ct)
    {
        var r2 = CreateR2Client();
        if (r2 == null)
            return StatusCode(500, new { message = "Konfigurasi Cloudflare R2 belum lengkap di server." });

        using var s3Client = r2.Value.Client;
        var uploadedMap = new Dictionary<string, string>(StringComparer.Ordinal);
        int migratedCount = 0;

        async Task<string[]> ConvertArrayAsync(string[] items)
        {
            var result = new string[items.Length];
            for (int i = 0; i < items.Length; i++)
            {
                var raw = items[i] ?? "";
                if (!raw.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                {
                    result[i] = raw;
                    continue;
                }

                if (uploadedMap.TryGetValue(raw, out var existingUrl))
                {
                    result[i] = existingUrl;
                    continue;
                }

                var match = Regex.Match(raw, @"^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$");
                if (!match.Success)
                {
                    result[i] = raw;
                    continue;
                }

                var mime = match.Groups[1].Value.ToLowerInvariant();
                var ext = mime switch
                {
                    "image/webp" => ".webp",
                    "image/png" => ".png",
                    _ => ".jpg"
                };

                var bytes = Convert.FromBase64String(match.Groups[2].Value);
                await using var ms = new MemoryStream(bytes);
                var r2Url = await UploadStreamToR2Async(
                    s3Client,
                    r2.Value.BucketName,
                    r2.Value.PublicBaseUrl,
                    ms,
                    ext,
                    mime,
                    ct);

                uploadedMap[raw] = r2Url;
                result[i] = r2Url;
                migratedCount++;
            }
            return result;
        }

        var conn = (NpgsqlConnection)_context.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        // 1. Migrasi kolom Photos pada tabel Projects
        var projectUpdates = new List<(Guid Id, string[] Photos)>();
        await using (var readProj = new NpgsqlCommand(@"SELECT ""Id"", ""Photos"" FROM ""Projects"";", conn))
        await using (var reader = await readProj.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetGuid(0);
                var photos = reader.IsDBNull(1) ? Array.Empty<string>() : reader.GetFieldValue<string[]>(1);
                if (photos.Any(p => p.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase)))
                {
                    projectUpdates.Add((id, await ConvertArrayAsync(photos)));
                }
            }
        }

        foreach (var item in projectUpdates)
        {
            await using var upd = new NpgsqlCommand(@"UPDATE ""Projects"" SET ""Photos"" = @photos WHERE ""Id"" = @id;", conn);
            upd.Parameters.AddWithValue("@photos", item.Photos);
            upd.Parameters.AddWithValue("@id", item.Id);
            await upd.ExecuteNonQueryAsync(ct);
        }

        // 2. Migrasi kolom Photos pada tabel Properties (Unit)
        var unitUpdates = new List<(Guid Id, string[] Photos)>();
        await using (var readUnits = new NpgsqlCommand(@"SELECT ""Id"", ""Photos"" FROM ""Properties"";", conn))
        await using (var reader = await readUnits.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetGuid(0);
                var photos = reader.IsDBNull(1) ? Array.Empty<string>() : reader.GetFieldValue<string[]>(1);
                if (photos.Any(p => p.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase)))
                {
                    unitUpdates.Add((id, await ConvertArrayAsync(photos)));
                }
            }
        }

        foreach (var item in unitUpdates)
        {
            await using var upd = new NpgsqlCommand(@"UPDATE ""Properties"" SET ""Photos"" = @photos WHERE ""Id"" = @id;", conn);
            upd.Parameters.AddWithValue("@photos", item.Photos);
            upd.Parameters.AddWithValue("@id", item.Id);
            await upd.ExecuteNonQueryAsync(ct);
        }

        ChatController.InvalidateProjectCache();

        return Ok(new
        {
            migratedUniqueFiles = migratedCount,
            updatedProjects = projectUpdates.Count,
            updatedUnits = unitUpdates.Count
        });
    }
}