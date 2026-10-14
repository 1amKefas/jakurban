using System.Collections.Concurrent;
using Katalog.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Katalog.Api.Controllers;

public class ChatRequestDto
{
    public Guid? SessionId { get; set; }
    public string Message { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    // Menyimpan riwayat konteks percakapan per UUID SessionId agar antar-user tidak bertabrakan
    private static readonly ConcurrentDictionary<Guid, List<string>> _sessionHistories = new();

    public ChatController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> PostChat([FromBody] ChatRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { reply = "Pesan tidak boleh kosong." });

        // Gunakan UUID dari frontend, atau buat baru jika belum ada
        var sessionId = request.SessionId == null || request.SessionId == Guid.Empty
            ? Guid.NewGuid()
            : request.SessionId.Value;

        var history = _sessionHistories.GetOrAdd(sessionId, _ => new List<string>());
        lock (history)
        {
            history.Add($"User: {request.Message}");
        }

        // Ambil data Project beserta daftar Unit dari PostgreSQL
        var projects = await _context.Properties
            .Include(p => p.Units)
            .ToListAsync();

        var query = request.Message.ToLower();
        string reply;

        if (!projects.Any())
        {
            reply = "Saat ini belum ada project properti yang terdaftar di database. Silakan tambahkan Project & Unit terlebih dahulu melalui menu Dashboard -> Project Assets.";
        }
        else if (query.Contains("kpr") || query.Contains("cicil") || query.Contains("simulasi"))
        {
            reply = "Untuk simulasi KPR JakUrban:\n• Asumsi suku bunga: 7.5% efektif/tahun\n• DP disarankan: 10% - 20%\n• Tenor tersedia: hingga 20 tahun.\n\nBerikut daftar project kami yang bisa diajukan KPR:\n" +
                    string.Join("\n", projects.Select(p => $"• {p.Name} ({p.Location}) — {(p.Units.Any() ? $"Mulai {p.Units.First().Price}" : p.Price)}"));
        }
        else
        {
            // Filter project/unit yang relevan dengan kata kunci user
            var matchedProjects = projects.Where(p =>
                p.Name.ToLower().Contains(query) ||
                p.Location.ToLower().Contains(query) ||
                p.Description.ToLower().Contains(query) ||
                p.Units.Any(u => u.Name.ToLower().Contains(query) || u.Status.ToLower().Contains(query))
            ).ToList();

            var targetList = matchedProjects.Any() ? matchedProjects : projects;

            var lines = targetList.Select(p =>
            {
                var unitDetails = p.Units.Any()
                    ? string.Join("\n  ", p.Units.Select(u =>
                        $"- Unit {u.Name}: {u.Price} | LT {u.LandArea}m² / LB {u.BuildArea}m² | {u.Beds} KT, {u.Baths} KM ({u.Status})"))
                    : $"- Harga: {p.Price} ({p.Status})";

                return $"🏢 **{p.Name}** (📍 {p.Location})\n  {unitDetails}";
            });

            reply = $"Berikut informasi project dan unit properti kami yang sesuai dengan pencarian Anda:\n\n{string.Join("\n\n", lines)}";
        }

        lock (history)
        {
            history.Add($"Bot: {reply}");
        }

        return Ok(new
        {
            sessionId,
            reply,
            historyCount = history.Count
        });
    }
}