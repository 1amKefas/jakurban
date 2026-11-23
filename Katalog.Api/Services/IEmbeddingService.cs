namespace Katalog.Api.Services;

public class ChatTurnDto
{
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
}

public interface IEmbeddingService
{
    Task<float[]> GenerateEmbeddingAsync(string text);

    Task<string?> GenerateChatCompletionAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history = null);

    /// Mengalirkan (stream) token jawaban LLM secara real-time kata-per-kata ke klien (SSE).
    IAsyncEnumerable<string> StreamChatCompletionAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history = null,
        CancellationToken cancellationToken = default);
}