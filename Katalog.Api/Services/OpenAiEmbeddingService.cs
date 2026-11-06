using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;

namespace Katalog.Api.Services;

public class OpenAiEmbeddingService : IEmbeddingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OpenAiEmbeddingService> _logger;
    private const int TargetVectorDimension = 1536;

    // Cache vektor di memori agar kueri yang sama instan (0ms)
    private static readonly ConcurrentDictionary<string, float[]> _embeddingCache = new(StringComparer.OrdinalIgnoreCase);

    // Cooldown spesifik per kombinasi (ApiKey + Model) agar jika 1 model/key terkena 429, key/model lain tetap jalan normal
    private static readonly ConcurrentDictionary<string, DateTime> _keyModelCooldowns = new(StringComparer.OrdinalIgnoreCase);

    // Indeks Round-Robin agar beban trafik terbagi rata antar API Key
    private static int _roundRobinIndex = 0;

    public OpenAiEmbeddingService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<OpenAiEmbeddingService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    /// Membaca daftar nilai konfigurasi baik dari format JSON Array maupun string yang dipisahkan koma/titik koma.
    private IEnumerable<string> ReadConfigList(string arraySectionKey, params string[] singleValueKeys)
    {
        var items = new List<string>();

        var arrayValues = _configuration.GetSection(arraySectionKey).Get<string[]>();
        if (arrayValues != null)
        {
            items.AddRange(arrayValues);
        }

        foreach (var key in singleValueKeys)
        {
            var raw = _configuration[key];
            if (!string.IsNullOrWhiteSpace(raw))
            {
                items.AddRange(raw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries));
            }
        }

        return items.Select(v => v.Trim()).Where(v => !string.IsNullOrWhiteSpace(v));
    }

    /// Mengambil daftar seluruh API Key yang valid (mengabaikan teks placeholder cadangan).
    private List<string> GetValidGeminiApiKeys() =>
        ReadConfigList("Gemini:ApiKeys", "Gemini:ApiKey", "OpenAI:ApiKey")
            .Where(k => !k.StartsWith("PASTE_", StringComparison.OrdinalIgnoreCase) &&
                        !k.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) &&
                        !k.Contains("CADANGAN", StringComparison.OrdinalIgnoreCase) &&
                        !k.Contains("API_KEY", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.Ordinal)
            .ToList();

    /// Mengambil daftar kandidat model Chat secara berurutan untuk mekanisme Multi-Model Auto-Failover.
    private List<string> GetCandidateChatModels() =>
        ReadConfigList("Gemini:ChatModels", "Gemini:ChatModel")
            .Concat(new[]
            {
                "gemini-3.8-flash",
                "gemini-3.6-flash",
                "gemini-3.5-flash"
            })
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    private static bool IsSlotAvailable(string apiKey, string modelName)
    {
        var slotKey = $"{apiKey}::{modelName}";
        if (_keyModelCooldowns.TryGetValue(slotKey, out var until))
        {
            if (DateTime.UtcNow < until) return false;
            _keyModelCooldowns.TryRemove(slotKey, out _);
        }
        return true;
    }

    private static void MarkSlotCooldown(string apiKey, string modelName, int seconds)
    {
        var slotKey = $"{apiKey}::{modelName}";
        _keyModelCooldowns[slotKey] = DateTime.UtcNow.AddSeconds(seconds);
    }

    private static string MaskKey(string key) =>
        key.Length <= 8 ? "***" : $"{key[..4]}...{key[^4..]}";

    private static float[] NormalizeAndFitDimension(float[] rawVector)
    {
        if (rawVector.Length == 0) return Array.Empty<float>();

        var fitted = new float[TargetVectorDimension];
        var copyLength = Math.Min(rawVector.Length, TargetVectorDimension);
        Array.Copy(rawVector, fitted, copyLength);

        double sumSquares = 0;
        for (int i = 0; i < TargetVectorDimension; i++)
        {
            sumSquares += (double)fitted[i] * fitted[i];
        }

        double norm = Math.Sqrt(sumSquares);
        if (norm > 1e-12)
        {
            for (int i = 0; i < TargetVectorDimension; i++)
            {
                fitted[i] = (float)(fitted[i] / norm);
            }
        }

        return fitted;
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text)
    {
        var apiKeys = GetValidGeminiApiKeys();
        if (apiKeys.Count == 0 || string.IsNullOrWhiteSpace(text))
        {
            return Array.Empty<float>();
        }

        var cleanText = text.Trim();
        if (_embeddingCache.TryGetValue(cleanText, out var cachedVector))
        {
            return cachedVector;
        }

        var embeddingModel = _configuration["Gemini:EmbeddingModel"]?.Trim();
        if (string.IsNullOrWhiteSpace(embeddingModel))
        {
            embeddingModel = "gemini-embedding-001";
        }

        foreach (var apiKey in apiKeys)
        {
            if (!IsSlotAvailable(apiKey, embeddingModel)) continue;

            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{embeddingModel}:embedContent?key={apiKey}";

                var requestBody = new
                {
                    model = $"models/{embeddingModel}",
                    content = new
                    {
                        parts = new[] { new { text = cleanText } }
                    },
                    outputDimensionality = TargetVectorDimension
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
                };

                using var response = await _httpClient.SendAsync(request, cts.Token);
                if (!response.IsSuccessStatusCode)
                {
                    var statusCode = (int)response.StatusCode;
                    // Jika 429 (kuota habis) atau 401/403, kunci key ini sementara lalu coba API Key berikutnya
                    if (statusCode == 429 || statusCode == 401 || statusCode == 403)
                    {
                        MarkSlotCooldown(apiKey, embeddingModel, statusCode == 429 ? 300 : 600);
                    }
                    continue;
                }

                var jsonString = await response.Content.ReadAsStringAsync(cts.Token);
                using var doc = JsonDocument.Parse(jsonString);

                if (doc.RootElement.TryGetProperty("embedding", out var embeddingElem) &&
                    embeddingElem.TryGetProperty("values", out var valuesElem))
                {
                    var rawValues = valuesElem
                        .EnumerateArray()
                        .Select(e => e.GetSingle())
                        .ToArray();

                    var normalized = NormalizeAndFitDimension(rawValues);
                    if (normalized.Length == TargetVectorDimension)
                    {
                        _embeddingCache[cleanText] = normalized;
                    }
                    return normalized;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Embedding dengan key {Key} dilewati ({Msg}), mencoba key berikutnya...", MaskKey(apiKey), ex.Message);
            }
        }

        return Array.Empty<float>();
    }

    public async Task<string?> GenerateChatCompletionAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history = null)
    {
        var apiKeys = GetValidGeminiApiKeys();
        if (apiKeys.Count == 0)
        {
            return null;
        }

        var candidateModels = GetCandidateChatModels();

        var contents = new List<object>();
        if (history != null)
        {
            string? lastRole = null;
            foreach (var turn in history.TakeLast(6))
            {
                if (string.IsNullOrWhiteSpace(turn.Content)) continue;
                var mappedRole = turn.Role == "user" ? "user" : "model";

                if (contents.Count == 0 && mappedRole != "user") continue;
                if (mappedRole == lastRole) continue;

                contents.Add(new
                {
                    role = mappedRole,
                    parts = new[] { new { text = turn.Content } }
                });
                lastRole = mappedRole;
            }

            if (lastRole == "user" && contents.Count > 0)
            {
                contents.RemoveAt(contents.Count - 1);
            }
        }

        contents.Add(new
        {
            role = "user",
            parts = new[] { new { text = userMessage } }
        });

        var requestBody = new
        {
            system_instruction = new
            {
                parts = new[] { new { text = systemPrompt } }
            },
            contents = contents,
            generationConfig = new
            {
                temperature = 0.2,
                topP = 0.95,
                maxOutputTokens = 650
            }
        };

        var jsonPayload = JsonSerializer.Serialize(requestBody);
        int startKeyIdx = Math.Abs(Interlocked.Increment(ref _roundRobinIndex));

        // Iterasi seluruh kandidat Model dan seluruh API Key (Failover Otomatis)
        foreach (var modelName in candidateModels)
        {
            for (int k = 0; k < apiKeys.Count; k++)
            {
                var apiKey = apiKeys[(startKeyIdx + k) % apiKeys.Count];
                if (!IsSlotAvailable(apiKey, modelName))
                {
                    continue;
                }

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent?key={apiKey}";

                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    using var request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
                    };

                    using var response = await _httpClient.SendAsync(request, cts.Token);
                    if (!response.IsSuccessStatusCode)
                    {
                        var statusCode = (int)response.StatusCode;
                        _logger.LogWarning(
                            "Gemini API (Model: {Model}, Key: {Key}) merespons {Status}. Beralih ke API Key / Model cadangan...",
                            modelName, MaskKey(apiKey), response.StatusCode);

                        // Jika 429 (Quota Exceeded), istirahatkan kombinasi Key+Model ini selama 10 menit dan langsung lanjut ke key/model berikutnya!
                        if (statusCode == 429)
                        {
                            MarkSlotCooldown(apiKey, modelName, 600);
                        }
                        else if (statusCode == 401 || statusCode == 403 || statusCode == 404)
                        {
                            MarkSlotCooldown(apiKey, modelName, 1800);
                        }
                        else
                        {
                            MarkSlotCooldown(apiKey, modelName, 60);
                        }

                        continue;
                    }

                    var jsonString = await response.Content.ReadAsStringAsync(cts.Token);
                    using var doc = JsonDocument.Parse(jsonString);

                    if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                        candidates.GetArrayLength() > 0)
                    {
                        var firstCandidate = candidates[0];
                        if (firstCandidate.TryGetProperty("content", out var contentObj) &&
                            contentObj.TryGetProperty("parts", out var partsArr) &&
                            partsArr.GetArrayLength() > 0)
                        {
                            var textResult = partsArr[0].GetProperty("text").GetString();
                            if (!string.IsNullOrWhiteSpace(textResult))
                            {
                                return textResult.Replace("**", "");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    MarkSlotCooldown(apiKey, modelName, 45);
                    _logger.LogWarning(
                        "Timeout/Error pada Model {Model} (Key {Key}): {Msg}. Mencoba fallback berikutnya...",
                        modelName, MaskKey(apiKey), ex.Message);
                }
            }
        }

        return null;
    }
}