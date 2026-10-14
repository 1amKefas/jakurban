using Katalog.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Katalog.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        // --- ADD THIS BLOCK START ---
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                // WE HARDCODE THE CONNECTION HERE TO BYPASS APPSETTINGS.JSON
                // Make sure 'password123' matches exactly what you used in 'docker run'
                optionsBuilder.UseNpgsql("Host=localhost;Port=5433;Database=jakurban-db;Username=postgres;Password=password123");
            }
        }
        // --- ADD THIS BLOCK END ---

        public DbSet<Project> Projects { get; set; }
        public DbSet<Property> Properties { get; set; }
        public DbSet<DocumentChunk> DocumentChunks { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.HasPostgresExtension("vector");
            base.OnModelCreating(modelBuilder);
        }
    }
}
