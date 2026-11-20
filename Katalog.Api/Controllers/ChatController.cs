using System.Collections.Concurrent;
using System.Globalization;
using System.Text.RegularExpressions;
using Katalog.Api.Data;
using Katalog.Api.Models;
using Katalog.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    private readonly ILogger<ChatController> _logger;

    private static readonly ConcurrentDictionary<Guid, List<ChatHistoryItemDto>> _sessionMessages = new();

    private static readonly string _kbFilePath = Path.Combine(AppContext.BaseDirectory, "knowledge-base.json");
    private static List<KnowledgeDocDto>? _cachedKbDocs;
    private static readonly object _kbLock = new();

    // Cache daftar Project & Unit (tanpa foto/video Base64) di RAM agar pengambilan konteks instan (0ms)
    private static List<Project>? _cachedProjects;
    private static DateTime _projectsCacheExpiry = DateTime.MinValue;
    private static readonly SemaphoreSlim _projectCacheLock = new(1, 1);

    public static void InvalidateProjectCache()
    {
        _projectsCacheExpiry = DateTime.MinValue;
    }

    private async Task<List<Project>> GetProjectsFastAsync()
    {
        if (_cachedProjects != null && DateTime.UtcNow < _projectsCacheExpiry)
        {
            return _cachedProjects;
        }

        await _projectCacheLock.WaitAsync();
        try
        {
            if (_cachedProjects != null && DateTime.UtcNow < _projectsCacheExpiry)
            {
                return _cachedProjects;
            }

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
            _logger.LogWarning("Menggunakan cache memori karena koneksi DB lambat/timeout: {Msg}", ex.Message);
            return _cachedProjects ?? new List<Project>();
        }
        finally
        {
            _projectCacheLock.Release();
        }
    }

    private static List<KnowledgeDocDto> LoadKnowledgeDocs()
    {
        lock (_kbLock)
        {
            if (_cachedKbDocs != null) return _cachedKbDocs;
            try
            {
                if (System.IO.File.Exists(_kbFilePath))
                {
                    var raw = System.IO.File.ReadAllText(_kbFilePath);
                    _cachedKbDocs = System.Text.Json.JsonSerializer.Deserialize<List<KnowledgeDocDto>>(raw) ?? new();
                    return _cachedKbDocs;
                }
            }
            catch { }
            _cachedKbDocs = new List<KnowledgeDocDto>();
            return _cachedKbDocs;
        }
    }

    private static void SaveKnowledgeDocs(List<KnowledgeDocDto> docs)
    {
        lock (_kbLock)
        {
            _cachedKbDocs = docs;
            try
            {
                var json = System.Text.Json.JsonSerializer.Serialize(docs, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                System.IO.File.WriteAllText(_kbFilePath, json);
            }
            catch { }
        }
    }

    public ChatController(
        ApplicationDbContext context,
        IEmbeddingService embeddingService,
        ILogger<ChatController> logger)
    {
        _context = context;
        _embeddingService = embeddingService;
        _logger = logger;
    }

    private static decimal NormalizeUnitPrice(decimal rawPrice)
    {
        if (rawPrice <= 0) return 0;
        if (rawPrice < 100m)
        {
            return rawPrice <= 25m ? rawPrice * 100_000_000m : rawPrice * 10_000_000m;
        }
        if (rawPrice < 100_000m)
        {
            return rawPrice * 1_000_000m;
        }
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

        if (price >= 1_000_000_000m)
        {
            return $"Rp {FormatThreeMainDigits(price / 1_000_000_000m)} Miliar";
        }

        if (price >= 1_000_000m)
        {
            return $"Rp {FormatThreeMainDigits(price / 1_000_000m)} Juta";
        }

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
        if (_sessionMessages.TryGetValue(sessionId, out var history))
        {
            lock (history)
            {
                return Ok(new
                {
                    sessionId,
                    messages = history.ToList()
                });
            }
        }

        return Ok(new
        {
            sessionId,
            messages = new List<ChatHistoryItemDto>()
        });
    }

    [HttpDelete("{sessionId:guid}")]
    public IActionResult ClearSessionHistory(Guid sessionId)
    {
        _sessionMessages.TryRemove(sessionId, out _);
        return Ok(new { sessionId, cleared = true });
    }

    [HttpGet("stats")]
    public IActionResult GetChatStats()
    {
        var totalSessions = _sessionMessages.Count;
        var totalMessages = _sessionMessages.Values.Sum(list =>
        {
            lock (list) { return list.Count; }
        });

        return Ok(new
        {
            totalSessions,
            totalMessages
        });
    }

    [HttpGet("knowledge")]
    public IActionResult GetKnowledgeBase()
    {
        var docs = LoadKnowledgeDocs()
            .Select(d => new { d.Id, d.Title, d.Category, d.FileName, d.Content, d.CreatedAt, hasVector = true })
            .ToList();
        return Ok(docs);
    }

    [HttpPost("knowledge")]
    public IActionResult AddKnowledgeDoc([FromBody] KnowledgeDocDto dto)
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
            CreatedAt = DateTime.Now.ToString("dd MMM yyyy, HH:mm"),
            Embedding = null
        };

        var current = LoadKnowledgeDocs().ToList();
        current.Insert(0, newDoc);
        SaveKnowledgeDocs(current);

        return Ok(new { newDoc.Id, newDoc.Title, newDoc.Category, newDoc.FileName, newDoc.Content, newDoc.CreatedAt, hasVector = true });
    }

    [HttpDelete("knowledge/{id}")]
    public IActionResult DeleteKnowledgeDoc(string id)
    {
        var current = LoadKnowledgeDocs().Where(d => d.Id != id).ToList();
        SaveKnowledgeDocs(current);
        return Ok(new { deleted = true, id });
    }

    [HttpPost]
    public async Task<IActionResult> PostChat([FromBody] ChatRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { reply = "Pesan tidak boleh kosong." });

        var sessionId = request.SessionId == null || request.SessionId == Guid.Empty
            ? Guid.NewGuid()
            : request.SessionId.Value;

        var history = _sessionMessages.GetOrAdd(sessionId, _ => new List<ChatHistoryItemDto>());
        List<ChatTurnDto> previousTurns;

        lock (history)
        {
            previousTurns = history.Select(h => new ChatTurnDto
            {
                Role = h.Sender == "user" ? "user" : "assistant",
                Content = h.Text
            }).ToList();

            history.Add(new ChatHistoryItemDto
            {
                Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Sender = "user",
                Text = request.Message.Trim(),
                Timestamp = DateTime.UtcNow
            });
        }

        // 1. Ambil seluruh data proyek/unit dari memori (0ms) dan seluruh dokumen Knowledge Base
        var projects = await GetProjectsFastAsync();
        var validKbDocs = LoadKnowledgeDocs()
            .Where(d => !string.IsNullOrWhiteSpace(d.Content) &&
                        !d.Content.TrimStart().StartsWith("[Lampiran File:", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var catalogSectionLines = new List<string>();
        foreach (var p in projects)
        {
            var cleanLoc = FormatKecamatanLocation(p.Location);
            var projRange = GetProjectPriceRangeText(p);
            catalogSectionLines.Add($"Cluster/Project: {p.Name} | Lokasi: {cleanLoc} | Kisaran Harga: {projRange} | Deskripsi: {p.Description}");
            foreach (var u in p.Properties)
            {
                catalogSectionLines.Add(
                    $"  - Unit {u.Title}: Harga {FormatCompactRupiah(u.Price)} (Nominal: Rp {NormalizeUnitPrice(u.Price):N0}), " +
                    $"LT {u.LandArea}m², LB {u.BuildArea}m², {u.Beds} Kamar Tidur (KT), {u.Baths} Kamar Mandi (KM), Status: {u.Status}. Detail: {u.Description}");
            }
        }

        var kbSectionLines = validKbDocs
            .Select(d => $"[Dokumen Knowledge Base: {d.Title} ({d.Category})]:\n{d.Content}")
            .ToList();

        var fullRagContext =
            "=== DATA KATALOG PROPERTI JAKURBAN ===\n" +
            (catalogSectionLines.Any() ? string.Join("\n", catalogSectionLines) : "Belum ada unit di tabel katalog utama.") +
            (kbSectionLines.Any() ? "\n\n=== DOKUMEN RESMI & PRICELIST PERUSAHAAN (KNOWLEDGE BASE) ===\n" + string.Join("\n\n", kbSectionLines) : "");

        // 2. System Instruction yang memberi kebebasan penuh kepada LLM untuk mengobrol dan bernalar secara natural
        var systemPrompt = $@"Kamu adalah JakUrban AI, asisten dan teman diskusi properti cerdas dari JakUrban (PT XYZ).
Berbicaralah secara natural, santai namun sopan, luwes, cerdas, dan ekspresif persis seperti LLM modern (seperti Gemini/ChatGPT) yang sedang mengobrol langsung dengan manusia—JANGAN menggunakan kalimat template yang kaku atau berulang-ulang.

Panduan Perilaku & Penalaran (Light Conversation & Reasoning):
- Kamu bebas mengobrol santai (light conversation), menanggapi candaan, sapaan, curhatan, atau diskusi terbuka dengan hangat.
- Gunakan kemampuan penalaranmu (light reasoning) untuk membantu user berpikir: misalnya menganalisis kecocokan gaji/budget mereka dengan harga rumah, membandingkan kelebihan lokasi antar-cluster terhadap tempat kerja user, memberi saran tipe rumah untuk keluarga muda/pasangan baru, atau menghitung simulasi KPR (default bunga efektif 7.5% per tahun, DP 30%, tenor 15-20 tahun, atau sesuai angka DP/tenor yang diminta user).
- Gunakan informasi dari [KONTEKS RAG JAKURBAN] di bawah (baik dari Data Katalog maupun Dokumen Knowledge Base/Pricelist) sebagai dasar fakta properti yang kamu miliki. Jika di Knowledge Base ada daftar unit/pricelist tambahan, jelaskan juga dengan lengkap.
- Jangan mengarang unit fiktif atau diskon fiktif yang tidak ada di konteks. Untuk negosiasi harga final atau jadwal survei lokasi, infokan bahwa user bisa menghubungi WhatsApp Marketing Resmi di +62 878 1911 2003.
- Ikuti bahasa yang dipakai user (Bahasa Indonesia atau Bahasa Inggris), dan hindari penggunaan tanda bintang ganda (**).

[KONTEKS RAG JAKURBAN]:
{fullRagContext}";

        // 3. Murni panggil LLM untuk SEMUA pesan tanpa terkecuali!
        var llmReply = await _embeddingService.GenerateChatCompletionAsync(
            systemPrompt,
            request.Message,
            previousTurns);

        if (string.IsNullOrWhiteSpace(llmReply))
        {
            llmReply = BuildNaturalBackupReply(request.Message, projects, validKbDocs);
        }

        // 4. Tampilkan kartu unit di bawah chat HANYA jika jawaban LLM memang sedang membahas/merekomendasikan unit tersebut
        var recommendedUnits = ExtractMentionedUnitCards(request.Message, llmReply, projects);

        var botMessage = new ChatHistoryItemDto
        {
            Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 1,
            Sender = "bot",
            Text = llmReply,
            Timestamp = DateTime.UtcNow,
            Recommendations = recommendedUnits
        };

        lock (history)
        {
            history.Add(botMessage);
        }

        return Ok(new
        {
            sessionId,
            reply = llmReply,
            recommendations = recommendedUnits,
            historyCount = history.Count,
            ragMode = "pure-gemini-llm-rag"
        });
    }

    /// <summary>
    /// Menampilkan kartu unit di UI hanya untuk unit atau cluster yang benar-benar disebut di dalam percakapan LLM.
    /// </summary>
    private static List<object> ExtractMentionedUnitCards(string userMsg, string llmReply, List<Project> projects)
    {
        var cards = new List<object>();
        var combinedText = $"{userMsg} {llmReply}".ToLowerInvariant();

        // Jangan tampilkan kartu jika pesan user sangat pendek berupa sapaan murni
        var cleanUser = Regex.Replace(userMsg.ToLowerInvariant(), @"[^a-z0-9\s]", "").Trim();
        if (cleanUser is "halo" or "hai" or "hi" or "hello" or "pagi" or "siang" or "sore" or "malam" or "tes" or "test" or "p")
        {
            return cards;
        }

        foreach (var p in projects)
        {
            var cleanLoc = FormatKecamatanLocation(p.Location);
            var projRange = GetProjectPriceRangeText(p);
            var projWords = Regex.Matches(p.Name.ToLowerInvariant(), @"[a-z0-9]+")
                .Select(m => m.Value)
                .Where(w => w.Length > 2 && w != "cluster" && w != "project" && w != "residence")
                .ToList();

            bool projectMentioned = projWords.Any() && projWords.All(pw => combinedText.Contains(pw));

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
        var q = userMessage.ToLowerInvariant().Trim();

        // Sapaan atau obrolan pembuka
        if (q.Length <= 20 && (q.Contains("halo") || q.Contains("hai") || q.Contains("hi") || q.Contains("pagi") || q.Contains("siang") || q.Contains("sore") || q.Contains("malam") || q.Contains("bro") || q.Contains("kak")))
        {
            var clusterNames = projects.Any()
                ? string.Join(", ", projects.Select(p => $"{p.Name} ({FormatKecamatanLocation(p.Location)})"))
                : "Jakarta";
            return $"Halo! Senang bisa ngobrol sama kamu di JakUrban AI. Saat ini kita punya pilihan hunian menarik di {clusterNames}. Kamu lagi nyari rumah di daerah mana nih, atau udah ada bayangan budget dan jumlah kamar yang dibutuhin?";
        }

        // Jika menanyakan KPR / cicilan / gaji
        if (q.Contains("kpr") || q.Contains("cicil") || q.Contains("dp") || q.Contains("gaji") || q.Contains("angsuran"))
        {
            var firstUnit = projects.SelectMany(p => p.Properties.Select(u => new { Project = p, Unit = u }))
                .FirstOrDefault(x => NormalizeUnitPrice(x.Unit.Price) > 0);

            if (firstUnit != null)
            {
                decimal price = NormalizeUnitPrice(firstUnit.Unit.Price);
                decimal dp = price * 0.30m;
                decimal loan = price - dp;
                double r = 0.075 / 12.0;
                decimal monthly20 = (decimal)((double)loan * (r * Math.Pow(1 + r, 240)) / (Math.Pow(1 + r, 240) - 1));
                decimal monthly15 = (decimal)((double)loan * (r * Math.Pow(1 + r, 180)) / (Math.Pow(1 + r, 180) - 1));

                return $"Kalau kita hitung simulasi KPR untuk {firstUnit.Unit.Title} di {firstUnit.Project.Name} (harga {FormatCompactRupiah(price)}), dengan DP 30% ({FormatCompactRupiah(dp)}) dan plafon pinjaman 70% ({FormatCompactRupiah(loan)}) di bunga efektif 7.5% per tahun:\n\n" +
                       $"- Tenor 15 tahun: sekitar {FormatCompactRupiah(Math.Round(monthly15, 0))} per bulan\n" +
                       $"- Tenor 20 tahun: sekitar {FormatCompactRupiah(Math.Round(monthly20, 0))} per bulan\n\n" +
                       $"Supaya cashflow bulanan tetap nyaman (sekitar 30-35% dari penghasilan), cicilan ini pas banget kalau penghasilan bulanan ada di kisaran {FormatCompactRupiah(Math.Round(monthly20 / 0.35m, 0))}. Gimana menurutmu, mau kita bandingkan dengan skema DP yang berbeda?";
            }
        }

        // Jawaban natural yang merangkum unit katalog + isi dokumen Pricelist Knowledge Base
        var summaryParts = new List<string>();
        foreach (var p in projects)
        {
            var loc = FormatKecamatanLocation(p.Location);
            var unitsText = string.Join("\n", p.Properties.Select(u =>
                $"- {u.Title}: {FormatCompactRupiah(u.Price)} (LT {u.LandArea}m² / LB {u.BuildArea}m², {u.Beds} KT, {u.Baths} KM, Status: {u.Status})"));
            summaryParts.Add($"Untuk {p.Name} di area {loc} (kisaran {GetProjectPriceRangeText(p)}), opsi di katalog utama kita meliputi:\n{unitsText}");
        }

        if (validKbDocs.Any())
        {
            foreach (var doc in validKbDocs.Take(2))
            {
                summaryParts.Add($"Info dari dokumen {doc.Title} ({doc.Category}):\n{doc.Content}");
            }
        }

        return summaryParts.Any()
            ? string.Join("\n\n", summaryParts) + "\n\nKira-kira dari pilihan di atas, mana yang paling mendekati kriteria rumah yang lagi kamu cari?"
            : "Saat ini data unit masih disiapkan di katalog. Kamu lagi fokus cari hunian di daerah Jakarta mana dan kisaran budget berapa?";
    }

}