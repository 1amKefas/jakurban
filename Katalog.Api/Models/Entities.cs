using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Pgvector;

namespace Katalog.Api.Models
{
    public class Project
    {
        [Key] 
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Property
    {
        [Key] 
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ProjectId { get; set; }
        public string UnitCode { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Status { get; set; } = "Available"; 
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }
    }

    public class DocumentChunk
    {
        [Key] 
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PropertyId { get; set; }
        public string Content { get; set; } = string.Empty;
        
        // Vektor 1536 dimensi (standar OpenAI/HuggingFace)
        [Column(TypeName = "vector(1536)")]
        public Vector? Embedding { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("PropertyId")]
        public Property? Property { get; set; }
    }
}