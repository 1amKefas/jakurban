using Katalog.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Katalog.Api.Data;

/// <summary>
/// Konteks basis data utama Entity Framework Core yang mengelola tabel relasional (Projects, Properties)
/// serta penyimpanan vektor berdimensi 1536 (DocumentChunks) menggunakan ekstensi PostgreSQL pgvector.
/// </summary>
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    /// <summary>Tabel daftar proyek/cluster perumahan.</summary>
    public DbSet<Project> Projects { get; set; }

    /// <summary>Tabel daftar tipe unit properti di dalam masing-masing proyek.</summary>
    public DbSet<Property> Properties { get; set; }

    /// <summary>Tabel potongan dokumen pengetahuan (Knowledge Base) beserta vektor embedding untuk RAG.</summary>
    public DbSet<DocumentChunk> DocumentChunks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Mengaktifkan ekstensi pgvector di PostgreSQL untuk operasi pencarian jarak kosinus (Cosine Distance)
        modelBuilder.HasPostgresExtension("vector");

        // Konfigurasi relasi One-to-Many: menghapus Project otomatis menghapus seluruh unit Property di dalamnya
        modelBuilder.Entity<Project>()
            .HasMany(p => p.Properties)
            .WithOne(u => u.Project)
            .HasForeignKey(u => u.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        base.OnModelCreating(modelBuilder);
    }
}