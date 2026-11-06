import { createSignal, For } from 'solid-js';

const TRUST_SLIDES = [
  {
    tag: '01 / REKAM JEJAK',
    title: 'Dibangun di Atas Bukti,\nBukan Sekadar Janji.',
    desc: 'Setiap hunian dirancang secara in-house dengan standar konstruksi tinggi dan legalitas penuh hingga serah terima kunci.',
    stats: [
      { value: '15+', label: 'Cluster Terbangun' },
      { value: '320+', label: 'Unit Sold Out' },
      { value: '100%', label: 'SHM & PBG Pecah' }
    ],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
        label: 'Sold Out Project',
        caption: 'Cluster Emerald Tahap 1'
      },
      {
        url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80',
        label: 'Handover Moment',
        caption: 'Serah Terima Kunci Konsumen'
      }
    ]
  },
  {
    tag: '02 / TRANSPARANSI',
    title: 'Investasi Hunian Aman\n& Legalitas Clean.',
    desc: 'Pendampingan menyeluruh mulai dari survei lokasi, pemilihan kavling, hingga proses akad KPR bersama bank mitra.',
    stats: [
      { value: '0%', label: 'Sengketa Lahan' },
      { value: '98%', label: 'KPR Disetujui' },
      { value: '24/7', label: 'Asisten AI Aktif' }
    ],
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
        label: 'Completed Cluster',
        caption: 'Cluster Pejaten Townhouse'
      },
      {
        url: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?auto=format&fit=crop&w=900&q=80',
        label: 'Verified Agent',
        caption: 'Pendampingan Akad & Konsultasi'
      }
    ]
  }
];

/**
 * Komponen slider kredibilitas developer berdesain frosted-glass.
 * Menampilkan rekam jejak proyek, statistik legalitas, dan dokumentasi serah terima.
 */
export default function TrustHeroSlides() {
  const [activeIndex, setActiveIndex] = createSignal(0);
  const current = () => TRUST_SLIDES[activeIndex()];

  const prevSlide = () =>
    setActiveIndex((i) => (i - 1 + TRUST_SLIDES.length) % TRUST_SLIDES.length);
  const nextSlide = () =>
    setActiveIndex((i) => (i + 1) % TRUST_SLIDES.length);

  return (
    <section class="trust-hero-modern">
      <div class="trust-ambient-orb orb-1"></div>
      <div class="trust-ambient-orb orb-2"></div>

      <div class="container">
        <div class="trust-glass-shell">
          <div class="trust-modern-left">
            <div class="trust-top-meta">
              <span class="trust-modern-tag">{current().tag}</span>
              <div class="trust-slide-dots">
                <For each={TRUST_SLIDES}>
                  {(_, idx) => (
                    <button
                      type="button"
                      class={`trust-dot-btn ${activeIndex() === idx() ? 'active' : ''}`}
                      onClick={() => setActiveIndex(idx())}
                      aria-label={`Slide ${idx() + 1}`}
                    />
                  )}
                </For>
              </div>
            </div>

            <h2>{current().title}</h2>
            <p>{current().desc}</p>

            <div class="trust-modern-stats">
              <For each={current().stats}>
                {(st) => (
                  <div class="trust-glass-stat">
                    <strong>{st.value}</strong>
                    <span>{st.label}</span>
                  </div>
                )}
              </For>
            </div>

            <div class="trust-modern-nav">
              <button type="button" class="trust-glass-btn" onClick={prevSlide}>
                ← Sebelumnya
              </button>
              <button type="button" class="trust-glass-btn" onClick={nextSlide}>
                Berikutnya →
              </button>
            </div>
          </div>

          <div class="trust-modern-right">
            <For each={current().photos}>
              {(photo) => (
                <div class="trust-glass-photo">
                  <img src={photo.url} alt={photo.caption} loading="lazy" />
                  <div class="trust-photo-overlay">
                    <span class="trust-photo-tag">{photo.label}</span>
                    <strong>{photo.caption}</strong>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </section>
  );
}