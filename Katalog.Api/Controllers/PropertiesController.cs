using System.Globalization;
using Katalog.Api.Data;
using Katalog.Api.Models;
using Katalog.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pgvector;

namespace Katalog.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[DisableRequestSizeLimit]
public class PropertiesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IEmbeddingService _embeddingService;
    private readonly ILogger<PropertiesController> _logger;

    public PropertiesController(
        ApplicationDbContext context,
        IEmbeddingService embeddingService,
        ILogger<PropertiesController> logger)
    {
        _context = context;
        _embeddingService = embeddingService;
        _logger = logger;
    }

    private static string FormatRupiah(decimal price)
    {
        if (price <= 0) return "Hubungi Marketing";
        return string.Format(new CultureInfo("id-ID"), "Rp {0:N0}", price);
    }

    /// <summary>
    /// Menyalin dan menormalkan nilai spesifikasi unit dari payload request ke entitas Property.
    /// </summary>
    private static void MapUnitFields(Property target, Property source, Guid projectId)
    {
        target.ProjectId = projectId;
        target.UnitCode = string.IsNullOrWhiteSpace(source.UnitCode) ? source.Title : source.UnitCode;
        target.Title = source.Title;
        target.Price = source.Price;
        target.Status = string.IsNullOrWhiteSpace(source.Status) ? "Tersedia" : source.Status;
        target.Description = source.Description;
        target.LandArea = source.LandArea;
        target.BuildArea = source.BuildArea;
        target.Beds = source.Beds;
        target.Baths = source.Baths;
        target.Photos = source.Photos ?? new List<string>();
        target.Videos = source.Videos ?? new List<string>();
    }

    /// <summary>
    /// Menghapus seluruh vektor DocumentChunks yang terkait dengan daftar ID unit tertentu.
    /// </summary>
    private async Task RemoveChunksByUnitIdsAsync(ICollection<Guid> unitIds)
    {
        if (unitIds.Count == 0) return;
        var chunks = await _context.DocumentChunks
            .Where(c => unitIds.Contains(c.PropertyId))
            .ToListAsync();

        if (chunks.Count > 0)
        {
            _context.DocumentChunks.RemoveRange(chunks);
        }
    }

    private async Task SyncProjectDocumentChunksAsync(Guid projectId)
    {
        try
        {
            var project = await _context.Projects
                .Include(p => p.Properties)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null) return;

            var propertyIds = project.Properties.Select(u => u.Id).ToList();
            if (propertyIds.Any())
            {
                var oldChunks = await _context.DocumentChunks
                    .Where(c => propertyIds.Contains(c.PropertyId))
                    .ToListAsync();

                if (oldChunks.Any())
                {
                    await RemoveChunksByUnitIdsAsync(project.Properties.Select(u => u.Id).ToList());
                    await _context.SaveChangesAsync();
                }
            }

            foreach (var unit in project.Properties)
            {
                var chunkText =
                    $"Proyek/Cluster: {project.Name}. " +
                    $"Lokasi Wilayah: {project.Location}. " +
                    $"Deskripsi & Fasilitas Kawasan: {project.Description}. " +
                    $"Nama Tipe Unit: {unit.Title} (Kode: {unit.UnitCode}). " +
                    $"Harga Resmi: {FormatRupiah(unit.Price)} (Nominal: {unit.Price:0}). " +
                    $"Status Ketersediaan: {unit.Status}. " +
                    $"Spesifikasi Teknis: Luas Tanah (LT) {unit.LandArea} m², Luas Bangunan (LB) {unit.BuildArea} m², " +
                    $"{unit.Beds} Kamar Tidur (KT), {unit.Baths} Kamar Mandi (KM). " +
                    $"Detail Unit: {unit.Description}";

                var vectorArray = await _embeddingService.GenerateEmbeddingAsync(chunkText);

                var chunk = new DocumentChunk
                {
                    Id = Guid.NewGuid(),
                    PropertyId = unit.Id,
                    Content = chunkText,
                    Source = $"{project.Name} - {unit.Title}",
                    Embedding = vectorArray.Length == 1536 ? new Vector(vectorArray) : null,
                    CreatedAt = DateTime.UtcNow
                };

                _context.DocumentChunks.Add(chunk);
            }

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Auto-indexing pgvector dilewati/tertunda untuk project {Id}: {Error}", projectId, ex.Message);
        }
    }

    // GET: api/properties
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Project>>> GetProjects()
    {
        var projects = await _context.Projects
            .Include(p => p.Properties)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(projects);
    }

    // GET: api/properties/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Project>> GetProject(Guid id)
    {
        var project = await _context.Projects
            .Include(p => p.Properties)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null) return NotFound();
        return Ok(project);
    }

    // POST: api/properties
    [HttpPost]
    public async Task<ActionResult<Project>> CreateProject([FromBody] Project project)
    {
        project.Id = project.Id == Guid.Empty ? Guid.NewGuid() : project.Id;
        project.CreatedAt = DateTime.UtcNow;
        project.Photos ??= new List<string>();
        project.Videos ??= new List<string>();

        if (project.Properties != null)
        {
            foreach (var prop in project.Properties)
            {
                prop.Id = prop.Id == Guid.Empty ? Guid.NewGuid() : prop.Id;
                MapUnitFields(prop, prop, project.Id);
                prop.CreatedAt = DateTime.UtcNow;
            }
        }

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        await SyncProjectDocumentChunksAsync(project.Id);

        return CreatedAtAction(nameof(GetProject), new { id = project.Id }, project);
    }

    // PUT: api/properties/{id}
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Project>> UpdateProject(Guid id, [FromBody] Project updated)
    {
        var existing = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == id);

        if (existing == null) return NotFound();

        existing.Name = updated.Name;
        existing.Location = updated.Location;
        existing.Description = updated.Description;
        existing.Photos = updated.Photos ?? new List<string>();
        existing.Videos = updated.Videos ?? new List<string>();

        var existingUnits = await _context.Properties
            .Where(u => u.ProjectId == id)
            .ToListAsync();

        var incomingUnits = updated.Properties ?? new List<Property>();
        var incomingIds = incomingUnits
            .Where(u => u.Id != Guid.Empty)
            .Select(u => u.Id)
            .ToHashSet();

        // 1. Hapus unit yang dihapus oleh Admin
        var unitsToRemove = existingUnits
            .Where(u => !incomingIds.Contains(u.Id))
            .ToList();

        if (unitsToRemove.Any())
        {
            await RemoveChunksByUnitIdsAsync(unitsToRemove.Select(u => u.Id).ToList());
            _context.Properties.RemoveRange(unitsToRemove);
        }

        // 2. Update unit lama atau Insert unit baru secara eksplisit ke DbSet Properties
        foreach (var incoming in incomingUnits)
        {
            var existingUnit = incoming.Id != Guid.Empty
                ? existingUnits.FirstOrDefault(u => u.Id == incoming.Id)
                : null;

            if (existingUnit != null)
            {
                MapUnitFields(existingUnit, incoming, existing.Id);
            }
            else
            {
                var newUnit = new Property { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
                MapUnitFields(newUnit, incoming, existing.Id);
                _context.Properties.Add(newUnit);
            }
        }

        await _context.SaveChangesAsync();

        // Trigger Re-Indexing Vector Database (FR-12)
        await SyncProjectDocumentChunksAsync(existing.Id);

        var refreshed = await _context.Projects
            .Include(p => p.Properties)
            .FirstOrDefaultAsync(p => p.Id == id);

        return Ok(refreshed ?? existing);
    }

    // DELETE: api/properties/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteProject(Guid id)
    {
        var existing = await _context.Projects
            .Include(p => p.Properties)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (existing == null) return NotFound();

        await RemoveChunksByUnitIdsAsync(existing.Properties.Select(u => u.Id).ToList());

        _context.Projects.Remove(existing);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/properties/reindex
    [HttpPost("reindex")]
    public async Task<IActionResult> ReindexAllProjects()
    {
        var projectIds = await _context.Projects.Select(p => p.Id).ToListAsync();

        foreach (var pid in projectIds)
        {
            await SyncProjectDocumentChunksAsync(pid);
        }

        var totalChunks = await _context.DocumentChunks.CountAsync();
        return Ok(new
        {
            message = "Proses Auto-Indexing Vector Database selesai.",
            projectsIndexed = projectIds.Count,
            totalDocumentChunks = totalChunks
        });
    }
}