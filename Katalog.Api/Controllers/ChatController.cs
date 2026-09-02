using Katalog.Api.Data;
using Katalog.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace Katalog.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ChatController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IEmbeddingService _embeddingService;

        public ChatController(ApplicationDbContext context, IEmbeddingService embeddingService)
        {
            _context = context;
            _embeddingService = embeddingService;
        }

        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] ChatQueryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest("Pesan tidak boleh kosong.");

            // 1. Transformasi teks pertanyaan user menjadi vector
            float[] queryVector = await _embeddingService.GenerateEmbeddingAsync(request.Message);
            var vector = new Vector(queryVector);

            // 2. Retrieval: Cosine Similarity Search via pgvector (ambil top 3 konteks paling relevan)
            var relevantChunks = await _context.DocumentChunks
                .OrderBy(c => c.Embedding!.CosineDistance(vector))
                .Take(3)
                .Select(c => c.Content)
                .ToListAsync();

            string contextData = string.Join("\n", relevantChunks);

            // 3. Menghasilkan respons RAG
            // Di sini konteks disatukan dengan prompt sistem sebelum diteruskan ke generator LLM
            return Ok(new
            {
                query = request.Message,
                retrievedContext = contextData,
                status = "Retrieval Success"
            });
        }
    }

    public class ChatQueryRequest
    {
        public string Message { get; set; } = string.Empty;
        public Guid SessionId { get; set; }
    }
}