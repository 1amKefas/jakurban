namespace Katalog.Api.Services;

/// Representasi satu giliran pesan (turn) dalam riwayat percakapan sesi pengguna untuk konteks LLM.
public class ChatTurnDto
{
    /// <summary>Peran pengirim pesan ("user" atau "assistant").</summary>
    public string Role { get; set; } = "user"; // "user" atau "assistant"

    /// <summary>Isi teks pesan percakapan.</summary>
    public string Content { get; set; } = string.Empty;
}

public interface IEmbeddingService
{
    /// Mengonversi teks menjadi vektor numerik 1536 dimensi menggunakan Google Gemini Embedding
    /// yang ternormalisasi (L2-Normalized) untuk pencarian Cosine Distance di pgvector.
    Task<float[]> GenerateEmbeddingAsync(string text);

    /// Mengirimkan System Instruction Guardrail, konteks hasil retrieval pgvector,
    /// riwayat percakapan UUID, dan kueri pengguna ke Google Gemini LLM.
    Task<string?> GenerateChatCompletionAsync(
        string systemPrompt,
        string userMessage,
        IEnumerable<ChatTurnDto>? history = null);
}