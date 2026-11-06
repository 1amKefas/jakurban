/* Peta warna kelas CSS badge berdasarkan status ketersediaan unit properti. */
const STATUS_BADGE_MAP = {
  Tersedia: 'badge-success',
  Available: 'badge-success',
  Booking: 'badge-warning',
  Sold: 'badge-danger'
};

/* Mengembalikan nama class badge CSS yang sesuai dengan status unit. */
export const getStatusColor = (status) => STATUS_BADGE_MAP[status] || 'badge-neutral';

/* Mengonversi objek File (gambar/video) dari input perangkat menjadi Base64 Data URL. */
export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* Memvalidasi apakah sebuah nilai string berformat UUID/GUID v4 yang sah untuk PostgreSQL. */
export const isValidGuid = (id) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);