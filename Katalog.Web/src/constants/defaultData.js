const BASE_DEFAULT_UNSPLASH = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80';

export const DEFAULT_COVER_IMG = `${BASE_DEFAULT_UNSPLASH}&w=600`;
export const DEFAULT_THUMB_IMG = `${BASE_DEFAULT_UNSPLASH}&w=200`;

export const createDefaultUnitForm = () => ({
  id: 0,
  name: '',
  price: '',
  landArea: '',
  buildArea: '',
  beds: 2,
  baths: 1,
  carport: 1,
  status: 'Tersedia',
  description: '',
  photos: [],
});

export const createDefaultProjectForm = () => ({
  id: 0,
  name: '',
  exactLocation: '',
  location: '',
  description: '',
  photos: [],
  videos: [],
  units: []
});

// --- DATA KONSTANTA & FALLBACK CHATBOT ---
export const INITIAL_CHAT_GREETING = {
  id: 1,
  sender: 'bot',
  text: 'Selamat datang di asisten JakUrban AI! Saya dapat membantu Anda menemukan hunian impian di Jakarta beserta simulasi KPR dan ketersediaan unit terbaru.'
};

/**
 * Memberikan respons fallback lokal apabila server API Chatbot sedang tidak terjangkau.
 */
export const getFallbackBotResponse = (userText = '') => {
  const textLower = String(userText).toLowerCase();
  const hasAny = (keywords) => keywords.some((kw) => textLower.includes(kw));

  if (hasAny(['lokasi', 'area'])) {
    return 'Berdasarkan preferensi Anda, saya merekomendasikan area Jakarta Selatan seperti Setiabudi dan Kemang yang memiliki akses strategis ke pusat bisnis.';
  }
  if (hasAny(['kpr', 'hitung', 'simulasi'])) {
    return 'Untuk simulasi KPR, saya memerlukan informasi harga properti dan tenor yang diinginkan. Rata-rata bunga KPR saat ini berkisar 7-9% per tahun.';
  }
  if (hasAny(['unit', 'tersedia', 'stok'])) {
    return 'Saat ini kami memiliki beberapa unit tersedia di berbagai cluster. Silakan sebutkan budget atau jumlah kamar yang Anda cari.';
  }
  return 'Terima kasih atas pertanyaan Anda. Tim kami akan segera membantu memberikan rekomendasi unit terbaik.';
};