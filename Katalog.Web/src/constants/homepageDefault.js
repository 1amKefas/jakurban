export const HOMEPAGE_STORAGE_KEY = 'jakurban_homepage_config';

/**
 * Mengubah link share Google Drive menjadi URL gambar langsung untuk tag <img>.
 * URL lain (Cloudflare R2, Unsplash, DataURL) dikembalikan apa adanya.
 */
export const normalizeDriveImageUrl = (rawUrl = '') => {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/uc\?(?:export=[^&]+&)?id=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/i
  ];

  for (const regex of patterns) {
    const match = url.match(regex);
    if (match?.[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}=w1920`;
    }
  }
  return url;
};

export const DEFAULT_HOMEPAGE_CONFIG = {
  hero: {
    title: 'Temukan Rumah\nMasa Depan Anda',
    subtitle:
      'Pengalaman pencarian properti berbasis AI untuk hunian paling eksklusif di jantung kota Jakarta.',
    searchPlaceholder: 'Lokasi, Nama Proyek, Harga ...',
    overlayOpacity: 0.62, // 0.25 - 0.85 agar teks putih & search bar tetap kontras
    autoSlideSeconds: 6,
    billboards: [
      {
        id: 'bb-1',
        imageUrl: '', // Kosong = background biru navy default. Isi link Drive/R2 untuk menampilkan billboard
        caption: ''
      }
    ]
  },
  popup: {
    enabled: false,
    badge: 'PROMO TERBATAS',
    title: 'Penawaran Spesial Bulan Ini',
    description:
      'Dapatkan bebas biaya BPHTB & subsidi akad KPR untuk pemesanan unit pilihan bulan ini.',
    imageUrl: '',
    ctaLabel: 'Konsultasi via AI',
    ctaAction: 'chatbot', // 'chatbot' | 'link' | 'close'
    ctaUrl: '',
    showOncePerSession: true
  },
  carouselSlides: [
    {
      id: 'slide-1',
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
      id: 'slide-2',
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
  ],
  showcase: {
    eyebrow: 'STANDAR HUNIAN MASA DEPAN',
    title: 'Dirancang untuk Kenyamanan & Nilai Investasi Jangka Panjang',
    subtitle:
      'Menghadirkan kualitas arsitektur, aksesibilitas strategis, serta legalitas terjamin di lokasi terbaik Jakarta.',
    cards: [
      {
        id: 'card-1',
        tag: '01 / ARSITEKTUR',
        stat: 'Smart Home Ready',
        title: 'Desain Tropis Modern',
        desc: 'Sirkulasi udara silang dan pencahayaan alami maksimal yang dirancang khusus untuk iklim urban Jakarta.'
      },
      {
        id: 'card-2',
        tag: '02 / LOKASI STRATEGIS',
        stat: 'Prime Jakarta Area',
        title: 'Aksesibilitas Tanpa Batas',
        desc: 'Terhubung langsung dengan jaringan transportasi publik MRT, LRT, dan gerbang tol utama dalam hitungan menit.'
      },
      {
        id: 'card-3',
        tag: '03 / KEPASTIAN LEGALITAS',
        stat: '100% Verified',
        title: 'Dokumen SHM & PBG Siap',
        desc: 'Seluruh unit dipasarkan dengan status lahan clean & clear serta dukungan penuh pembiayaan KPR perbankan.'
      }
    ]
  }
};

export const mergeHomepageConfig = (saved) => {
  if (!saved || typeof saved !== 'object') return structuredClone(DEFAULT_HOMEPAGE_CONFIG);

  const mergedHero = {
    ...DEFAULT_HOMEPAGE_CONFIG.hero,
    ...(saved.hero || {})
  };
  mergedHero.billboards = Array.isArray(saved.hero?.billboards)
    ? saved.hero.billboards
    : structuredClone(DEFAULT_HOMEPAGE_CONFIG.hero.billboards);

  return {
    hero: mergedHero,
    popup: { ...DEFAULT_HOMEPAGE_CONFIG.popup, ...(saved.popup || {}) },
    carouselSlides:
      Array.isArray(saved.carouselSlides) && saved.carouselSlides.length > 0
        ? saved.carouselSlides
        : structuredClone(DEFAULT_HOMEPAGE_CONFIG.carouselSlides),
    showcase: {
      ...DEFAULT_HOMEPAGE_CONFIG.showcase,
      ...(saved.showcase || {}),
      cards:
        Array.isArray(saved.showcase?.cards) && saved.showcase.cards.length > 0
          ? saved.showcase.cards
          : structuredClone(DEFAULT_HOMEPAGE_CONFIG.showcase.cards)
    }
  };
};