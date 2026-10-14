using Katalog.Api.Data;
using Katalog.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Katalog.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PropertiesController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/properties
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Property>>> GetProjects()
    {
        var projects = await _context.Properties
            .Include(p => p.Units)
            .OrderByDescending(p => p.Id)
            .ToListAsync();

        return Ok(projects);
    }

    // GET: api/properties/5
    [HttpGet("{id}")]
    public async Task<ActionResult<Property>> GetProject(int id)
    {
        var project = await _context.Properties
            .Include(p => p.Units)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null) return NotFound();
        return Ok(project);
    }

    // POST: api/properties
    [HttpPost]
    public async Task<ActionResult<Property>> CreateProject([FromBody] Property project)
    {
        project.Id = 0;
        if (project.Units != null)
        {
            foreach (var u in project.Units)
            {
                u.Id = 0;
            }
        }

        _context.Properties.Add(project);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProject), new { id = project.Id }, project);
    }

    // PUT: api/properties/5
    [HttpPut("{id}")]
    public async Task<ActionResult<Property>> UpdateProject(int id, [FromBody] Property updated)
    {
        var existing = await _context.Properties
            .Include(p => p.Units)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (existing == null) return NotFound();

        existing.Name = updated.Name;
        existing.Cluster = string.IsNullOrEmpty(updated.Cluster) ? updated.Name : updated.Cluster;
        existing.Location = updated.Location;
        existing.Description = updated.Description;
        existing.Img = updated.Img;
        existing.Price = updated.Price;
        existing.Status = updated.Status;
        existing.Photos = updated.Photos ?? new List<string>();
        existing.Videos = updated.Videos ?? new List<string>();

        // Update daftar unit di dalam project
        if (existing.Units.Any())
        {
            _context.PropertyUnits.RemoveRange(existing.Units);
        }

        existing.Units = (updated.Units ?? new List<PropertyUnit>()).Select(u => new PropertyUnit
        {
            Name = u.Name,
            Price = u.Price,
            LandArea = u.LandArea,
            BuildArea = u.BuildArea,
            Beds = u.Beds,
            Baths = u.Baths,
            Status = u.Status,
            Description = u.Description
        }).ToList();

        await _context.SaveChangesAsync();
        return Ok(existing);
    }

    // DELETE: api/properties/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(int id)
    {
        var existing = await _context.Properties
            .Include(p => p.Units)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (existing == null) return NotFound();

        _context.Properties.Remove(existing);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}