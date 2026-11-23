using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Katalog.Api.Services;

public class OpenAiEmbeddingService : IEmbeddingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OpenAiEmbeddingService> _logger;
    private const int TargetVectorDimension = 1536;

    private static readonly ConcurrentDictionary<string, float[]> _embeddingCache = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, DateTime> _keyModelCooldowns = new(StringComparer.OrdinalIgnoreCase);
    private static int _roundRobinIndex = 0;

    private static string? _cachedModelKey;
    private static string? _cachedModelName;
    private static DateTime _cachedModelExpiry = DateTime.MinValue;

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
        (_configuration["Ollama:BaseUrl"]?.Trim() ?? "http://127.0.0.1:11434").TrimEnd('/');

    private int GetOllamaNumCtx() =>
        int.TryParse(_configuration["Ollama:NumCtx"], out var parsedCtx) && parsedCtx >= 2048
            ? parsedCtx
            : 4096;

    private bool PreferGemini() =>
        bool.TryParse(_configuration["Gemini:PreferOverOllama"], out var prefer) && prefer;

    private bool PreferCloudLlm() =>
        bool.TryParse(_configuration["CloudLlm:PreferOverOllama"], out var prefer) && prefer;

    private IEnumerable<string> ReadConfigList(string arraySectionKey, params string[] singleValueKeys)
    {
        var items = new List<string>();
        var arrayValues = _configuration.GetSection(arraySectionKey).Get<string[]>();
        if (arrayValues != null) items.AddRange(arrayValues);

        foreach (var key in singleValueKeys)
        {
            var raw = _configuration[key];
            if (!string.IsNullOrWhiteSpace(raw))
                items.AddRange(raw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries));
        }

        return items.Select(v => v.Trim()).Where(v => !string.IsNullOrWhiteSpace(v));
    }

    private List<string> GetValidGeminiApiKeys() =>
        ReadConfigList("Gemini:ApiKeys", "Gemini:ApiKey")
            .Where(k => !k.StartsWith("PASTE_", StringComparison.OrdinalIgnoreCase) &&
                        !k.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase) &&
                        !k.Contains("CADANGAN", StringComparison.OrdinalIgnoreCase) &&
                        !k.Contains("API_KEY", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.Ordinal)
            .ToList();

    private List<string> GetCandidateGeminiModels()
    {
        var configured = ReadConfigList("Gemini:ChatModels", "Gemini:ChatModel").ToList();
        if (configured.Count == 0)
        {
            configured.AddRange(new[] { "gemini-3.8-flash", "gemini-3.5-flash-lite" });
        }
        return configured.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

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

    private static void MarkSlotCooldown(string apiKey, string modelName, int seconds) =>
        _keyModelCooldowns[$"{apiKey}::{modelName}"] = DateTime.UtcNow.AddSeconds(seconds);

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
            sumSquares += (double)fitted[i] * fitted[i];

        double norm = Math.Sqrt(sumSquares);
        if (norm > 1e-12)
        {
            for (int i = 0; i < TargetVectorDimension; i++)
                fitted[i] = (float)(fitted[i] / norm);
        }

        return fitted;
    }

    private static string CleanLlmOutput(string raw) =>
        Regex.Replace(raw, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase).Trim();

    private async Task<string?> ResolveAvailableOllamaModelAsync(string baseUrl, string preferredModel, CancellationToken ct = default)
    {
        var cacheKey = $"{baseUrl}::{preferredModel}";
        if (_cachedModelKey == cacheKey && DateTime.UtcNow < _cachedModelExpiry)
            return _cachedModelName;

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(2));
            using var response = await _httpClient.GetAsync($"{baseUrl}/api/tags", cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                _cachedModelKey = cacheKey;
                _cachedModelName = null;
                _cachedModelExpiry = DateTime.UtcNow.AddMinutes(2);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("models", out var modelsArr) || modelsArr.GetArrayLength() == 0)
                return null;

            var installedModels = new List<string>();
            foreach (var item in modelsArr.EnumerateArray())
            {
                if (item.TryGetProperty("name", out var nameElem))
                {
                    var name = nameElem.GetString();
                    if (!string.IsNullOrWhiteSpace(name) && !name.Contains("embed", StringComparison.OrdinalIgnoreCase))
                        installedModels.Add(name);
                }
            }

            if (installedModels.Count == 0) return null;

            var exactOrPrefixMatch = installedModels.FirstOrDefault(m =>
                m.Equals(preferredModel, StringComparison.OrdinalIgnoreCase) ||
                m.StartsWith(preferredModel + ":", StringComparison.OrdinalIgnoreCase));

            var resolved = exactOrPrefixMatch
                ?? installedModels.FirstOrDefault(m => m.Contains(":4b", StringComparison.OrdinalIgnoreCase))
                ?? installedModels.FirstOrDefault(m => m.Contains(":3b", StringComparison.OrdinalIgnoreCase))
                ?? installedModels[0];

            _cachedModelKey = cacheKey;
            _cachedModelName = resolved;
            _cachedModelExpiry = DateTime.UtcNow.AddMinutes(2);
            _logger.LogInformation("Ollama aktif! Model terpilih: {Model}", resolved);
            return resolved;
        }
        catch
        {
            _cachedModelKey = cacheKey;
            _cachedModelName = null;
            _cachedModelExpiry = DateTime.UtcNow.AddMinutes(2);
            return null;
        }
    }

    private List<object> BuildStandardMessages(string systemPrompt, string userMessage, IEnumerable<ChatTurnDto>? history)
    {
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        if (history != null)
        {
            foreach (var turn in history.TakeLast(6))
            {
                if (string.IsNullOrWhiteSpace(turn.Content)) continue;
                messages.Add(new
                {
                    role = turn.Role == "user" ? "user" : "assistant",
                    content = turn.Content
                });
            }
        }

        messages.Add(new { role = "user", content = userMessage });
        return messages;
    }

    private List<object> BuildGeminiContents(string userMessage, IEnumerable<ChatTurnDto>? history)
    {
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

                contents.Add(new { role = mappedRole, parts = new[] { new { text = turn.Content } } });
                lastRole = mappedRole;
            }
            if (lastRole == "user" && contents.Count > 0)
                contents.RemoveAt(contents.Count - 1);
        }

        contents.Add(new { role = "user", parts = new[] { new { text = userMessage } } });
        return contents;
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text)
    {
        var apiKeys = GetValidGeminiApiKeys();
        if (apiKeys.Count == 0 || string.IsNullOrWhiteSpace(text))
            return Array.Empty<float>();

        var cleanText = text.Trim();
        if (_embeddingCache.TryGetValue(cleanText, out var cachedVector))
            return cachedVector;

        var embeddingModel = _configuration["Gemini:EmbeddingModel"]?.Trim() ?? "gemini-embedding-001";

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
                    content = new { parts = new[] { new { text = cleanText } } },
                    outputDimensionality = TargetVectorDimension
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
                };

                using var response = await _httpClient.SendAsync(request, cts.Token);
                if (!response.IsSuccessStatusCode)
                {
                    var code = (int)response.StatusCode;
                    if (code == 429 || code == 401 || code == 403)
                        MarkSlotCooldown(apiKey, embeddingModel, code == 429 ? 300 : 600);
                    continue;
                }

                var jsonString = await response.Content.ReadAsStringAsync(cts.Token);
                using var doc = JsonDocument.Parse(jsonString);

                if (doc.RootElement.TryGetProperty("embedding", out var embeddingElem) &&
                    embeddingElem.TryGetProperty("values", out var valuesElem))
                {
                    var rawValues = valuesElem.EnumerateArray().Select(e => e.GetSingle()).ToArray();
                    var normalized = NormalizeAndFitDimension(rawValues);
                    if (normalized.Length == TargetVectorDimension)
                        _embeddingCache[cleanText] = normalized;
                    return normalized;
                }
            }
            catch { }
        }

        return Array.Empty<float>();
    }

    /// <summary>
    /// Streaming native token-per-token dari Google Gemini (SSE) dengan thinkingBudget = 0
    /// dan Multi-Key / Multi-Model Auto-Failover agar performanya secepat Ollama.
    /// </summary>
    private async IAsyncEnumerable<string> StreamGeminiAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var apiKeys = GetValidGeminiApiKeys();
        if (apiKeys.Count == 0) yield break;

        var candidateModels = GetCandidateGeminiModels();
        var contents = BuildGeminiContents(userMessage, history);
        int startKeyIdx = Math.Abs(Interlocked.Increment(ref _roundRobinIndex));

        foreach (var modelName in candidateModels)
        {
            var genConfig = new Dictionary<string, object>
            {
                ["temperature"] = 0.45,
                ["topP"] = 0.9,
                ["maxOutputTokens"] = 1024
            };

            // Matikan internal thinking pada seri Gemini 2.5 / 3.x agar TTFT < 1 detik seperti Ollama
            if (modelName.Contains("2.5", StringComparison.OrdinalIgnoreCase) ||
                modelName.Contains("3.", StringComparison.OrdinalIgnoreCase))
            {
                genConfig["thinkingConfig"] = new { thinkingBudget = 0 };
            }

            var payload = JsonSerializer.Serialize(new
            {
                system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                contents,
                generationConfig = genConfig
            });

            for (int k = 0; k < apiKeys.Count; k++)
            {
                var apiKey = apiKeys[(startKeyIdx + k) % apiKeys.Count];
                if (!IsSlotAvailable(apiKey, modelName)) continue;

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelName}:streamGenerateContent?alt=sse&key={apiKey}";
                HttpResponseMessage? response = null;

                try
                {
                    // Batas 8 detik hanya untuk menunggu header awal agar failover cepat jika server sibuk
                    using var headerCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    headerCts.CancelAfter(TimeSpan.FromSeconds(8));

                    var req = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = new StringContent(payload, Encoding.UTF8, "application/json")
                    };

                    response = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, headerCts.Token);
                    if (!response.IsSuccessStatusCode)
                    {
                        var statusCode = (int)response.StatusCode;
                        _logger.LogWarning(
                            "Gemini stream ({Model}, Key {Key}) merespons {Status}. Beralih ke fallback...",
                            modelName, MaskKey(apiKey), response.StatusCode);

                        MarkSlotCooldown(apiKey, modelName, statusCode switch
                        {
                            429 => 300,
                            401 or 403 or 404 => 1800,
                            _ => 45
                        });

                        response.Dispose();
                        response = null;
                        continue;
                    }
                }
                catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
                {
                    _logger.LogWarning(
                        "Gemini stream ({Model}, Key {Key}) gagal/timeout ({Msg}). Mencoba fallback...",
                        modelName, MaskKey(apiKey), ex.Message);
                    MarkSlotCooldown(apiKey, modelName, 45);
                    response?.Dispose();
                    response = null;
                    continue;
                }

                bool yieldedAny = false;
                try
                {
                    await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                    using var reader = new StreamReader(stream);

                    while (!reader.EndOfStream && !cancellationToken.IsCancellationRequested)
                    {
                        var line = await reader.ReadLineAsync(cancellationToken);
                        if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                            continue;

                        var data = line[5..].Trim();
                        if (string.IsNullOrEmpty(data) || data == "[DONE]") continue;

                        List<string>? chunks = null;
                        try
                        {
                            using var doc = JsonDocument.Parse(data);
                            if (doc.RootElement.TryGetProperty("candidates", out var cands) &&
                                cands.GetArrayLength() > 0 &&
                                cands[0].TryGetProperty("content", out var contentObj) &&
                                contentObj.TryGetProperty("parts", out var partsArr))
                            {
                                foreach (var part in partsArr.EnumerateArray())
                                {
                                    // Lewati token internal thought jika model tetap mengirimkannya
                                    if (part.TryGetProperty("thought", out var thoughtElem) &&
                                        thoughtElem.ValueKind == JsonValueKind.True)
                                    {
                                        continue;
                                    }

                                    if (part.TryGetProperty("text", out var textElem))
                                    {
                                        var txt = textElem.GetString();
                                        if (!string.IsNullOrEmpty(txt))
                                        {
                                            chunks ??= new List<string>();
                                            chunks.Add(txt);
                                        }
                                    }
                                }
                            }
                        }
                        catch
                        {
                            continue;
                        }

                        if (chunks != null)
                        {
                            foreach (var c in chunks)
                            {
                                yieldedAny = true;
                                yield return c;
                            }
                        }
                    }
                }
                finally
                {
                    response.Dispose();
                }

                if (yieldedAny)
                {
                    _logger.LogInformation("Streaming selesai via Gemini ({Model}, Key {Key}).", modelName, MaskKey(apiKey));
                    yield break;
                }
            }
        }
    }

    private async IAsyncEnumerable<string> StreamCloudLlmAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var apiKey = _configuration["CloudLlm:ApiKey"]?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey)) yield break;

        var baseUrl = (_configuration["CloudLlm:BaseUrl"]?.Trim() ?? "https://api.groq.com/openai/v1").TrimEnd('/');
        var model = _configuration["CloudLlm:ChatModel"]?.Trim() ?? "llama-3.3-70b-versatile";

        var payload = JsonSerializer.Serialize(new
        {
            model,
            messages = BuildStandardMessages(systemPrompt, userMessage, history),
            stream = true,
            temperature = 0.45,
            top_p = 0.9,
            max_tokens = 1024
        });

        HttpResponseMessage? response = null;
        try
        {
            var req = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            response = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                response.Dispose();
                yield break;
            }
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Koneksi stream CloudLlm gagal: {Msg}", ex.Message);
            response?.Dispose();
            yield break;
        }

        bool insideThinkBlock = false;
        try
        {
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new StreamReader(stream);

            while (!reader.EndOfStream && !cancellationToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(cancellationToken);
                if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                    continue;

                var data = line[5..].Trim();
                if (data == "[DONE]") break;

                string? chunk = null;
                try
                {
                    using var doc = JsonDocument.Parse(data);
                    if (doc.RootElement.TryGetProperty("choices", out var choices) &&
                        choices.GetArrayLength() > 0 &&
                        choices[0].TryGetProperty("delta", out var delta) &&
                        delta.TryGetProperty("content", out var contentElem))
                    {
                        chunk = contentElem.GetString();
                    }
                }
                catch { continue; }

                if (!string.IsNullOrEmpty(chunk))
                {
                    if (chunk.Contains("<think>", StringComparison.OrdinalIgnoreCase)) { insideThinkBlock = true; continue; }
                    if (insideThinkBlock)
                    {
                        if (chunk.Contains("</think>", StringComparison.OrdinalIgnoreCase)) insideThinkBlock = false;
                        continue;
                    }
                    yield return chunk;
                }
            }
        }
        finally
        {
            response.Dispose();
        }
    }

    private async IAsyncEnumerable<string> StreamOllamaAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var ollamaBaseUrl = GetOllamaBaseUrl();
        var configuredOllamaModel = _configuration["Ollama:ChatModel"]?.Trim() ?? "qwen3.5:4b";
        var keepAlive = _configuration["Ollama:KeepAlive"]?.Trim() ?? "30m";
        var numCtx = GetOllamaNumCtx();

        var activeOllamaModel = await ResolveAvailableOllamaModelAsync(ollamaBaseUrl, configuredOllamaModel, cancellationToken);
        if (string.IsNullOrWhiteSpace(activeOllamaModel)) yield break;

        var payloadDict = new Dictionary<string, object>
        {
            ["model"] = activeOllamaModel,
            ["messages"] = BuildStandardMessages(systemPrompt, userMessage, history),
            ["stream"] = true,
            ["keep_alive"] = keepAlive,
            ["options"] = new
            {
                temperature = 0.45,
                top_p = 0.9,
                repeat_penalty = 1.15,
                repeat_last_n = 64,
                num_ctx = numCtx,
                num_predict = 1024
            }
        };

        if (activeOllamaModel.Contains("qwen3", StringComparison.OrdinalIgnoreCase) ||
            activeOllamaModel.Contains("gemma4", StringComparison.OrdinalIgnoreCase))
        {
            payloadDict["think"] = false;
        }

        HttpResponseMessage? response = null;
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, $"{ollamaBaseUrl}/api/chat")
            {
                Content = new StringContent(JsonSerializer.Serialize(payloadDict), Encoding.UTF8, "application/json")
            };

            response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                response.Dispose();
                yield break;
            }
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Koneksi stream Ollama gagal: {Msg}", ex.Message);
            response?.Dispose();
            yield break;
        }

        bool insideThinkBlock = false;
        try
        {
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new StreamReader(stream);

            while (!reader.EndOfStream && !cancellationToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(cancellationToken);
                if (string.IsNullOrWhiteSpace(line)) continue;

                string? chunk = null;
                bool isDone = false;

                try
                {
                    using var doc = JsonDocument.Parse(line);
                    if (doc.RootElement.TryGetProperty("done", out var doneElem) && doneElem.ValueKind == JsonValueKind.True)
                        isDone = true;

                    if (doc.RootElement.TryGetProperty("message", out var msgElem) &&
                        msgElem.TryGetProperty("content", out var contentElem))
                    {
                        chunk = contentElem.GetString();
                    }
                }
                catch { continue; }

                if (!string.IsNullOrEmpty(chunk))
                {
                    if (chunk.Contains("<think>", StringComparison.OrdinalIgnoreCase)) { insideThinkBlock = true; continue; }
                    if (insideThinkBlock)
                    {
                        if (chunk.Contains("</think>", StringComparison.OrdinalIgnoreCase)) insideThinkBlock = false;
                        continue;
                    }
                    yield return chunk;
                }

                if (isDone) break;
            }
        }
        finally
        {
            response.Dispose();
        }
    }

    public async IAsyncEnumerable<string> StreamChatCompletionAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        bool yieldedAny = false;
        bool triedGemini = false;
        bool triedCloud = false;
        bool triedOllama = false;

        // 1. Jika server produksi diarahkan langsung ke Gemini Streaming
        if (PreferGemini())
        {
            triedGemini = true;
            await foreach (var token in StreamGeminiAsync(systemPrompt, userMessage, history, cancellationToken))
            {
                yieldedAny = true;
                yield return token;
            }
            if (yieldedAny) yield break;
        }

        // 2. Jika diarahkan ke CloudLlm (Groq/OpenRouter)
        if (PreferCloudLlm())
        {
            triedCloud = true;
            await foreach (var token in StreamCloudLlmAsync(systemPrompt, userMessage, history, cancellationToken))
            {
                yieldedAny = true;
                yield return token;
            }
            if (yieldedAny) yield break;
        }

        // 3. Coba Ollama lokal (saat ngoding di laptop)
        triedOllama = true;
        await foreach (var token in StreamOllamaAsync(systemPrompt, userMessage, history, cancellationToken))
        {
            yieldedAny = true;
            yield return token;
        }
        if (yieldedAny) yield break;

        // 4. Fallback ke Gemini Streaming jika belum dicoba
        if (!triedGemini)
        {
            await foreach (var token in StreamGeminiAsync(systemPrompt, userMessage, history, cancellationToken))
            {
                yieldedAny = true;
                yield return token;
            }
            if (yieldedAny) yield break;
        }

        // 5. Fallback terakhir ke CloudLlm jika belum dicoba
        if (!triedCloud)
        {
            await foreach (var token in StreamCloudLlmAsync(systemPrompt, userMessage, history, cancellationToken))
            {
                yieldedAny = true;
                yield return token;
            }
        }
    }

    public async Task<string?> GenerateChatCompletionAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history = null)
    {
        var sb = new StringBuilder();
        await foreach (var token in StreamChatCompletionAsync(systemPrompt, userMessage, history))
        {
            sb.Append(token);
        }

        var result = sb.ToString().Trim();
        return string.IsNullOrWhiteSpace(result) ? null : CleanLlmOutput(result);
    }
}