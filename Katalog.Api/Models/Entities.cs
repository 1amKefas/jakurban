using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Pgvector;

namespace Katalog.Api.Models;

/// Entitas induk yang merepresentasikan sebuah Proyek atau Cluster perumahan.
public class Project
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public string Name { get; set; } = string.Empty;

    public string Location { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Galeri Multi-Foto & Multi-Video level Project/Cluster
    public List<string> Photos { get; set; } = new();
    public List<string> Videos { get; set; } = new();

    // Relasi 1 Project memiliki banyak Unit (Property)
    public List<Property> Properties { get; set; } = new();
}

/// Entitas tipe unit rumah atau kavling yang berada di dalam suatu Project/Cluster.
public class Property
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }

    public string UnitCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Status { get; set; } = "Tersedia";
    public string Description { get; set; } = string.Empty;

    // Spesifikasi Unit
    public string LandArea { get; set; } = string.Empty;
    public string BuildArea { get; set; } = string.Empty;
    public int Beds { get; set; }
    public int Baths { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<string> Photos { get; set; } = new();
    public List<string> Videos { get; set; } = new();

    [ForeignKey(nameof(ProjectId))]
    [JsonIgnore]
    public Project? Project { get; set; }
}

/// Entitas penyimpanan potongan teks spesifikasi (chunk) beserta vektor embedding 1536 dimensi pada pgvector.
public class DocumentChunk
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PropertyId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;

    [Column(TypeName = "vector(1536)")]
    [JsonIgnore]
    public Vector? Embedding { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(PropertyId))]
    [JsonIgnore]
    public Property? Property { get; set; }
}