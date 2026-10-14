using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Pgvector;

namespace Katalog.Api.Models;

public class Project
{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<Property> Properties { get; set; } = new();
}

public class Property
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    public string Cluster { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Price { get; set; } = string.Empty;
    public string Status { get; set; } = "Tersedia";
    public string Description { get; set; } = string.Empty;
    public string Img { get; set; } = string.Empty;

    public string LandArea { get; set; } = string.Empty;
    public string BuildArea { get; set; } = string.Empty;
    public int Beds { get; set; }
    public int Baths { get; set; }

    public List<string> Photos { get; set; } = new();
    public List<string> Videos { get; set; } = new();
    public List<PropertyUnit> Units { get; set; } = new();

    public int? ProjectId { get; set; }
    public Project? Project { get; set; }
}

public class PropertyUnit
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    public string Price { get; set; } = string.Empty;
    public string LandArea { get; set; } = string.Empty;
    public string BuildArea { get; set; } = string.Empty;
    public int Beds { get; set; }
    public int Baths { get; set; }
    public string Status { get; set; } = "Tersedia";
    public string Description { get; set; } = string.Empty;

    public int PropertyId { get; set; }
}

public class DocumentChunk
{
    [Key]
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;

    [Column(TypeName = "vector(1536)")]
    public Vector? Embedding { get; set; }
}