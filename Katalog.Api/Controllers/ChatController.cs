using System.Data;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Katalog.Api.Data;
using Katalog.Api.Models;
using Katalog.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Katalog.Api.Controllers;

public class ChatRequestDto
{
    public Guid? SessionId { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ChatHistoryItemDto
{
    public long Id { get; set; }
    public string Sender { get; set; } = "bot";
    public string Text { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public List<object> Recommendations { get; set; } = new();
}

public class KnowledgeDocDto
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = "SOP / Umum";
    public string FileName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = DateTime.Now.ToString("dd MMM yyyy, HH:mm");
    public float[]? Embedding { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IEmbeddingService _embeddingService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ChatController> _logger;

    private static long _totalSessionsCreated = 0;
    private static long _totalMessagesProcessed = 0;

    private static readonly JsonSerializerOptions SseJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    // Cache daftar Project & Unit (tanpa foto/video) di RAM agar pengambilan konteks instan
    private static List<Project>? _cachedProjects;
    private static DateTime _projectsCacheExpiry = DateTime.MinValue;
    private static readonly SemaphoreSlim _projectCacheLock = new(1, 1);

    // Cache Knowledge Base dari PostgreSQL di RAM selama 60 detik
    private static List<KnowledgeDocDto>? _cachedKbDocs;
    private static DateTime _kbCacheExpiry = DateTime.MinValue;
    private static readonly SemaphoreSlim _kbCacheLock = new(1, 1);

    public ChatController(
        ApplicationDbContext context,
        IEmbeddingService embeddingService,
        IMemoryCache cache,
        ILogger<ChatController> logger)
    {
        _context = context;
        _embeddingService = embeddingService;
        _cache = cache;
        _logger = logger;
    }

    public static void InvalidateProjectCache() => _projectsCacheExpiry = DateTime.MinValue;
    private static void InvalidateKbCache() => _kbCacheExpiry = DateTime.MinValue;

    private static string SessionCacheKey(Guid sessionId) => $"chat_session:{sessionId:N}";

    private List<ChatHistoryItemDto> GetOrCreateSessionHistory(Guid sessionId)
    {
        var key = SessionCacheKey(sessionId);
        if (_cache.TryGetValue(key, out List<ChatHistoryItemDto>? existing) && existing != null)
            return existing;

        var created = new List<ChatHistoryItemDto>();
        _cache.Set(key, created, new MemoryCacheEntryOptions
        {
            SlidingExpiration = TimeSpan.FromHours(2),
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(6)
        });
        Interlocked.Increment(ref _totalSessionsCreated);
        return created;
    }

    private static void AppendMessageBounded(List<ChatHistoryItemDto> history, ChatHistoryItemDto item)
    {
        history.Add(item);
        const int maxMessagesPerSession = 24;
        if (history.Count > maxMessagesPerSession)
        {
            history.RemoveRange(0, history.Count - maxMessagesPerSession);
        }
        Interlocked.Increment(ref _totalMessagesProcessed);
    }

    private static void AddDbParam(IDbCommand cmd, string name, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }

    private async Task<List<Project>> GetProjectsFastAsync()
    {
        if (_cachedProjects != null && DateTime.UtcNow < _projectsCacheExpiry)
            return _cachedProjects;

        await _projectCacheLock.WaitAsync();
        try
        {
            if (_cachedProjects != null && DateTime.UtcNow < _projectsCacheExpiry)
                return _cachedProjects;

            var freshProjects = await _context.Projects
                .AsNoTracking()
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new Project
                {
                    Id = p.Id,
                    Name = p.Name,
                    Location = p.Location,
                    Description = p.Description,
                    CreatedAt = p.CreatedAt,
                    Properties = p.Properties.Select(u => new Property
                    {
                        Id = u.Id,
                        ProjectId = u.ProjectId,
                        UnitCode = u.UnitCode,
                        Title = u.Title,
                        Price = u.Price,
                        Status = u.Status,
                        Description = u.Description,
                        LandArea = u.LandArea,
                        BuildArea = u.BuildArea,
                        Beds = u.Beds,
                        Baths = u.Baths,
                        CreatedAt = u.CreatedAt
                    }).ToList()
                })
                .ToListAsync();

            _cachedProjects = freshProjects;
            _projectsCacheExpiry = DateTime.UtcNow.AddSeconds(60);
            return freshProjects;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Menggunakan cache memori proyek karena DB timeout: {Msg}", ex.Message);
            return _cachedProjects ?? new List<Project>();
        }
        finally
        {
            _projectCacheLock.Release();
        }
    }

    private async Task<List<KnowledgeDocDto>> LoadKnowledgeDocsAsync()
    {
        if (_cachedKbDocs != null && DateTime.UtcNow < _kbCacheExpiry)
            return _cachedKbDocs;

        await _kbCacheLock.WaitAsync();
        try
        {
            if (_cachedKbDocs != null && DateTime.UtcNow < _kbCacheExpiry)
                return _cachedKbDocs;

            var docs = new List<KnowledgeDocDto>();
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"SELECT ""Id"", ""Title"", ""Category"", ""FileName"", ""Content"", ""CreatedAt"" FROM ""KnowledgeDocuments"" ORDER BY ""Id"" DESC;";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                docs.Add(new KnowledgeDocDto
                {
                    Id = reader.GetString(0),
                    Title = reader.GetString(1),
                    Category = reader.IsDBNull(2) ? "SOP / Umum" : reader.GetString(2),
                    FileName = reader.IsDBNull(3) ? "" : reader.GetString(3),
                    Content = reader.IsDBNull(4) ? "" : reader.GetString(4),
                    CreatedAt = reader.IsDBNull(5) ? "" : reader.GetString(5)
                });
            }

            _cachedKbDocs = docs;
            _kbCacheExpiry = DateTime.UtcNow.AddSeconds(60);
            return docs;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Gagal membaca KnowledgeDocuments dari PostgreSQL: {Msg}", ex.Message);
            return _cachedKbDocs ?? new List<KnowledgeDocDto>();
        }
        finally
        {
            _kbCacheLock.Release();
        }
    }

    private static decimal NormalizeUnitPrice(decimal rawPrice)
    {
        if (rawPrice <= 0) return 0;
        if (rawPrice < 100m)
            return rawPrice <= 25m ? rawPrice * 100_000_000m : rawPrice * 10_000_000m;
        if (rawPrice < 100_000m)
            return rawPrice * 1_000_000m;
        return rawPrice;
    }

    private static string FormatThreeMainDigits(decimal val)
    {
        double d = (double)val;
        if (d <= 0) return "0";
        int digits = (int)Math.Floor(Math.Log10(Math.Abs(d))) + 1;
        int decimals = Math.Max(0, 3 - digits);
        double rounded = Math.Round(d, decimals, MidpointRounding.AwayFromZero);
        return rounded.ToString($"0.{new string('#', decimals)}", new CultureInfo("id-ID"));
    }

    private static string FormatCompactRupiah(decimal rawPrice)
    {
        var price = NormalizeUnitPrice(rawPrice);
        if (price <= 0) return "Hubungi Marketing";
        if (price >= 1_000_000_000m) return $"Rp {FormatThreeMainDigits(price / 1_000_000_000m)} Miliar";
        if (price >= 1_000_000m) return $"Rp {FormatThreeMainDigits(price / 1_000_000m)} Juta";
        return string.Format(new CultureInfo("id-ID"), "Rp {0:N0}", price);
    }

    private static string GetProjectPriceRangeText(Project project)
    {
        var validPrices = (project.Properties ?? new List<Property>())
            .Select(u => NormalizeUnitPrice(u.Price))
            .Where(p => p > 0)
            .ToList();

        if (!validPrices.Any()) return "Hubungi Marketing";
        var min = validPrices.Min();
        var max = validPrices.Max();

        return min == max
            ? FormatCompactRupiah(min)
            : $"{FormatCompactRupiah(min)} - {FormatCompactRupiah(max)}";
    }

    private static string FormatKecamatanLocation(string? rawLocation)
    {
        if (string.IsNullOrWhiteSpace(rawLocation)) return "Jakarta";
        var parts = rawLocation
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => Regex.Replace(p.Trim(), @"^kec(\.|amatan)?\s+", "", RegexOptions.IgnoreCase))
            .Where(p => !string.IsNullOrWhiteSpace(p) && !Regex.IsMatch(p, @"^kel(\.|urahan)?\s+", RegexOptions.IgnoreCase))
            .ToList();

        return parts.Any() ? string.Join(", ", parts) : rawLocation.Trim();
    }

    [HttpGet("{sessionId:guid}")]
    public IActionResult GetSessionHistory(Guid sessionId)
    {
        if (_cache.TryGetValue(SessionCacheKey(sessionId), out List<ChatHistoryItemDto>? history) && history != null)
        {
            lock (history)
            {
                return Ok(new { sessionId, messages = history.ToList() });
            }
        }

        return Ok(new { sessionId, messages = new List<ChatHistoryItemDto>() });
    }

    [HttpDelete("{sessionId:guid}")]
    public IActionResult ClearSessionHistory(Guid sessionId)
    {
        _cache.Remove(SessionCacheKey(sessionId));
        return Ok(new { sessionId, cleared = true });
    }

    [HttpGet("stats")]
    public IActionResult GetChatStats()
    {
        return Ok(new
        {
            totalSessions = Interlocked.Read(ref _totalSessionsCreated),
            totalMessages = Interlocked.Read(ref _totalMessagesProcessed)
        });
    }

    [HttpGet("knowledge")]
    public async Task<IActionResult> GetKnowledgeBase()
    {
        var docs = (await LoadKnowledgeDocsAsync())
            .Select(d => new { d.Id, d.Title, d.Category, d.FileName, d.Content, d.CreatedAt, hasVector = true })
            .ToList();
        return Ok(docs);
    }

    [HttpPost("knowledge")]
    public async Task<IActionResult> AddKnowledgeDoc([FromBody] KnowledgeDocDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest(new { message = "Judul dan isi dokumen wajib diisi." });

        var newDoc = new KnowledgeDocDto
        {
            Id = $"kb-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            Title = dto.Title.Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "Dokumen Perusahaan" : dto.Category.Trim(),
            FileName = dto.FileName ?? "",
            Content = dto.Content.Trim(),
            CreatedAt = DateTime.Now.ToString("dd MMM yyyy, HH:mm")
        };

        var conn = _context.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO ""KnowledgeDocuments"" (""Id"", ""Title"", ""Category"", ""FileName"", ""Content"", ""CreatedAt"")
            VALUES (@id, @title, @cat, @file, @content, @createdAt);";
        AddDbParam(cmd, "@id", newDoc.Id);
        AddDbParam(cmd, "@title", newDoc.Title);
        AddDbParam(cmd, "@cat", newDoc.Category);
        AddDbParam(cmd, "@file", newDoc.FileName);
        AddDbParam(cmd, "@content", newDoc.Content);
        AddDbParam(cmd, "@createdAt", newDoc.CreatedAt);
        await cmd.ExecuteNonQueryAsync();

        InvalidateKbCache();
        return Ok(new { newDoc.Id, newDoc.Title, newDoc.Category, newDoc.FileName, newDoc.Content, newDoc.CreatedAt, hasVector = true });
    }

    [HttpDelete("knowledge/{id}")]
    public async Task<IActionResult> DeleteKnowledgeDoc(string id)
    {
        var conn = _context.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"DELETE FROM ""KnowledgeDocuments"" WHERE ""Id"" = @id;";
        AddDbParam(cmd, "@id", id);
        await cmd.ExecuteNonQueryAsync();

        InvalidateKbCache();
        return Ok(new { deleted = true, id });
    }

    private string BuildSystemPrompt(List<Project> projects, List<KnowledgeDocDto> validKbDocs)
    {
        var catalogSectionLines = new List<string>();
        foreach (var p in projects)
        {
            var cleanLoc = FormatKecamatanLocation(p.Location);
            var projRange = GetProjectPriceRangeText(p);
            catalogSectionLines.Add($"Cluster: {p.Name} | Lokasi: {cleanLoc} | Harga: {projRange} | Info: {p.Description}");
            foreach (var u in p.Properties)
            {
                catalogSectionLines.Add(
                    $"  - Unit {u.Title}: {FormatCompactRupiah(u.Price)} (Rp {NormalizeUnitPrice(u.Price):N0}), " +
                    $"LT {u.LandArea}m², LB {u.BuildArea}m², {u.Beds} KT, {u.Baths} KM, Status: {u.Status}. {u.Description}");
            }
        }

        const int maxKbCharsTotal = 2800;
        var currentKbChars = 0;
        var kbSectionLines = new List<string>();

        foreach (var doc in validKbDocs.Take(3))
        {
            var remaining = maxKbCharsTotal - currentKbChars;
            if (remaining <= 200) break;

            var clippedContent = doc.Content.Length > remaining
                ? doc.Content[..remaining] + "\n...(ringkasan)"
                : doc.Content;

            kbSectionLines.Add($"[Dokumen: {doc.Title} ({doc.Category})]:\n{clippedContent}");
            currentKbChars += clippedContent.Length;
        }

        var fullRagContext =
            "=== KATALOG JAKHOME / JAKURBAN ===\n" +
            (catalogSectionLines.Any() ? string.Join("\n", catalogSectionLines) : "Belum ada unit di katalog.") +
            (kbSectionLines.Any() ? "\n\n=== KNOWLEDGE BASE RESMI ===\n" + string.Join("\n\n", kbSectionLines) : "");

        var todayText = DateTime.Now.ToString("dd MMMM yyyy", new CultureInfo("id-ID"));

        return $@"Kamu adalah JakUrban AI, konsultan properti virtual resmi dari JakHome / JakUrban (PT XYZ).
Tanggal hari ini: {todayText}.

Cara Berkomunikasi:
- Balas mengikuti bahasa pesan terakhir user (Bahasa Indonesia, Bahasa Inggris, atau bahasa lain yang digunakan user) secara natural, santai, ramah, dan tidak kaku.
- Jika user menyapa atau basa-basi ('halo', 'wassup', 'how u doin'), balas dengan akrab dulu lalu tawarkan bantuan seputar pencarian hunian secara halus.
- Gunakan penalaran konsultatif untuk membantu user (analisis budget/gaji dengan cicilan ideal ~30-35% penghasilan, lokasi kerja, kebutuhan kamar, dan simulasi KPR default DP 30%, plafon 70%, bunga efektif 7.5%/tahun, tenor 15 & 20 tahun).

Kebijakan Mata Uang — KHUSUS RUPIAH (WAJIB DIPATUHI):
- Seluruh harga properti, DP, plafon, dan simulasi KPR di JakHome / JakUrban HANYA disajikan dan dihitung dalam mata uang Rupiah (Rp / IDR), apa pun bahasa yang digunakan user.
- DILARANG KERAS mengonversi, menaksir, atau memperkirakan kurs ke/dari mata uang asing mana pun (USD/$, SGD, MYR/RM, EUR, GBP, AUD, JPY, CNY, dll.) bahkan perkiraan kasar sekalipun.
- Jika user meminta harga dalam mata uang asing, tolak konversinya dengan sopan lalu tetap sebutkan harga resminya dalam Rupiah (Rp / IDR).
- Jika user menyebutkan budget/gaji dalam mata uang asing, JANGAN mengonversinya sendiri; jelaskan bahwa simulasi hanya mendukung Rupiah (Rp / IDR) lalu minta user menyebutkan nominalnya dalam Rupiah.

Batasan Peran & Fakta (Wajib Dipatuhi):
- Ruang lingkupmu HANYA properti, perumahan, cluster, lokasi Jakarta, pricelist, legalitas rumah, dan KPR.
- Jika user bertanya topik di luar perumahan/properti (seperti makanan/resep, politik/presiden, koding, hiburan, olahraga, cuaca, atau pengetahuan umum), JANGAN menjawab isi pertanyaan tersebut; tolak dengan santai dalam 1-2 kalimat lalu arahkan kembali ke topik hunian.
- Gunakan hanya fakta dari [KONTEKS RAG] di bawah. Dilarang mengarang unit, harga, atau diskon fiktif; untuk negosiasi harga final atau jadwal survei, arahkan ke WhatsApp Marketing Resmi +62 878 1911 2003.

Aturan Format Tampilan (Wajib Dipatuhi):
- Gunakan format Markdown standar agar UI merendernya dengan rapi: pakai **teks tebal** untuk harga, nama unit, atau angka penting; pakai subjudul ### untuk memisahkan bagian; dan pakai tabel Markdown (| Kolom 1 | Kolom 2 |) saat menampilkan simulasi KPR, daftar pricelist, atau perbandingan beberapa unit.
- Gunakan daftar bernomor (1., 2., 3.) atau poin standar bila perlu, dan HINDARI tanda pisah panjang khas AI (— atau –) di tengah kalimat; cukup gunakan koma atau titik.
- Jangan pernah menuliskan simbol mata uang asing seperti ""$"" (bahkan di samping IDR); selalu tulis ""Rp"" atau ""IDR"".

[KONTEKS RAG]:
{fullRagContext}";
    }

    private async Task WriteSseEventAsync(object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, SseJsonOptions);
        await Response.WriteAsync($"data: {json}\n\n", ct);
        await Response.Body.FlushAsync(ct);
    }

    [HttpPost("stream")]
    [EnableRateLimiting("chat-limit")]
    public async Task PostChatStream([FromBody] ChatRequestDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            Response.StatusCode = 400;
            return;
        }

        Response.StatusCode = 200;
        Response.ContentType = "text/event-stream; charset=utf-8";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var sessionId = request.SessionId == null || request.SessionId == Guid.Empty
            ? Guid.NewGuid()
            : request.SessionId.Value;

        var history = GetOrCreateSessionHistory(sessionId);
        List<ChatTurnDto> previousTurns;

        lock (history)
        {
            previousTurns = history.Select(h => new ChatTurnDto
            {
                Role = h.Sender == "user" ? "user" : "assistant",
                Content = h.Text
            }).ToList();

            AppendMessageBounded(history, new ChatHistoryItemDto
            {
                Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Sender = "user",
                Text = request.Message.Trim(),
                Timestamp = DateTime.UtcNow
            });
        }

        var projects = await GetProjectsFastAsync();
        var validKbDocs = (await LoadKnowledgeDocsAsync())
            .Where(d => !string.IsNullOrWhiteSpace(d.Content) &&
                        !d.Content.TrimStart().StartsWith("[Lampiran File:", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var systemPrompt = BuildSystemPrompt(projects, validKbDocs);
        var fullReplyBuilder = new StringBuilder();
        var isFromLlm = false;

        try
        {
            await foreach (var token in _embeddingService.StreamChatCompletionAsync(
                systemPrompt,
                request.Message,
                previousTurns,
                cancellationToken))
            {
                isFromLlm = true;
                fullReplyBuilder.Append(token);
                await WriteSseEventAsync(new { type = "token", text = token }, cancellationToken);
            }

            if (!isFromLlm)
            {
                var backupText = BuildNaturalBackupReply(request.Message, projects, validKbDocs);
                fullReplyBuilder.Append(backupText);
                await WriteSseEventAsync(new { type = "token", text = backupText }, cancellationToken);
            }

            var finalReply = fullReplyBuilder.ToString().Trim();
            var recommendedUnits = ExtractMentionedUnitCards(finalReply, projects);

            lock (history)
            {
                AppendMessageBounded(history, new ChatHistoryItemDto
                {
                    Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 1,
                    Sender = "bot",
                    Text = finalReply,
                    Timestamp = DateTime.UtcNow,
                    Recommendations = recommendedUnits
                });
            }

            await WriteSseEventAsync(new
            {
                type = "done",
                sessionId,
                recommendations = recommendedUnits,
                ragMode = isFromLlm ? "llm-stream-rag" : "backup-conversational-engine"
            }, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            var partialReply = fullReplyBuilder.ToString().Trim();
            if (!string.IsNullOrWhiteSpace(partialReply))
            {
                lock (history)
                {
                    AppendMessageBounded(history, new ChatHistoryItemDto
                    {
                        Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 1,
                        Sender = "bot",
                        Text = partialReply,
                        Timestamp = DateTime.UtcNow
                    });
                }
            }
        }
    }

    [HttpPost]
    [EnableRateLimiting("chat-limit")]
    public async Task<IActionResult> PostChat([FromBody] ChatRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { reply = "Pesan tidak boleh kosong." });

        var sessionId = request.SessionId == null || request.SessionId == Guid.Empty
            ? Guid.NewGuid()
            : request.SessionId.Value;

        var history = GetOrCreateSessionHistory(sessionId);
        List<ChatTurnDto> previousTurns;

        lock (history)
        {
            previousTurns = history.Select(h => new ChatTurnDto
            {
                Role = h.Sender == "user" ? "user" : "assistant",
                Content = h.Text
            }).ToList();

            AppendMessageBounded(history, new ChatHistoryItemDto
            {
                Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Sender = "user",
                Text = request.Message.Trim(),
                Timestamp = DateTime.UtcNow
            });
        }

        var projects = await GetProjectsFastAsync();
        var validKbDocs = (await LoadKnowledgeDocsAsync())
            .Where(d => !string.IsNullOrWhiteSpace(d.Content) &&
                        !d.Content.TrimStart().StartsWith("[Lampiran File:", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var systemPrompt = BuildSystemPrompt(projects, validKbDocs);
        var llmReply = await _embeddingService.GenerateChatCompletionAsync(
            systemPrompt,
            request.Message,
            previousTurns);

        var isFromLlm = !string.IsNullOrWhiteSpace(llmReply);
        var finalReply = isFromLlm
            ? llmReply!
            : BuildNaturalBackupReply(request.Message, projects, validKbDocs);

        var recommendedUnits = ExtractMentionedUnitCards(finalReply, projects);

        lock (history)
        {
            AppendMessageBounded(history, new ChatHistoryItemDto
            {
                Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 1,
                Sender = "bot",
                Text = finalReply,
                Timestamp = DateTime.UtcNow,
                Recommendations = recommendedUnits
            });
        }

        return Ok(new
        {
            sessionId,
            reply = finalReply,
            recommendations = recommendedUnits,
            historyCount = history.Count,
            ragMode = isFromLlm ? "llm-rag" : "backup-conversational-engine"
        });
    }

    private static List<object> ExtractMentionedUnitCards(string llmReply, List<Project> projects)
    {
        var cards = new List<object>();
        if (string.IsNullOrWhiteSpace(llmReply)) return cards;

        var replyLower = llmReply.ToLowerInvariant();

        foreach (var p in projects)
        {
            var cleanLoc = FormatKecamatanLocation(p.Location);
            var projRange = GetProjectPriceRangeText(p);
            var projWords = Regex.Matches(p.Name.ToLowerInvariant(), @"[a-z0-9]+")
                .Select(m => m.Value)
                .Where(w => w.Length > 2 && w != "cluster" && w != "project" && w != "residence")
                .ToList();

            bool projectMentioned = projWords.Any() && projWords.All(pw => replyLower.Contains(pw));

            foreach (var u in p.Properties)
            {
                var unitTitleLower = u.Title.ToLowerInvariant().Trim();
                bool unitMentioned = !string.IsNullOrWhiteSpace(unitTitleLower) &&
                                     Regex.IsMatch(llmReply, $@"\b{Regex.Escape(unitTitleLower)}\b", RegexOptions.IgnoreCase);

                if (unitMentioned || projectMentioned)
                {
                    cards.Add(new
                    {
                        id = u.Id,
                        projectId = p.Id,
                        projectName = p.Name,
                        projectPriceRange = projRange,
                        location = cleanLoc,
                        name = u.Title,
                        rawPrice = NormalizeUnitPrice(u.Price),
                        price = FormatCompactRupiah(u.Price),
                        landArea = u.LandArea,
                        buildArea = u.BuildArea,
                        beds = u.Beds,
                        baths = u.Baths,
                        status = u.Status
                    });
                }
            }
        }

        return cards;
    }

    private static string BuildNaturalBackupReply(
        string userMessage,
        List<Project> projects,
        List<KnowledgeDocDto> validKbDocs)
    {
        var summaryParts = new List<string>();
        foreach (var p in projects)
        {
            var loc = FormatKecamatanLocation(p.Location);
            var unitsText = string.Join("\n", p.Properties.Select(u =>
                $"- **{u.Title}**: {FormatCompactRupiah(u.Price)} (LT {u.LandArea}m² / LB {u.BuildArea}m², {u.Beds} KT, {u.Baths} KM, Status: {u.Status})"));
            summaryParts.Add($"Untuk **{p.Name}** di area {loc} (kisaran {GetProjectPriceRangeText(p)}), opsi di katalog utama meliputi:\n{unitsText}");
        }

        if (validKbDocs.Any())
        {
            foreach (var doc in validKbDocs.Take(2))
            {
                summaryParts.Add($"Info dari dokumen **{doc.Title}** ({doc.Category}):\n{doc.Content}");
            }
        }

        return summaryParts.Any()
            ? string.Join("\n\n", summaryParts) + "\n\nKira-kira dari pilihan di atas, mana yang paling mendekati kriteria rumah yang sedang Anda cari?"
            : "Saat ini data unit sedang disiapkan di katalog. Anda sedang fokus mencari hunian di area Jakarta mana dan kisaran budget berapa?";
    }
}