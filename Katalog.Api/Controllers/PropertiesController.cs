using Katalog.Api.Data;
using Katalog.Api.Services;
using Katalog.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace Katalog.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PropertiesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IEmbeddingService _embeddingService;

        public PropertiesController(ApplicationDbContext context, IEmbeddingService embeddingService)
        {
            _context = context;
            _embeddingService = embeddingService;
        }

        // GET: api/Properties (Untuk ditampilkan di Front-End Solid.JS)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Property>>> GetProperties()
        {
            return await _context.Properties.ToListAsync();
        }

        // POST: api/Properties (Untuk Admin menambahkan properti baru)
        [HttpPost]
        public async Task<ActionResult<Property>> PostProperty(Property property)
        {
            // 1. Simpan data relasional ke tabel Properties
            _context.Properties.Add(property);
            await _context.SaveChangesAsync();

            // 2. Data Chunking & Ingestion
            string rawContent = $"Unit: {property.UnitCode}, Judul: {property.Title}, Harga: Rp{property.Price:N0}, Status: {property.Status}.";

            // 3. Generate Vector Embedding
            float[] vectorArray = await _embeddingService.GenerateEmbeddingAsync(rawContent);

            // 4. Simpan ke Vector Database (pgvector)
            var chunk = new DocumentChunk
            {
                PropertyId = property.Id,
                Content = rawContent,
                Embedding = new Vector(vectorArray)
            };

            _context.DocumentChunks.Add(chunk);
            await _context.SaveChangesAsync();

            // =====================================================================
            // TODO (Fase Integrasi AI): 
            // Panggil Service Background Task di sini untuk mengonversi 
            // spesifikasi properti ini menjadi teks (Chunking), lalu mengirimkannya 
            // ke model Embedding, dan menyimpannya ke tabel DocumentChunks (pgvector).
            // =====================================================================

            return CreatedAtAction(nameof(GetProperties), new { id = property.Id }, property);
        }

        // DELETE: api/Properties/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProperty(Guid id)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null)
            {
                return NotFound();
            }

            _context.Properties.Remove(property);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}