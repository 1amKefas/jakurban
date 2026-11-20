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

    private static readonly ConcurrentDictionary<string, float[]> _embeddingCache = new(StringComparer.OrdinalIgnoreCase);
    private static string? _detectedOllamaModel;

    public OpenAiEmbeddingService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<OpenAiEmbeddingService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    private string GetOllamaBaseUrl() =>
        (_configuration["Ollama:BaseUrl"]?.Trim() ?? "http://localhost:11434").TrimEnd('/');

    private List<string> GetValidGeminiApiKeys()
    {
        var items = new List<string>();
        var arr = _configuration.GetSection("Gemini:ApiKeys").Get<string[]>();
        if (arr != null) items.AddRange(arr);

        var single = _configuration["Gemini:ApiKey"];
        if (!string.IsNullOrWhiteSpace(single))
            items.AddRange(single.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries));

        return items
            .Select(k => k.Trim())
            .Where(k => !string.IsNullOrWhiteSpace(k) &&
                        !k.StartsWith("PASTE_", StringComparison.OrdinalIgnoreCase) &&
                        !k.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

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

    /// <summary>
    /// Mengecek daftar model yang ter-install di Ollama lokal (http://localhost:11434/api/tags).
    /// Jika model di appsettings.json sudah ter-install maka dipakai; jika belum, otomatis memakai model pertama yang tersedia di Ollama.
    /// </summary>
    private async Task<string?> ResolveAvailableOllamaModelAsync(string baseUrl, string preferredModel)
    {
        if (!string.IsNullOrWhiteSpace(_detectedOllamaModel))
        {
            return _detectedOllamaModel;
        }

        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            using var response = await _httpClient.GetAsync($"{baseUrl}/api/tags", cts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("models", out var modelsArr) || modelsArr.GetArrayLength() == 0)
            {
                return null;
            }

            var installedModels = new List<string>();
            foreach (var item in modelsArr.EnumerateArray())
            {
                if (item.TryGetProperty("name", out var nameElem))
                {
                    var name = nameElem.GetString();
                    if (!string.IsNullOrWhiteSpace(name) && !name.Contains("embed", StringComparison.OrdinalIgnoreCase))
                    {
                        installedModels.Add(name);
                    }
                }
            }

            if (installedModels.Count == 0) return null;

            // Cek apakah model yang diset di appsettings.json ada di daftar ollama list
            var exactOrPrefixMatch = installedModels.FirstOrDefault(m =>
                m.Equals(preferredModel, StringComparison.OrdinalIgnoreCase) ||
                m.StartsWith(preferredModel + ":", StringComparison.OrdinalIgnoreCase));

            _detectedOllamaModel = exactOrPrefixMatch ?? installedModels[0];
            _logger.LogInformation("Ollama aktif! Menggunakan model lokal: {Model}", _detectedOllamaModel);
            return _detectedOllamaModel;
        }
        catch
        {
            return null;
        }
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

        var embeddingModel = _configuration["Gemini:EmbeddingModel"]?.Trim() ?? "gemini-embedding-001";

        foreach (var apiKey in apiKeys)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(6));
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
                if (!response.IsSuccessStatusCode) continue;

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
            catch
            {
                // Lanjut jika embedding gagal
            }
        }

        return Array.Empty<float>();
    }

    public async Task<string?> GenerateChatCompletionAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history = null)
    {
        // =========================================================================
        // 1. PRIORITAS UTAMA: OLLAMA LOKAL (Bebas 503, Bebas Limit Kuota, 100% LLM)
        // =========================================================================
        var ollamaBaseUrl = GetOllamaBaseUrl();
        var configuredOllamaModel = _configuration["Ollama:ChatModel"]?.Trim() ?? "gemma3:4b";
        var activeOllamaModel = await ResolveAvailableOllamaModelAsync(ollamaBaseUrl, configuredOllamaModel);

        if (!string.IsNullOrWhiteSpace(activeOllamaModel))
        {
            try
            {
                var ollamaMessages = new List<object>
                {
                    new { role = "system", content = systemPrompt }
                };

                if (history != null)
                {
                    foreach (var turn in history.TakeLast(8))
                    {
                        if (string.IsNullOrWhiteSpace(turn.Content)) continue;
                        ollamaMessages.Add(new
                        {
                            role = turn.Role == "user" ? "user" : "assistant",
                            content = turn.Content
                        });
                    }
                }

                ollamaMessages.Add(new { role = "user", content = userMessage });

                var ollamaPayload = JsonSerializer.Serialize(new
                {
                    model = activeOllamaModel,
                    messages = ollamaMessages,
                    stream = false,
                    options = new
                    {
                        temperature = 0.65,
                        top_p = 0.95,
                        num_ctx = 4096
                    }
                });

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(45));
                using var request = new HttpRequestMessage(HttpMethod.Post, $"{ollamaBaseUrl}/api/chat")
                {
                    Content = new StringContent(ollamaPayload, Encoding.UTF8, "application/json")
                };

                using var response = await _httpClient.SendAsync(request, cts.Token);
                if (response.IsSuccessStatusCode)
                {
                    var jsonString = await response.Content.ReadAsStringAsync(cts.Token);
                    using var doc = JsonDocument.Parse(jsonString);

                    if (doc.RootElement.TryGetProperty("message", out var msgElem) &&
                        msgElem.TryGetProperty("content", out var contentElem))
                    {
                        var reply = contentElem.GetString()?.Trim();
                        if (!string.IsNullOrWhiteSpace(reply))
                        {
                            _logger.LogInformation("Respons berhasil di-generate oleh Ollama ({Model}).", activeOllamaModel);
                            return reply.Replace("**", "");
                        }
                    }
                }
                else
                {
                    var err = await response.Content.ReadAsStringAsync(cts.Token);
                    _logger.LogWarning("Ollama merespons {Status}: {Err}", response.StatusCode, err);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Panggilan ke Ollama lokal gagal/timeout: {Msg}. Mencoba fallback Gemini...", ex.Message);
            }
        }

        // =========================================================================
        // 2. FALLBACK CADANGAN: GEMINI API (Jika dijalankan di server tanpa Ollama)
        // =========================================================================
        var apiKeys = GetValidGeminiApiKeys();
        if (apiKeys.Count == 0) return null;

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
                contents.RemoveAt(contents.Count - 1);
        }

        contents.Add(new
        {
            role = "user",
            parts = new[] { new { text = userMessage } }
        });

        var geminiPayload = JsonSerializer.Serialize(new
        {
            system_instruction = new { parts = new[] { new { text = systemPrompt } } },
            contents = contents,
            generationConfig = new
            {
                temperature = 0.65,
                topP = 0.95,
                maxOutputTokens = 1500,
                thinkingConfig = new { thinkingBudget = 0 }
            }
        });

        foreach (var apiKey in apiKeys)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={apiKey}";
                using var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(geminiPayload, Encoding.UTF8, "application/json")
                };

                using var res = await _httpClient.SendAsync(req, cts.Token);
                if (!res.IsSuccessStatusCode) continue;

                var raw = await res.Content.ReadAsStringAsync(cts.Token);
                using var doc = JsonDocument.Parse(raw);
                if (doc.RootElement.TryGetProperty("candidates", out var cands) && cands.GetArrayLength() > 0)
                {
                    var text = cands[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                        return text.Replace("**", "");
                }
            }
            catch
            {
                // Abaikan jika Gemini sedang 503
            }
        }

        return null;
    }
}