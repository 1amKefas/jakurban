import { For } from 'solid-js';

/* Daftar kartu nilai jual utama (Unique Selling Proposition) perusahaan pada halaman katalog. */
const SHOWCASE_CARDS = [
  {
    tag: '01 / ARSITEKTUR',
    title: 'Desain Tropis Modern',
    desc: 'Sirkulasi udara silang dan pencahayaan alami maksimal yang dirancang khusus untuk iklim urban Jakarta.',
    stat: 'Smart Home Ready'
  },
  {
    tag: '02 / LOKASI STRATEGIS',
    title: 'Aksesibilitas Tanpa Batas',
    desc: 'Terhubung langsung dengan jaringan transportasi publik MRT, LRT, dan gerbang tol utama dalam hitungan menit.',
    stat: 'Prime Jakarta Area'
  },
  {
    tag: '03 / KEPASTIAN LEGALITAS',
    title: 'Dokumen SHM & PBG Siap',
    desc: 'Seluruh unit dipasarkan dengan status lahan clean & clear serta dukungan penuh pembiayaan KPR perbankan.',
    stat: '100% Verified'
  }
];

/* Seksi bento-grid modern di bawah TrustHeroSlides untuk menampilkan keunggulan arsitektur & legalitas. */
export default function ModernShowcaseSection() {
  return (
    <section class="modern-showcase-section">
      <div class="container">
        <div class="modern-showcase-header">
          <span class="showcase-eyebrow">STANDAR HUNIAN MASA DEPAN</span>
          <h2>Dirancang untuk Kenyamanan & Nilai Investasi Jangka Panjang</h2>
          <p>
            Bagian ini dapat kamu sesuaikan kapan saja untuk menampilkan filosofi perusahaan, tahapan pemesanan, maupun keunggulan proyek.
          </p>
        </div>

        <div class="modern-bento-grid">
          <For each={SHOWCASE_CARDS}>
            {(item) => (
              <div class="modern-glass-card">
                <div class="modern-card-top">
                  <span class="modern-card-tag">{item.tag}</span>
                  <span class="modern-card-pill">{item.stat}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}