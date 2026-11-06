const LANG_STORAGE_KEY = 'jakurban_lang';
const ACTIVE_AGENT_STORAGE_KEY = 'jakurban_active_agent_ref';
const ACCOUNTS_STORAGE_KEY = 'jakurban_accounts';

export const DEFAULT_OFFICE_WA = {
  name: 'Tim Marketing JakUrban',
  phoneDisplay: '+62 878 1911 2003',
  phoneNumber: '6287819112003',
  slug: ''
};

export const getLang = () => {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
};

export const isEn = () => getLang() === 'en';

export const setLangAndRefresh = (nextLang) => {
  const normalized = nextLang === 'en' ? 'en' : 'id';
  try {
    localStorage.setItem(LANG_STORAGE_KEY, normalized);
  } catch {
    // Abaikan jika storage penuh
  }
  window.location.reload();
};

export const createAgentSlug = (name = '') =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizeWaNumber = (rawPhone = '') => {
  let digits = String(rawPhone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
};

export const formatWaDisplay = (rawPhone = '') => {
  const norm = normalizeWaNumber(rawPhone);
  if (!norm) return DEFAULT_OFFICE_WA.phoneDisplay;
  // Format +62 8xx xxxx xxxx
  const rest = norm.slice(2);
  const p1 = rest.slice(0, 3);
  const p2 = rest.slice(3, 7);
  const p3 = rest.slice(7);
  return ['+62', p1, p2, p3].filter(Boolean).join(' ');
};

/**
 * Membaca parameter ?agent=... atau ?ref=... dari URL saat halaman dibuka,
 * lalu menyimpannya ke Local Storage agar nomor WhatsApp pada PropertyDetail & UnitDetail
 * otomatis menyesuaikan dengan agen pemilik link tersebut.
 */
export const captureAgentFromUrl = () => {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const agentParam = (params.get('agent') || params.get('ref') || '').trim().toLowerCase();

    if (['reset', 'office', 'default'].includes(agentParam)) {
      localStorage.removeItem(ACTIVE_AGENT_STORAGE_KEY);
      return;
    }

    if (agentParam) {
      localStorage.setItem(ACTIVE_AGENT_STORAGE_KEY, agentParam);
    }
  } catch {
    // Abaikan jika URLSearchParams gagal diparse
  }
};

export const getActiveAgentContact = (accountsProp = null) => {
  try {
    const slugOrId = localStorage.getItem(ACTIVE_AGENT_STORAGE_KEY);
    if (!slugOrId) return DEFAULT_OFFICE_WA;

    const accounts =
      Array.isArray(accountsProp) && accountsProp.length > 0
        ? accountsProp
        : JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]');

    const matched = accounts.find((acc) => {
      const accSlug = (acc.slug || createAgentSlug(acc.name)).toLowerCase();
      const emailPrefix = String(acc.email || '').split('@')[0].toLowerCase();
      return (
        accSlug === slugOrId ||
        emailPrefix === slugOrId ||
        String(acc.id || '').toLowerCase() === slugOrId
      );
    });

    if (matched && matched.phone) {
      const cleanNum = normalizeWaNumber(matched.phone);
      if (cleanNum) {
        return {
          name: matched.name,
          title: matched.title || 'Property Agent',
          phoneDisplay: formatWaDisplay(cleanNum),
          phoneNumber: cleanNum,
          slug: matched.slug || createAgentSlug(matched.name)
        };
      }
    }
  } catch {
    // Fallback ke nomor kantor
  }
  return DEFAULT_OFFICE_WA;
};

export const buildAgentReferralUrl = (acc) => {
  if (typeof window === 'undefined' || !acc) return '';
  const slug = acc.slug || createAgentSlug(acc.name);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?agent=${encodeURIComponent(slug)}`;
};

const DICT = {
  id: {
    navCatalog: 'Katalog',
    navDashboard: 'Dashboard',
    navSignIn: 'Masuk',
    navSignOut: 'Keluar',
    heroTitle: 'Temukan Hunian Modern Impian Anda di Jakarta',
    heroSubtitle: 'Katalog resmi terpusat dengan asisten AI pintar 24/7 untuk membantu Anda memilih properti dan simulasi KPR secara akurat.',
    searchPlaceholder: 'Cari berdasarkan lokasi, nama cluster, atau tipe rumah...',
    searchBtn: 'Cari Properti',
    propertyListTitle: 'Daftar Properti',
    searchResultFor: 'Hasil pencarian:',
    resetSearch: 'Reset Pencarian',
    noPropertyFound: 'Tidak ada properti ditemukan',
    noPropertySub: 'Coba ubah filter atau kata kunci pencarian Anda.',
    filterLocation: 'Lokasi:',
    filterAllLocations: 'Semua Lokasi',
    filterSort: 'Urutkan:',
    filterSortDefault: 'Paling Relevan',
    filterSortLowest: 'Harga Terendah',
    filterSortHighest: 'Harga Tertinggi',
    filterPrice: 'Rentang Harga:',
    filterAllPrices: 'Semua',
    backToCatalog: 'Kembali ke Katalog',
    backToProject: 'Kembali ke',
    bedsLabel: 'Kamar Tidur',
    bathsLabel: 'Kamar Mandi',
    carportLabel: 'Carport',
    landAreaLabel: 'm² Luas Tanah',
    buildAreaLabel: 'm² Luas Bangunan',
    electricityLabel: 'VA Listrik',
    propDescHeading: 'Deskripsi Properti & Kawasan',
    unitDescHeading: 'Spesifikasi & Deskripsi Unit',
    unitChoicesHeading: 'Pilihan Unit',
    unitChoicesSub: 'tipe unit terdaftar di',
    unitChoicesClickHint: 'klik unit untuk melihat foto & detail',
    tablePhoto: 'Foto',
    tableUnit: 'Unit',
    tableLand: 'Luas Tanah',
    tableStatus: 'Status',
    tablePrice: 'Harga',
    viewUnitDetail: 'Lihat Detail Unit',
    prevBtn: 'Sebelumnya',
    nextBtn: 'Berikutnya',
    photoLabel: 'Foto',
    videoLabel: 'Video',
    ofLabel: 'dari',
    mapHeadingProp: 'Lokasi Properti',
    mapHeadingUnit: 'Lokasi Unit & Kawasan',
    openInGmaps: 'Buka di Google Maps',
    contactUs: 'Hubungi Kami',
    activeAgentLabel: 'Agen Pemasaran Resmi:',
    askJakBtn: 'Tanya Jak (AI)',
    askKprBtn: 'Tanya AI Simulasi KPR',
    kprTitle: 'Simulasi KPR',
    kprBankSubtitle: 'Kalkulator Estimasi Pembiayaan Properti',
    kprSelectUnitLabel: 'Pilih Tipe Unit',
    kprPropertyPrice: 'Harga Properti',
    kprDownPayment: 'Uang Muka (DP)',
    kprMinDpHint: 'Kebijakan perusahaan: standar DP 30%',
    kprProgramLabel: 'Pilihan Program KPR',
    kprTenorLabel: 'Jangka Waktu (Tenor)',
    kprYears: 'Tahun',
    kprSimulateBtn: 'Simulasikan',
    kprResultHeading: 'Hasil Estimasi Angsuran KPR',
    kprMonthlyInstallment: 'Estimasi Angsuran / Bulan',
    kprLoanAmount: 'Pokok Pinjaman (Plafon KPR)',
    kprDpAmount: 'Total Uang Muka (DP)',
    kprInterestRate: 'Suku Bunga Acuan',
    kprDisclaimerBold: 'Disclaimer',
    kprDisclaimerText: 'Hasil di atas merupakan angka estimasi. Hubungi agen pemasaran kami untuk perhitungan bank rekanan lebih lanjut.',
    logoutConfirmTitle: 'Konfirmasi Keluar Sesi',
    logoutConfirmDesc: 'Apakah Anda yakin ingin keluar?',
    cancelBtn: 'Batal',
    confirmLogoutBtn: 'Ya, Keluar Sesi'
  },
  en: {
    navCatalog: 'Catalog',
    navDashboard: 'Dashboard',
    navSignIn: 'Log In',
    navSignOut: 'Log Out',
    heroTitle: 'Discover Your Dream Modern Home in Jakarta',
    heroSubtitle: 'Official centralized property catalog powered by a 24/7 RAG AI Assistant for instant unit specs and mortgage simulations.',
    searchPlaceholder: 'Search by location, cluster name, or unit type...',
    searchBtn: 'Search Properties',
    propertyListTitle: 'Property Listings',
    searchResultFor: 'Search results for:',
    resetSearch: 'Reset Search',
    noPropertyFound: 'No properties found',
    noPropertySub: 'Try adjusting your filters or search keywords.',
    filterLocation: 'Location:',
    filterAllLocations: 'All Locations',
    filterSort: 'Sort By:',
    filterSortDefault: 'Most Relevant',
    filterSortLowest: 'Lowest Price',
    filterSortHighest: 'Highest Price',
    filterPrice: 'Price Range:',
    filterAllPrices: 'All',
    backToCatalog: 'Back to Catalog',
    backToProject: 'Back to',
    bedsLabel: 'Bedrooms',
    bathsLabel: 'Bathrooms',
    carportLabel: 'Carport',
    landAreaLabel: 'm² Land Area',
    buildAreaLabel: 'm² Building Area',
    electricityLabel: 'VA Electricity',
    propDescHeading: 'Property & Area Description',
    unitDescHeading: 'Unit Specifications & Description',
    unitChoicesHeading: 'Available Unit Types',
    unitChoicesSub: 'unit types registered in',
    unitChoicesClickHint: 'click a unit to view photos & details',
    tablePhoto: 'Photo',
    tableUnit: 'Unit',
    tableLand: 'Land Area',
    tableStatus: 'Status',
    tablePrice: 'Price',
    viewUnitDetail: 'View Unit Details',
    prevBtn: 'Previous',
    nextBtn: 'Next',
    photoLabel: 'Photo',
    videoLabel: 'Video',
    ofLabel: 'of',
    mapHeadingProp: 'Property Location',
    mapHeadingUnit: 'Unit & Cluster Location',
    openInGmaps: 'Open in Google Maps',
    contactUs: 'Contact Us',
    activeAgentLabel: 'Official Marketing Agent:',
    askJakBtn: 'Ask Jak (AI)',
    askKprBtn: 'Ask AI Mortgage Plan',
    kprTitle: 'Mortgage Simulation (KPR)',
    kprBankSubtitle: 'Property Financing Estimation Calculator',
    kprSelectUnitLabel: 'Select Unit Type',
    kprPropertyPrice: 'Property Price',
    kprDownPayment: 'Down Payment (DP)',
    kprMinDpHint: 'Company policy: 30% standard DP',
    kprProgramLabel: 'Mortgage Program Option',
    kprTenorLabel: 'Loan Tenure (Tenor)',
    kprYears: 'Years',
    kprSimulateBtn: 'Calculate Simulation',
    kprResultHeading: 'Estimated Mortgage Breakdown',
    kprMonthlyInstallment: 'Estimated Monthly Payment',
    kprLoanAmount: 'Principal Loan Amount',
    kprDpAmount: 'Total Down Payment (DP)',
    kprInterestRate: 'Applied Interest Rate',
    kprDisclaimerBold: 'Disclaimer',
    kprDisclaimerText: 'The figures above are estimates only. Contact us for official partner bank calculations.',
    logoutConfirmTitle: 'Confirm Sign Out',
    logoutConfirmDesc: 'Are you sure you want to sign out?',
    cancelBtn: 'Cancel',
    confirmLogoutBtn: 'Yes, Sign Out'
  }
};

export const t = (key) => {
  const lang = getLang();
  return DICT[lang]?.[key] ?? DICT.id[key] ?? key;
};