using System.Collections.Concurrent;
using System.Globalization;
using System.Text.RegularExpressions;
using Katalog.Api.Data;
using Katalog.Api.Models;
using Katalog.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pgvector;

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
    public string Category { get; set; } = " SOP / Umum";
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

    /// <summary>
    /// Menormalkan harga unit jika sebelumnya tersimpan dalam angka singkat (misal 900 -> 900 Juta).
    /// </summary>
    private static decimal NormalizeUnitPrice(decimal rawPrice)
    {
        if (rawPrice <= 0) return 0;
        // Jika angka di bawah 100 (misal 1.2 atau 12 dari 1,2 Miliar)
        if (rawPrice < 100m)
        {
            return rawPrice <= 25m ? rawPrice * 100_000_000m : rawPrice * 10_000_000m;
        }
        // Jika angka 100 - 99.999 (misal 265 atau 652 atau 900 -> ratusan Juta)
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

    /// <summary>
    /// Memformat nominal Rupiah menggunakan istilah "Juta" dan "Miliar".
    /// </summary>
    private static string FormatCompactRupiah(decimal rawPrice, bool useEnglishUnits = false)
    {
        var price = NormalizeUnitPrice(rawPrice);
        if (price <= 0) return "Hubungi Marketing";

        if (price >= 1_000_000_000m)
        {
            return $"Rp {FormatThreeMainDigits(price / 1_000_000_000m)} {(useEnglishUnits ? "Billion" : "Miliar")}";
        }

        if (price >= 1_000_000m)
        {
            return $"Rp {FormatThreeMainDigits(price / 1_000_000m)} {(useEnglishUnits ? "Million" : "Juta")}";
        }

        return string.Format(new CultureInfo("id-ID"), "Rp {0:N0}", price);
    }

    /// <summary>
    /// Menghitung teks rentang harga terendah - tertinggi pada suatu Project/Cluster.
    /// </summary>
    private static string GetProjectPriceRangeText(Project project, bool useEnglishUnits = false)
    {
        var validPrices = (project.Properties ?? new List<Property>())
            .Select(u => NormalizeUnitPrice(u.Price))
            .Where(p => p > 0)
            .ToList();

        if (!validPrices.Any()) return "Hubungi Marketing";

        var min = validPrices.Min();
        var max = validPrices.Max();

        return min == max
            ? FormatCompactRupiah(min, useEnglishUnits)
            : $"{FormatCompactRupiah(min, useEnglishUnits)} - {FormatCompactRupiah(max, useEnglishUnits)}";
    }

    private static string FormatKecamatanLocation(string? rawLocation)
    {
        if (string.IsNullOrWhiteSpace(rawLocation)) return "Jakarta";
        var parts = rawLocation
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            // Hapus awalan "Kec." atau "Kecamatan"
            .Select(p => Regex.Replace(p.Trim(), @"^kec(\.|amatan)?\s+", "", RegexOptions.IgnoreCase))
            .Where(p => !string.IsNullOrWhiteSpace(p) && !Regex.IsMatch(p, @"^kel(\.|urahan)?\s+", RegexOptions.IgnoreCase))
            .ToList();

        return parts.Any() ? string.Join(", ", parts) : rawLocation.Trim();
    }

    private static string CleanUnitCode(string? rawCode)
    {
        if (string.IsNullOrWhiteSpace(rawCode)) return "";
        return Regex.Replace(rawCode, @"\|CP:\d+", "");
    }

    private static readonly IReadOnlyDictionary<string, string> QueryAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["jaksel"] = "Jakarta Selatan",
        ["jaktim"] = "Jakarta Timur",
        ["jakbar"] = "Jakarta Barat",
        ["jakut"] = "Jakarta Utara",
        ["jakpus"] = "Jakarta Pusat",
        ["south jakarta"] = "Jakarta Selatan",
        ["east jakarta"] = "Jakarta Timur",
        ["west jakarta"] = "Jakarta Barat",
        ["north jakarta"] = "Jakarta Utara",
        ["central jakarta"] = "Jakarta Pusat",
        ["house"] = "rumah",
        ["houses"] = "rumah",
        ["home"] = "rumah",
        ["homes"] = "rumah",
        ["apartment"] = "apartemen",
        ["apartments"] = "apartemen",
        ["affordable"] = "terjangkau murah",
        ["available"] = "tersedia",
        ["location"] = "lokasi",
        ["price"] = "harga",
        ["property"] = "properti",
        ["properties"] = "properti",
        ["find"] = "cari",
        ["lt"] = "luas tanah land area",
        ["lb"] = "luas bangunan building area",
        ["kt"] = "kamar tidur bedroom",
        ["km"] = "kamar mandi bathroom",
        ["dp"] = "down payment uang muka",
        ["bedrooms"] = "kamar tidur",
        ["bedroom"] = "kamar tidur",
        ["bathrooms"] = "kamar mandi",
        ["bathroom"] = "kamar mandi",
        ["mortgage"] = "KPR",
        ["down payment"] = "uang muka DP",
        ["installment"] = "angsuran cicilan"
    };

    private static string ExpandQueryTerms(string query)
    {
        var expansions = QueryAliases
            .Where(alias => Regex.IsMatch(query, $@"(?<![a-z0-9]){Regex.Escape(alias.Key)}(?![a-z0-9])", RegexOptions.IgnoreCase))
            .Select(alias => alias.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return expansions.Count == 0 ? query : $"{query} {string.Join(" ", expansions)}";
    }

    private static bool IsEnglishMessage(string message)
    {
        var englishSignals = new[]
        {
            "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "good day", "good night", "thanks", "thank you",
            "please", "house", "houses", "home", "homes", "looking for", "bedroom", "bedrooms", "bathroom", "bathrooms", "price",
            "location", "budget", "mortgage", "installment", "available", "recommend",
            "show me", "can you", "how much", "how many", "where is", "i want",
            "what about", "what is", "is there", "any homes", "any house", "for sale",
            "property", "properties", "find"
        };

        return englishSignals.Any(signal =>
            Regex.IsMatch(message, $@"(?<![a-z0-9]){Regex.Escape(signal)}(?![a-z0-9])", RegexOptions.IgnoreCase));
    }

    private static bool IsConversationalGreetingOrSmallTalk(string message)
    {
        var cleaned = Regex.Replace(message.ToLowerInvariant(), @"[^a-z0-9\s]", " ").Trim();
        var words = cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0 || words.Length > 6) return false;

        string[] propertyIntentWords =
        {
            "rumah", "unit", "cluster", "properti", "project", "harga", "kpr", "cicil",
            "simulasi", "jakarta", "kamar", "lokasi", "cari", "rekomendasi", "tersedia",
            "stok", "luas", "tanah", "bangunan", "tipe", "type", "diskon", "dp", "tenor",
            "house", "houses", "home", "homes", "property", "price", "mortgage", "bedroom", "bedrooms",
            "bathroom", "bathrooms", "location", "budget", "jakarta", "jaksel", "jaktim", "jakbar", "jakut", "jakpus",
            "south", "north", "east", "west", "central"
        };

        if (words.Any(w => propertyIntentWords.Contains(w))) return false;

        string[] greetingWords =
        {
            "halo", "hallo", "hi", "hai", "hei", "pagi", "siang", "sore", "malam",
            "assalamualaikum", "permisi", "p", "tes", "test", "ping", "min", "admin",
            "jak", "bro", "kak", "apa", "kabar", "bantu", "tanya", "konsultasi", "terima", "kasih", "makasih", "oke", "ok", "siap",
            "hello", "hey", "morning", "afternoon", "evening", "thanks", "thank", "you", "please"
        };

        return words.Any(w => greetingWords.Contains(w));
    }

    private async Task EnsureVectorIndexPopulatedAsync(List<Project> projects)
    {
        try
        {
            var hasEmbeddedChunks = await _context.DocumentChunks.AnyAsync(c => c.Embedding != null);
            if (hasEmbeddedChunks || !projects.Any()) return;

            var allUnits = projects.SelectMany(p => p.Properties.Select(u => new { Project = p, Unit = u })).ToList();
            if (!allUnits.Any()) return;

            foreach (var item in allUnits)
            {
                var p = item.Project;
                var u = item.Unit;
                var cleanLoc = FormatKecamatanLocation(p.Location);
                var projectRange = GetProjectPriceRangeText(p);

                var chunkText =
                    $"Proyek/Cluster: {p.Name} (Kisaran Harga Cluster: {projectRange}). " +
                    $"Lokasi Wilayah: {cleanLoc}. " +
                    $"Deskripsi & Fasilitas Kawasan: {p.Description}. " +
                    $"Nama Tipe Unit: {u.Title}. " +
                    $"Harga Unit: {FormatCompactRupiah(u.Price)}. " +
                    $"Status Ketersediaan: {u.Status}. " +
                    $"Spesifikasi Teknis: Luas Tanah (LT) {u.LandArea} m², Luas Bangunan (LB) {u.BuildArea} m², " +
                    $"{u.Beds} Kamar Tidur (KT), {u.Baths} Kamar Mandi (KM). " +
                    $"Detail Unit: {u.Description}";

                var vectorArray = await _embeddingService.GenerateEmbeddingAsync(chunkText);
                if (vectorArray.Length == 1536)
                {
                    _context.DocumentChunks.Add(new DocumentChunk
                    {
                        Id = Guid.NewGuid(),
                        PropertyId = u.Id,
                        Content = chunkText,
                        Source = $"{p.Name} - {u.Title}",
                        Embedding = new Vector(vectorArray),
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Auto-seeding pgvector dilewati: {Message}", ex.Message);
        }
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
            .Select(d => new { d.Id, d.Title, d.Category, d.FileName, d.Content, d.CreatedAt, hasVector = d.Embedding?.Length == 1536 })
            .ToList();
        return Ok(docs);
    }

    [HttpPost("knowledge")]
    public async Task<IActionResult> AddKnowledgeDoc([FromBody] KnowledgeDocDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest(new { message = "Judul dan isi dokumen wajib diisi." });

        var vector = await _embeddingService.GenerateEmbeddingAsync($"{dto.Title}. {dto.Category}. {dto.Content}");
        var newDoc = new KnowledgeDocDto
        {
            Id = $"kb-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            Title = dto.Title.Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "Dokumen Perusahaan" : dto.Category.Trim(),
            FileName = dto.FileName ?? "",
            Content = dto.Content.Trim(),
            CreatedAt = DateTime.Now.ToString("dd MMM yyyy, HH:mm"),
            Embedding = vector.Length == 1536 ? vector : null
        };

        var current = LoadKnowledgeDocs().ToList();
        current.Insert(0, newDoc);
        SaveKnowledgeDocs(current);

        return Ok(new { newDoc.Id, newDoc.Title, newDoc.Category, newDoc.FileName, newDoc.Content, newDoc.CreatedAt, hasVector = newDoc.Embedding != null });
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

        // Query ringan tanpa menarik kolom Videos & Photos Base64 berukuran puluhan MB
        var projects = await _context.Projects
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

        var isGreeting = IsConversationalGreetingOrSmallTalk(request.Message);
        var searchMessage = ExpandQueryTerms(request.Message);

        var retrievedChunks = new List<string>();
        var recommendedUnits = new List<object>();

        var clusterOverviewLines = projects.Select(p =>
            $"- {p.Name} ({FormatKecamatanLocation(p.Location)}): Kisaran Harga {GetProjectPriceRangeText(p)}, total {p.Properties.Count} tipe unit ({string.Join(", ", p.Properties.Select(u => $"{u.Title} [{FormatCompactRupiah(u.Price)}]"))})"
        ).ToList();

        if (!isGreeting && projects.Any())
        {
            var scored = RankUnitsSemantically(request.Message, projects);

            // Tampilkan SEMUA unit yang relevan (misal seluruh 10 unit di Cluster Setiabudi), jangan dipotong .Take(3)!
            retrievedChunks = scored.Select(s => s.ChunkText).ToList();
            recommendedUnits = scored.Select(s => s.UnitCard).ToList();
        }

        // Ambil juga dokumen Knowledge Base dari Super Admin yang relevan
        var kbDocs = LoadKnowledgeDocs();
        var matchedKbTexts = kbDocs
            .Where(d =>
                searchMessage.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Any(w => w.Length > 2 && ($"{d.Title} {d.Category} {d.Content}").Contains(w, StringComparison.OrdinalIgnoreCase))
                || kbDocs.Count <= 5)
            .Take(4)
            .Select(d => $"[DOKUMEN RESMI - {d.Title} ({d.Category})]:\n{d.Content}")
            .ToList();

        var contextData = projects.Any()
            ? "RINGKASAN SELURUH CLUSTER & DAFTAR LENGKAP UNIT:\n" + string.Join("\n", clusterOverviewLines) +
              (retrievedChunks.Any() ? "\n\nRINCIAN SPESIFIKASI UNIT:\n" + string.Join("\n---\n", retrievedChunks) : "") +
              (matchedKbTexts.Any() ? "\n\nDOKUMEN PENGETAHUAN TAMBAHAN PERUSAHAAN:\n" + string.Join("\n\n", matchedKbTexts) : "")
            : "Belum ada unit properti yang terdaftar di database saat ini.";

        // =========================================================================
        // TAHAP 5 PIPELINE RAG: NATURAL CONVERSATIONAL LLM + GUARDRAIL
        // =========================================================================
        var systemPrompt = $@"Anda adalah 'JakUrban AI', konsultan properti virtual resmi dari PT XYZ (JakUrban).
Gaya komunikasi Anda harus natural, hangat, komunikatif, dan cerdas layaknya konsultan penjualan properti profesional (bukan robot kaku).
Jawab dalam bahasa yang digunakan pengguna pada pesan terbarunya: gunakan bahasa Inggris jika pengguna bertanya dalam bahasa Inggris, dan bahasa Indonesia jika pengguna menggunakan bahasa Indonesia. Pertahankan nama resmi proyek, istilah teknis, dan mata uang Rupiah.
Pahami sinonim dan singkatan lokasi/rumah berikut sebagai istilah yang setara: Jaksel = Jakarta Selatan, Jaktim = Jakarta Timur, Jakbar = Jakarta Barat, Jakut = Jakarta Utara, Jakpus = Jakarta Pusat; LT = luas tanah/land area; LB = luas bangunan/building area; KT = kamar tidur/bedroom; KM = kamar mandi/bathroom; mortgage = KPR; down payment = DP/uang muka.

ATURAN PERCAKAPAN & PENJUALAN (WAJIB):
1. BASA-BASI & SAPAAN AWAL: Jika pengguna baru menyapa (seperti 'Halo', 'Hai', 'Pagi', 'Permisi', atau basa-basi singkat), JANGAN langsung menjabarkan daftar seluruh proyek atau seluruh unit. Sapalah dengan ramah, perkenalkan diri secara singkat, sebutkan sekilas bahwa JakUrban memiliki beberapa cluster hunian pilihan di Jakarta, lalu ajukan pertanyaan santai untuk menggali kebutuhan mereka (misalnya: sedang mencari hunian di area Jakarta mana, kisaran budget berapa Juta atau Miliar, atau butuh berapa kamar tidur).
2. FORMAT HARGA & RENTANG HARGA: Sesuaikan istilah nominal dengan bahasa pengguna: gunakan 'Juta' dan 'Miliar' dalam bahasa Indonesia, atau 'Million' dan 'Billion' dalam bahasa Inggris. Saat membahas sebuah Cluster/Project, sebutkan rentang harganya.
3. KETEPATAN UNIT & SIMULASI KPR: Jika pengguna meminta simulasi KPR untuk unit dan cluster tertentu (misalnya 'unit A1 di Cluster Setiadudi'), pastikan Anda menghitung HANYA untuk unit dan cluster yang diminta tersebut menggunakan asumsi bunga 7.5% efektif/tahun, DP 30%, serta estimasi angsuran tenor 15 tahun dan 20 tahun.
4. GUARDRAIL ANTI-HALUSINASI & DOMAIN: Hanya gunakan fakta dari [KONTEKS INVENTARIS PT XYZ]. Jangan mengarang diskon fiktif (arahkan negosiasi ke WhatsApp Marketing Resmi +62 878 1911 2003). Tolak dengan sopan pertanyaan di luar topik hunian/properti lalu arahkan kembali percakapan ke pencarian rumah.
5. TANPA EMOTICON & TANPA ASTERISK: Jangan gunakan emoji/emoticon dan jangan gunakan tanda bintang ganda (**).

[KONTEKS INVENTARIS PT XYZ]:
{contextData}";

        // Jika pengguna baru menyapa ("Halo", "Hai", "Pagi", dll.), langsung balas secara instan (< 50ms)
        // tanpa harus menunggu antrean jaringan eksternal agar pengalaman obrolan sangat responsif (NFR-2).
        string? llmReply = null;
        if (!isGreeting)
        {
            llmReply = await _embeddingService.GenerateChatCompletionAsync(
                systemPrompt,
                request.Message,
                previousTurns);
        }

        var finalReply = !string.IsNullOrWhiteSpace(llmReply)
            ? llmReply!
            : BuildConversationalFallbackResponse(request.Message, projects, previousTurns.Count, out recommendedUnits);

        // Jangan tampilkan kartu rekomendasi unit jika pengguna baru sekadar menyapa "halo"
        if (isGreeting)
        {
            recommendedUnits = new List<object>();
        }

        var botMessage = new ChatHistoryItemDto
        {
            Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 1,
            Sender = "bot",
            Text = finalReply,
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
            reply = finalReply,
            recommendations = recommendedUnits,
            historyCount = history.Count,
            ragMode = !string.IsNullOrWhiteSpace(llmReply) ? "pgvector+gemini-ai" : "conversational-rag-engine"
        });
    }

    private record ScoredUnitResult(int Score, string ChunkText, object UnitCard, Property Unit, Project Project);

    /// <summary>
    /// Pencocokan semantik & leksikal presisi tinggi dengan Word-Boundary agar nama unit pendek
    /// seperti "A1" atau "E" tidak pernah salah cocok dengan huruf di dalam kata lain.
    /// </summary>
    
    /// <summary>
    /// Mengekstrak kata kunci alfanumerik penting (panjang > 2 karakter dan bukan stopword).
    /// </summary>
    private static List<string> ExtractSearchTokens(string lowerQuery) =>
        Regex.Matches(lowerQuery, @"[a-z0-9]+")
            .Select(m => m.Value)
            .Where(w => w.Length > 2 && !StopWords.Contains(w))
            .ToList();
    private static List<ScoredUnitResult> RankUnitsSemantically(string query, List<Project> projects)
    {
        var q = ExpandQueryTerms(query).ToLowerInvariant().Trim();
        var tokens = ExtractSearchTokens(q);

        int? desiredBeds = null;
        var bedMatch = Regex.Match(q, @"(\d+)\s*(kamar|kt|bedroom)");
        if (bedMatch.Success && int.TryParse(bedMatch.Groups[1].Value, out var b))
            desiredBeds = b;

        bool wantsAffordable = q.Contains("murah") || q.Contains("terjangkau") ||
                               q.Contains("budget") || q.Contains("anak muda") ||
                               q.Contains("keluarga muda") || q.Contains("dibawah 1");

        var results = new List<ScoredUnitResult>();

        foreach (var p in projects)
        {
            var cleanLoc = FormatKecamatanLocation(p.Location);
            var projRange = GetProjectPriceRangeText(p);
            var projNameLower = p.Name.ToLowerInvariant().Trim();

            // Cek apakah nama project disebut secara langsung di dalam kalimat user
            bool projectMatched = !string.IsNullOrWhiteSpace(projNameLower) && q.Contains(projNameLower);
            if (!projectMatched)
            {
                // Cek kata unik dari nama project (misal "Setiadudi" atau "Mangga 2 Selatan")
                var projWords = Regex.Matches(projNameLower, @"[a-z0-9]+")
                    .Select(m => m.Value)
                    .Where(w => w.Length > 2 && w != "cluster" && w != "project" && w != "residence")
                    .ToList();
                if (projWords.Any() && projWords.All(pw => q.Contains(pw)))
                {
                    projectMatched = true;
                }
            }

            foreach (var u in p.Properties)
            {
                var score = 0;
                var unitTitleLower = u.Title.ToLowerInvariant().Trim();

                if (projectMatched)
                {
                    score += 30;
                }

                // Cek kecocokan nama unit dengan batas kata utuh (\b) agar "e" tidak cocok dengan "cluster"
                if (!string.IsNullOrWhiteSpace(unitTitleLower))
                {
                    var pattern = $@"\b{Regex.Escape(unitTitleLower)}\b";
                    if (Regex.IsMatch(q, pattern, RegexOptions.IgnoreCase))
                    {
                        score += 35;
                    }
                }

                var combined = $"{p.Name} {cleanLoc} {p.Description} {u.Title} {CleanUnitCode(u.UnitCode)} {u.Status} {u.Description}".ToLowerInvariant();
                foreach (var token in tokens)
                {
                    if (combined.Contains(token)) score += 3;
                }

                if (desiredBeds.HasValue && u.Beds == desiredBeds.Value)
                    score += 10;

                var normalizedPrice = NormalizeUnitPrice(u.Price);
                if (wantsAffordable && normalizedPrice > 0 && normalizedPrice <= 1_000_000_000m)
                    score += 8;

                if (u.Status.Equals("Tersedia", StringComparison.OrdinalIgnoreCase))
                    score += 2;

                var chunkText =
                    $"Proyek: {p.Name} ({cleanLoc}) | Kisaran Harga Cluster: {projRange}. " +
                    $"Unit: {u.Title}, Harga Unit: {FormatCompactRupiah(u.Price)}, " +
                    $"LT {u.LandArea}m² / LB {u.BuildArea}m², {u.Beds} KT, {u.Baths} KM, Status: {u.Status}. " +
                    $"Fasilitas: {p.Description} {u.Description}";

                var card = new
                {
                    id = u.Id,
                    projectId = p.Id,
                    projectName = p.Name,
                    projectPriceRange = projRange,
                    location = cleanLoc,
                    name = u.Title,
                    rawPrice = normalizedPrice,
                    price = FormatCompactRupiah(u.Price),
                    landArea = u.LandArea,
                    buildArea = u.BuildArea,
                    beds = u.Beds,
                    baths = u.Baths,
                    status = u.Status
                };

                results.Add(new ScoredUnitResult(score, chunkText, card, u, p));
            }
        }

        var maxScore = results.Any() ? results.Max(r => r.Score) : 0;
        if (maxScore >= 30)
        {
            return results
                .Where(r => r.Score >= maxScore - 20)
                .OrderByDescending(r => r.Score)
                .ToList();
        }

        var hasPositiveMatch = results.Any(r => r.Score > 2);
        return (hasPositiveMatch
                ? results.Where(r => r.Score > 2).OrderByDescending(r => r.Score)
                : results.OrderByDescending(r => r.Score))
            .ToList();
    }

    private static string BuildConversationalFallbackResponse(
        string userMessage,
        List<Project> projects,
        int previousTurnCount,
        out List<object> finalRecommendations)
    {
        finalRecommendations = new List<object>();
        var q = ExpandQueryTerms(userMessage).ToLowerInvariant().Trim();
        var isEnglish = IsEnglishMessage(userMessage);

        // 1. Sapaan & Basa-Basi Natural (Tidak langsung memuntahkan semua daftar unit)
        if (IsConversationalGreetingOrSmallTalk(userMessage))
        {
            if (q.Contains("terima kasih") || q.Contains("makasih") || q.Contains("thanks") || q.Contains("thank you"))
            {
                return isEnglish
                    ? "You're welcome! I'm happy to help. Let me know if you'd like to compare homes, estimate mortgage payments, or schedule a property visit."
                    : "Sama-sama! Senang bisa membantu Anda. Jika Anda ingin melihat perbandingan tipe unit lain, menghitung simulasi cicilan KPR, atau menjadwalkan kunjungan survei lokasi bersama tim kami, beri tahu saya kapan saja ya.";
            }

            if (q.Contains("kabar") || q.Contains("how are you"))
            {
                return isEnglish
                    ? "I'm doing well, thank you! I'm here to help you find a home in Jakarta. Which area, budget range, or number of bedrooms are you considering?"
                    : "Kabar saya sangat baik, terima kasih sudah menyapa! Saya siap mendampingi Anda menemukan hunian yang paling pas di Jakarta. Ngomong-ngomong, saat ini Anda sedang mempertimbangkan hunian di area mana, atau sudah ada kisaran budget dan jumlah kamar tidur yang diincar?";
            }

            if (!projects.Any())
            {
                return isEnglish
                    ? "Hello! Welcome to JakUrban AI. Our property catalog is currently being updated. What kind of home are you looking for?"
                    : "Halo! Selamat datang di layanan konsultasi properti JakUrban AI. Saat ini katalog properti kami sedang diperbarui oleh tim. Bagaimana rencana hunian impian yang sedang Anda cari saat ini?";
            }

            var allPrices = projects
                .SelectMany(p => p.Properties)
                .Select(u => NormalizeUnitPrice(u.Price))
                .Where(val => val > 0)
                .ToList();

            var globalRangeText = allPrices.Any()
                ? isEnglish
                    ? $"from {FormatCompactRupiah(allPrices.Min(), true)} to {FormatCompactRupiah(allPrices.Max(), true)}"
                    : $"mulai dari {FormatCompactRupiah(allPrices.Min())} hingga {FormatCompactRupiah(allPrices.Max())}"
                : isEnglish ? "across a range of home types" : "dengan berbagai pilihan tipe unit";

            var areas = projects
                .Select(p => FormatKecamatanLocation(p.Location))
                .Distinct()
                .Take(3)
                .ToList();

            var areaText = areas.Any() ? string.Join(", ", areas) : isEnglish ? "Jakarta's strategic areas" : "berbagai wilayah strategis Jakarta";

            return isEnglish
                ? $"Hello! Welcome to JakUrban AI.\n\nWe currently offer {projects.Count} residential clusters in {areaText}, with prices {globalRangeText}.\n\nWhich area are you interested in, how many bedrooms do you need, and what is your budget?"
                : $"Halo! Senang bisa berbincang dengan Anda di layanan konsultasi JakUrban AI.\n\n" +
                  $"Saat ini kami memasarkan {projects.Count} cluster hunian pilihan yang tersebar di {areaText} dengan kisaran harga {globalRangeText}.\n\n" +
                  $"Agar saya bisa merekomendasikan rumah yang paling cocok untuk Anda, boleh tahu Anda sedang mencari hunian di area mana, untuk berapa kamar tidur, atau ada kisaran budget tertentu yang sedang direncanakan?";
        }

        // 2. Guardrail Out-of-Domain
        string[] outOfDomainKeywords =
        {
            "resep", "masak", "nasi goreng", "cuaca", "politik", "presiden", "sepak bola",
            "koding", "python", "javascript", "lagu", "film", "dokter", "obat", "agama",
            "recipe", "weather", "politics", "football", "movie", "medicine", "doctor"
        };
        if (outOfDomainKeywords.Any(k => q.Contains(k)))
        {
            return isEnglish
                ? "Sorry, I'm JakUrban AI, a virtual property consultant focused on homes, residential clusters, and mortgage estimates. Would you like recommendations based on your preferred location or budget?"
                : "Mohon maaf, sebagai konsultan properti virtual JakUrban AI, saya khusus dirancang untuk membantu Anda seputar pencarian hunian, spesifikasi cluster, serta simulasi KPR. Kebetulan kami memiliki beberapa unit menarik di Jakarta, apakah Anda ingin melihat rekomendasi hunian berdasarkan lokasi atau budget Anda?";
        }

        // 3. Guardrail Diskon / Promo Fiktif
        if (q.Contains("diskon") || q.Contains("potongan harga") || q.Contains("nego") || q.Contains("cashback") || q.Contains("gratis biaya") ||
            q.Contains("discount") || q.Contains("price cut") || q.Contains("cash back") || q.Contains("free fees"))
        {
            return isEnglish
                ? "To ensure you receive accurate official pricing, I can't promise a specific discount in this chat. Please contact our official marketing team on WhatsApp at +62 878 1911 2003 to discuss current offers. Would you like a mortgage estimate for a particular home?"
                : "Untuk menjaga keakuratan informasi harga resmi developer, saya tidak berwenang menjanjikan nominal diskon khusus di ruang chat ini.\n\n" +
                  "Namun, Anda sangat disarankan berdiskusi langsung mengenai promo cara bayar atau penawaran spesial bersama Tim Marketing Resmi kami melalui WhatsApp di nomor +62 878 1911 2003. Sambil menunggu, apakah ada tipe unit tertentu yang ingin saya hitungkan estimasi cicilan KPR-nya terlebih dahulu?";
        }

        if (!projects.Any())
        {
            return isEnglish
                ? "There are no properties in the catalog yet. Please check back later while our team updates the listings."
                : "Saat ini belum ada project properti yang terdaftar di database PostgreSQL. Silakan login ke Dashboard Admin untuk menambahkan Project dan Unit terlebih dahulu.";
        }

        var ranked = RankUnitsSemantically(userMessage, projects);

        // 4. Simulasi KPR Presisi (Mencocokkan Nama Unit & Nama Cluster secara akurat)
        if (q.Contains("kpr") || q.Contains("cicil") || q.Contains("simulasi") || q.Contains("angsuran") || q.Contains("dp") ||
            q.Contains("mortgage") || q.Contains("installment") || q.Contains("down payment"))
        {
            var bestCandidate = ranked.FirstOrDefault(r => NormalizeUnitPrice(r.Unit.Price) > 0);

            if (bestCandidate != null && bestCandidate.Score >= 15)
            {
                decimal price = NormalizeUnitPrice(bestCandidate.Unit.Price);
                decimal dp30 = price * 0.30m;
                decimal loan = price - dp30;
                double r = 0.075 / 12.0;
                int n20 = 240;
                int n15 = 180;
                decimal monthly20 = (decimal)((double)loan * (r * Math.Pow(1 + r, n20)) / (Math.Pow(1 + r, n20) - 1));
                decimal monthly15 = (decimal)((double)loan * (r * Math.Pow(1 + r, n15)) / (Math.Pow(1 + r, n15) - 1));
                var cleanLoc = FormatKecamatanLocation(bestCandidate.Project.Location);
                var clusterRange = GetProjectPriceRangeText(bestCandidate.Project, isEnglish);

                finalRecommendations = new List<object> { bestCandidate.UnitCard };

                return isEnglish
                    ? $"Here is an estimated mortgage plan for unit {bestCandidate.Unit.Title} at {bestCandidate.Project.Name} ({cleanLoc}):\n\n" +
                        $"• Cluster price range: {clusterRange}\n" +
                        $"• Unit price: {FormatCompactRupiah(price, true)} (land {bestCandidate.Unit.LandArea}m² / building {bestCandidate.Unit.BuildArea}m², {bestCandidate.Unit.Beds} bedrooms)\n" +
                        $"• Estimated down payment (30%): {FormatCompactRupiah(dp30, true)}\n" +
                        $"• Estimated loan (70%): {FormatCompactRupiah(loan, true)}\n" +
                        $"• Assumed interest rate: 7.5% effective per year\n" +
                        $"• Estimated monthly payment, 15 years: {FormatCompactRupiah(Math.Round(monthly15, 0), true)}\n" +
                        $"• Estimated monthly payment, 20 years: {FormatCompactRupiah(Math.Round(monthly20, 0), true)}\n\n" +
                        $"Would you like to compare this with another unit at {bestCandidate.Project.Name}?"
                    : $"Tentu, berikut rincian estimasi Simulasi KPR untuk unit {bestCandidate.Unit.Title} di {bestCandidate.Project.Name} ({cleanLoc}):\n\n" +
                        $"• Kisaran Harga Cluster {bestCandidate.Project.Name}: {clusterRange}\n" +
                        $"• Harga Resmi Unit {bestCandidate.Unit.Title}: {FormatCompactRupiah(price)} (LT {bestCandidate.Unit.LandArea}m² / LB {bestCandidate.Unit.BuildArea}m², {bestCandidate.Unit.Beds} KT)\n" +
                        $"• Estimasi Uang Muka (DP 30%): {FormatCompactRupiah(dp30)}\n" +
                        $"• Plafon Pinjaman KPR (70%): {FormatCompactRupiah(loan)}\n" +
                        $"• Asumsi Suku Bunga: 7.5% efektif per tahun\n" +
                        $"• Estimasi Angsuran Tenor 15 Tahun: {FormatCompactRupiah(Math.Round(monthly15, 0))} / bulan\n" +
                        $"• Estimasi Angsuran Tenor 20 Tahun: {FormatCompactRupiah(Math.Round(monthly20, 0))} / bulan\n\n" +
                        $"Apakah skema cicilan di atas sudah cukup sesuai dengan rencana finansial Anda, atau Anda ingin membandingkan dengan tipe unit lain di {bestCandidate.Project.Name}?";
            }

            // Jika pengguna bertanya KPR secara umum tanpa menyebut unit spesifik
            var sampleProjects = projects.Take(3).Select(p =>
                isEnglish
                    ? $"• {p.Name} ({FormatKecamatanLocation(p.Location)}) — Price range: {GetProjectPriceRangeText(p, true)}"
                    : $"• {p.Name} ({FormatKecamatanLocation(p.Location)}) — Kisaran Harga: {GetProjectPriceRangeText(p)}"
            );

            return isEnglish
                ? "I'd be happy to help estimate your mortgage. Our estimates use a 7.5% effective annual interest rate, with a down payment of 10–30% and terms of up to 20 years.\n\n" +
                  "Available clusters and price ranges:\n" +
                  string.Join("\n", sampleProjects) +
                  "\n\nWhich cluster or unit would you like an estimated monthly payment for?"
                : "Dengan senang hati saya bantu hitungkan simulasi KPR-nya. Di JakUrban, skema KPR kami menggunakan asumsi suku bunga 7.5% efektif per tahun dengan DP mulai 10% hingga 30% dan tenor sampai 20 tahun.\n\n" +
                  "Saat ini kami memiliki beberapa pilihan cluster dengan rentang harga berikut:\n" +
                  string.Join("\n", sampleProjects) +
                  "\n\nCluster atau tipe unit mana yang ingin Anda hitungkan rincian angsuran bulanannya?";
        }

        // Cek apakah pertanyaan cocok dengan Dokumen Knowledge Base Super Admin
        var kbMatches = LoadKnowledgeDocs()
            .Where(d =>
                Regex.Matches(q, @"[a-z0-9]+")
                    .Select(m => m.Value)
                    .Where(w => w.Length > 2 && !StopWords.Contains(w))
                    .Any(token => ($"{d.Title} {d.Category} {d.Content}").Contains(token, StringComparison.OrdinalIgnoreCase)))
            .Take(2)
            .ToList();

        // 5. Konsultasi & Rekomendasi Properti: JANGAN batasi .Take(3) agar seluruh unit di cluster (misal 10 unit) tampil utuh!
        var topRanked = ranked.ToList();
        finalRecommendations = topRanked.Select(r => r.UnitCard).ToList();

        var groupedByProject = topRanked.GroupBy(r => r.Project.Id).Select(g =>
        {
            var proj = g.First().Project;
            var cleanLoc = FormatKecamatanLocation(proj.Location);
            var rangeText = GetProjectPriceRangeText(proj, isEnglish);
            var unitsDesc = string.Join("\n", g.Select(item =>
                isEnglish
                    ? $"  - Unit {item.Unit.Title}: {FormatCompactRupiah(item.Unit.Price, true)} | land {item.Unit.LandArea}m² / building {item.Unit.BuildArea}m² | {item.Unit.Beds} bedrooms, {item.Unit.Baths} bathrooms ({item.Unit.Status})"
                    : $"  - Unit {item.Unit.Title}: {FormatCompactRupiah(item.Unit.Price)} | LT {item.Unit.LandArea}m² / LB {item.Unit.BuildArea}m² | {item.Unit.Beds} KT, {item.Unit.Baths} KM ({item.Unit.Status})"));

            return isEnglish
                ? $"{proj.Name} ({cleanLoc}) — {g.Count()} unit types:\n• Cluster price range: {rangeText}\n{unitsDesc}"
                : $"{proj.Name} ({cleanLoc}) — Total {g.Count()} Tipe Unit:\n• Kisaran Harga Cluster: {rangeText}\n{unitsDesc}";
        });

        var kbSection = kbMatches.Any()
            ? (isEnglish
                ? "\n\nAdditional information from official company documents:\n"
                : "\n\nInformasi Tambahan Berdasarkan Dokumen Resmi Perusahaan:\n") +
              string.Join("\n\n", kbMatches.Select(d => $"• {d.Title} ({d.Category}):\n{d.Content}"))
            : "";

        return isEnglish
            ? "Based on our latest property listings, here are the matching clusters and unit types:\n\n" +
              string.Join("\n\n", groupedByProject) +
              kbSection +
              "\n\nWhich unit would you like a mortgage estimate for, or would you like to schedule a visit?"
            : "Berdasarkan data inventaris terbaru kami, berikut rincian lengkap cluster beserta seluruh tipe unit yang sesuai:\n\n" +
              string.Join("\n\n", groupedByProject) +
              kbSection +
              "\n\nDari daftar unit di atas, unit mana yang ingin Anda hitungkan simulasi cicilan KPR-nya atau jadwalkan survei lokasi?";
    }

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "ada", "apa", "apakah", "yang", "dan", "di", "ke", "dari", "untuk", "dengan",
        "saya", "aku", "mau", "cari", "tampilkan", "daftar", "saat", "ini", "tolong",
        "bisa", "minta", "info", "informasi", "project", "properti", "rumah", "unit", "cluster", "hitung"
    };
}