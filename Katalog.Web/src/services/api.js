import { DEFAULT_COVER_IMG } from '../constants/defaultData';
import { isValidGuid } from '../utils/formatters';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Bersihkan otomatis jika VITE_API_URL tidak sengaja mengandung kurung siku Markdown [...] atau tanda kutip
const rawEnvUrl = String(import.meta.env.VITE_API_URL || '').trim();
const cleanEnvUrl = rawEnvUrl
  .replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1')
  .replace(/^[\["']+|[\]"']+$/g, '')
  .replace(/\/+$/, '');

const API_BASE_URL =
  cleanEnvUrl.startsWith('http')
    ? cleanEnvUrl
    : isLocalhost
    ? 'http://localhost:5151/api'
    : 'https://jakurban.onrender.com/api';
const SESSION_STORAGE_KEY = 'jakurban_chat_session_uuid';
const MAP_STORAGE_KEY = 'jakurban_custom_maps';

const getSavedMapsMap = () => {
  try {
    return JSON.parse(localStorage.getItem(MAP_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const saveProjectCustomMap = (projectKey, exactLocationInput) => {
  if (!projectKey) return;
  try {
    const mapStore = getSavedMapsMap();
    if (exactLocationInput && exactLocationInput.trim()) {
      mapStore[String(projectKey)] = exactLocationInput.trim();
    } else {
      delete mapStore[String(projectKey)];
    }
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(mapStore));
  } catch {
    // Abaikan jika localStorage penuh
  }
};

export const getProjectCustomMap = (project) => {
  if (!project) return '';
  if (project.exactLocation) return project.exactLocation;
  const mapStore = getSavedMapsMap();
  return mapStore[String(project.id)] || mapStore[String(project.name)] || '';
};

/**
 * Mengekstrak URL Embed dan URL Eksternal Google Maps dari input:
 * - Kode HTML <iframe src="...">
 * - Link Google Maps Embed / Share URL
 * - Koordinat Lat, Long atau Alamat Titik Spesifik
 */
export const resolveExactMapUrls = (rawExactInput = '', fallbackQuery = '') => {
  const trimmed = String(rawExactInput || '').trim();
  const cleanFallback = encodeURIComponent(String(fallbackQuery || 'Jakarta').trim());

  if (!trimmed) {
    return {
      exactLocation: '',
      mapEmbedUrl: `https://maps.google.com/maps?q=${cleanFallback}&t=&z=15&ie=UTF8&iwloc=&output=embed`,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${cleanFallback}`
    };
  }

  // 1. Jika Admin menempelkan tag <iframe ... src="...">
  const iframeSrcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  const extractedValue = iframeSrcMatch ? iframeSrcMatch[1].trim() : trimmed;

  // 2. Jika sudah berupa URL embed Google Maps
  if (/google\.com\/maps\/embed|output=embed/i.test(extractedValue)) {
    return {
      exactLocation: trimmed,
      mapEmbedUrl: extractedValue,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${cleanFallback}`
    };
  }

  // 3. Jika berupa URL Google Maps biasa (misal link share lokasi atau koordinat di URL)
  if (/^https?:\/\//i.test(extractedValue)) {
    const coordMatch = extractedValue.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const placeMatch = extractedValue.match(/\/place\/([^/?#]+)/i);
    const qParamMatch = extractedValue.match(/[?&](?:q|query)=([^&#]+)/i);

    let embedQuery = cleanFallback;
    if (coordMatch) {
      embedQuery = encodeURIComponent(`${coordMatch[1]},${coordMatch[2]}`);
    } else if (qParamMatch) {
      embedQuery = qParamMatch[1];
    } else if (placeMatch) {
      embedQuery = encodeURIComponent(decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')));
    }

    return {
      exactLocation: trimmed,
      mapEmbedUrl: `https://maps.google.com/maps?q=${embedQuery}&t=&z=17&ie=UTF8&iwloc=&output=embed`,
      mapUrl: extractedValue
    };
  }

  // 4. Jika berupa titik koordinat langsung atau alamat lengkap spesifik
  const encodedExact = encodeURIComponent(extractedValue);
  return {
    exactLocation: trimmed,
    mapEmbedUrl: `https://maps.google.com/maps?q=${encodedExact}&t=&z=17&ie=UTF8&iwloc=&output=embed`,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodedExact}`
  };
};

/**
 * Membersihkan sintaks markdown/rich-text untuk tampilan kartu singkat (PropertyCard).
 */
export const stripRichText = (text = '') =>
  String(text || '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/(\*\*|__|\*|_)/g, '')
    .replace(/^[•\-*]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

export const getChatSessionId = () => {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId || !isValidGuid(sessionId)) {
    sessionId = crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
};

export const resetChatSessionId = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  return getChatSessionId();
};

export const parseSmartRupiahNumber = (rawValue) => {
  if (typeof rawValue === 'number') {
    return Number.isNaN(rawValue) || rawValue <= 0 ? 0 : Math.round(rawValue);
  }

  if (typeof rawValue !== 'string') return 0;
  const str = rawValue.trim();
  if (!str) return 0;

  const lower = str.toLowerCase();
  const hasBillion = /\b(miliar|milyar|m)\b/i.test(lower);
  const hasMillion = /\b(juta|jt)\b/i.test(lower);

  if (hasBillion || hasMillion) {
    const numMatch = lower.match(/(\d+(?:[.,]\d+)?)/);
    if (numMatch) {
      const normalizedFloat = parseFloat(numMatch[1].replace(',', '.'));
      if (!Number.isNaN(normalizedFloat)) {
        return Math.round(normalizedFloat * (hasBillion ? 1000000000 : 1000000));
      }
    }
  }

  const digitsOnly = str.replace(/[^\d]/g, '');
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
};

const formatThreeMainDigits = (val) => {
  // Membatasi tampilan maksimal 3 digit utama (3 angka penting)
  return Number(val.toPrecision(3)).toString().replace('.', ',');
};

export const formatCompactRupiah = (rawValue) => {
  const num = parseSmartRupiahNumber(rawValue);
  if (!num || num <= 0) {
    if (typeof rawValue === 'string' && rawValue.trim() && rawValue !== '0') {
      return rawValue;
    }
    return 'Hubungi Marketing';
  }

  if (num >= 1000000000) {
    return `Rp ${formatThreeMainDigits(num / 1000000000)} Miliar`;
  }

  if (num >= 1000000) {
    return `Rp ${formatThreeMainDigits(num / 1000000)} Juta`;
  }

  return `Rp ${num.toLocaleString('id-ID')}`;
};

export const formatPublicLocation = (rawLocation = '') => {
  if (!rawLocation || typeof rawLocation !== 'string') return 'Jakarta';
  const cleaned = rawLocation
    .split(',')
    .map((part) => part.trim().replace(/^kec(\.|amatan)?\s+/i, ''))
    .filter((part) => part && !/^kel(\.|urahan)?\s+/i.test(part))
    .join(', ');
  return cleaned || rawLocation;
};

const calcMinMaxText = (values, fallbackVal = '-') => {
  const nums = values.map((v) => Number(v)).filter((v) => !Number.isNaN(v) && v > 0);
  if (!nums.length) return String(fallbackVal ?? '-');
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? `${min}` : `${min} - ${max}`;
};

const extractPhotos = (p, fallback = []) => {
  if (Array.isArray(p.photos) && p.photos.length > 0) return p.photos;
  if (p.img) return [p.img];
  return fallback;
};

const resolveUnitNumericPrice = (u) => {
  // Jika u.price adalah input angka digit murni dari form modal, gunakan u.price
  if (typeof u.price === 'number' && u.price > 0) return Math.round(u.price);
  if (typeof u.price === 'string' && /^\d+$/.test(u.price.trim())) {
    return parseInt(u.price.trim(), 10);
  }
  // Prioritaskan rawPrice agar teks "Rp ... Miliar" tidak membulatkan angka asli
  const rawNum = parseSmartRupiahNumber(u.rawPrice);
  if (rawNum > 0) return rawNum;
  return parseSmartRupiahNumber(u.price);
};

export const computeProjectSummary = (p) => {
  const photos = extractPhotos(p, [DEFAULT_COVER_IMG]);
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const rawUnits = Array.isArray(p.units) ? p.units : [];

  const units = rawUnits.map((u) => {
    const numPrice = resolveUnitNumericPrice(u);
    return {
      ...u,
      rawPrice: numPrice,
      price: numPrice > 0 ? formatCompactRupiah(numPrice) : u.price || 'Hubungi Marketing',
      beds: Number(u.beds ?? 0),
      baths: Number(u.baths ?? 0),
      carport: Number(u.carport ?? 1),
      landArea: u.landArea ?? '',
      buildArea: u.buildArea ?? '',
      photos: Array.isArray(u.photos) ? u.photos : []
    };
  });

  const validPrices = units.map((u) => u.rawPrice).filter((val) => val > 0);
  const minPrice =
    validPrices.length > 0
      ? Math.min(...validPrices)
      : parseSmartRupiahNumber(p.priceNum ?? p.price ?? 0);
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : minPrice;

  let priceDisplay = 'Hubungi Marketing';
  if (validPrices.length > 0) {
    priceDisplay =
      minPrice === maxPrice
        ? formatCompactRupiah(minPrice)
        : `${formatCompactRupiah(minPrice)} - ${formatCompactRupiah(maxPrice)}`;
  } else if (minPrice > 0) {
    priceDisplay = formatCompactRupiah(minPrice);
  } else if (p.price) {
    priceDisplay = p.price;
  }

  const publicLoc = formatPublicLocation(p.location || '');
  const rawExactLoc = p.exactLocation ?? getProjectCustomMap(p);
  if (rawExactLoc) {
    saveProjectCustomMap(p.id || p.name, rawExactLoc);
    if (p.name) saveProjectCustomMap(p.name, rawExactLoc);
  }
  const resolvedMap = resolveExactMapUrls(rawExactLoc, `${p.name || ''} ${publicLoc}`);

  return {
    ...p,
    location: publicLoc,
    publicLocation: publicLoc,
    exactLocation: resolvedMap.exactLocation,
    mapEmbedUrl: resolvedMap.mapEmbedUrl,
    mapUrl: resolvedMap.mapUrl,
    plainDescription: stripRichText(p.description || ''),
    img: photos[0] || DEFAULT_COVER_IMG,
    photos,
    videos,
    units,
    price: priceDisplay,
    priceRange: priceDisplay,
    priceNum: minPrice,
    maxPriceNum: maxPrice,
    bedsRange: calcMinMaxText(units.map((u) => u.beds), p.beds || 0),
    bathsRange: calcMinMaxText(units.map((u) => u.baths), p.baths || 0),
    carportRange: calcMinMaxText(units.map((u) => u.carport ?? 1), p.carport || 1),
    landAreaRange: calcMinMaxText(units.map((u) => u.landArea), p.landArea || '-'),
    buildAreaRange: calcMinMaxText(units.map((u) => u.buildArea), p.buildArea || '-')
  };
};

export const formatProjectForApi = (p) => {
  const unitsSource = p.units || p.properties || [];
  return {
    id: isValidGuid(p.id) ? p.id : undefined,
    name: p.name || 'Project Baru',
    location: formatPublicLocation(p.location || ''),
    description: p.description || '',
    photos: extractPhotos(p),
    videos: Array.isArray(p.videos) ? p.videos : [],
    properties: unitsSource.map((u) => ({
      id: isValidGuid(u.id) ? u.id : undefined,
      unitCode: u.unitCode || `${u.name || 'Unit'}|CP:${Number(u.carport ?? 1)}`,
      title: u.name || u.title || 'Unit Rumah',
      price: resolveUnitNumericPrice(u),
      status: u.status || 'Tersedia',
      landArea: String(u.landArea ?? ''),
      buildArea: String(u.buildArea ?? ''),
      beds: parseInt(u.beds, 10) || 0,
      baths: parseInt(u.baths, 10) || 0,
      description: u.description || '',
      photos: Array.isArray(u.photos) ? u.photos : [],
      videos: Array.isArray(u.videos) ? u.videos : []
    }))
  };
};

export const normalizeProjectFromApi = (p) => {
  const photos = p.photos || p.Photos || (p.img || p.Img ? [p.img || p.Img] : []);
  const videos = p.videos || p.Videos || [];
  const rawUnits = p.properties || p.Properties || p.units || p.Units || [];

  const units = rawUnits.map((u) => {
    const numericPrice = parseSmartRupiahNumber(u.price ?? u.Price ?? 0);
    const rawUnitCode = String(u.unitCode ?? u.UnitCode ?? '');
    const carportMatch = rawUnitCode.match(/\|CP:(\d+)/);

    return {
      id: u.id ?? u.Id,
      unitCode: rawUnitCode.replace(/\|CP:\d+/, ''),
      name: u.title ?? u.Title ?? u.name ?? u.Name ?? 'Unit Properti',
      rawPrice: numericPrice,
      price: formatCompactRupiah(numericPrice),
      landArea: u.landArea ?? u.LandArea ?? '',
      buildArea: u.buildArea ?? u.BuildArea ?? '',
      beds: Number(u.beds ?? u.Beds ?? 0),
      baths: Number(u.baths ?? u.Baths ?? 0),
      carport: carportMatch ? Number(carportMatch[1]) : Number(u.carport ?? 1),
      status: u.status ?? u.Status ?? 'Tersedia',
      description: u.description ?? u.Description ?? '',
      photos: u.photos ?? u.Photos ?? [],
      videos: u.videos ?? u.Videos ?? []
    };
  });

  const firstUnit = units[0];
  const projectName = p.name ?? p.Name ?? '';

  return computeProjectSummary({
    id: p.id ?? p.Id,
    name: projectName,
    cluster: projectName || p.cluster || '',
    location: formatPublicLocation(p.location ?? p.Location ?? ''),
    description: p.description ?? p.Description ?? '',
    img: photos[0] || p.img || p.Img || DEFAULT_COVER_IMG,
    photos,
    videos,
    units,
    beds: firstUnit ? firstUnit.beds : Number(p.beds ?? 0),
    baths: firstUnit ? firstUnit.baths : Number(p.baths ?? 0),
    carport: firstUnit ? firstUnit.carport : Number(p.carport ?? 1),
    landArea: firstUnit ? firstUnit.landArea : p.landArea ?? '',
    status: firstUnit ? firstUnit.status : p.status ?? p.Status ?? 'Tersedia'
  });
};

/* Membaca pesan error detail dari response JSON ASP.NET Core (ModelValidation / ProblemDetails).*/
const parseApiError = async (res, prefix) => {
  const errorBody = await res.json().catch(() => null);
  const msg = errorBody?.errors
    ? JSON.stringify(errorBody.errors)
    : errorBody?.title || res.statusText;
  throw new Error(`${prefix} (${res.status}): ${msg}`);
};

/* Helper HTTP terpusat untuk menghindari duplikasi boilerplate fetch() di seluruh endpoint apiService. */
const requestApi = async (path, { method = 'GET', body, errorPrefix, detailedError = false } = {}) => {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, options);
  if (!res.ok) {
    if (detailedError) await parseApiError(res, errorPrefix);
    throw new Error(`${errorPrefix} (${res.status})`);
  }
  return res;
};

/**
 * Mengompres file gambar di browser menjadi WebP (maks 1440x1080, kualitas 82%)
 * agar ukuran file menyusut ~85-90% sebelum diunggah ke Cloudflare R2.
 */
export const compressImageToWebp = (file, maxWidth = 1440, maxHeight = 1080, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Gagal mengompres gambar ke WebP.'));
          const baseName = (file.name || 'photo').replace(/\.[^/.]+$/, '');
          resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp' }));
        },
        'image/webp',
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });

export const apiService = {
  
  /** Mengambil seluruh daftar project/cluster beserta unitnya dari PostgreSQL. */
  async getProjects() {
    const res = await requestApi('/properties', { errorPrefix: 'Gagal memuat data properti' });
    const data = await res.json();
    return Array.isArray(data) ? data.map(normalizeProjectFromApi) : [];
  },

  /** Menyimpan project/cluster baru ke PostgreSQL & memicu auto-indexing pgvector. */
  async createProject(projectPayload) {
    const res = await requestApi('/properties', {
      method: 'POST',
      body: formatProjectForApi(projectPayload),
      errorPrefix: 'Gagal menyimpan project',
      detailedError: true
    });
    return normalizeProjectFromApi(await res.json());
  },

  /** Memperbarui data project/cluster beserta daftar unitnya berdasarkan ID. */
  async updateProject(id, projectPayload) {
    const res = await requestApi(`/properties/${id}`, {
      method: 'PUT',
      body: formatProjectForApi({ ...projectPayload, id }),
      errorPrefix: 'Gagal memperbarui project',
      detailedError: true
    });
    return normalizeProjectFromApi(await res.json());
  },

  /** Menghapus project/cluster dari database berdasarkan ID. */
  async deleteProject(id) {
    await requestApi(`/properties/${id}`, {
      method: 'DELETE',
      errorPrefix: 'Gagal menghapus project'
    });
    return true;
  },

  /**
   * Mengompres foto ke WebP lalu mengunggahnya ke Cloudflare R2 via POST /api/media/upload.
   * Di mode localhost (dev), jika R2 belum dikonfigurasi, otomatis fallback ke WebP DataURL agar tetap bisa dites.
   */
  async uploadImage(file) {
    const compressedFile = await compressImageToWebp(file);
    const formData = new FormData();
    formData.append('file', compressedFile);

    try {
      const res = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.url) return data.url;
      }

      const errBody = await res.json().catch(() => null);
      throw new Error(errBody?.message || `Gagal mengunggah foto (${res.status})`);
    } catch (err) {
      // Pengaman khusus development lokal sebelum kredensial R2 diisi di appsettings.json
      if (isLocalhost) {
        console.warn('Upload R2 lokal dilewati (memakai fallback WebP lokal):', err.message);
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        });
      }
      throw err;
    }
  },

  /** Mengirim pesan pengguna ke endpoint RAG Chatbot dengan SessionId UUID aktif. */
  async sendChatMessage(message) {
    const res = await requestApi('/chat', {
      method: 'POST',
      body: { sessionId: getChatSessionId(), message },
      errorPrefix: 'Gagal menghubungi server AI'
    });
    return await res.json();
  },

  /** Mengirim pesan ke endpoint Streaming SSE agar token LLM tampil real-time kata-per-kata. */
  async streamChatMessage(message, { onToken, onDone, signal } = {}) {
    const res = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: getChatSessionId(), message }),
      signal
    });

    if (!res.ok || !res.body) {
      throw new Error(`Gagal membuka stream AI (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const rawEvent of events) {
        const line = rawEvent.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;

        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'token' && payload.text) {
            onToken?.(payload.text);
          } else if (payload.type === 'done') {
            onDone?.(payload);
          }
        } catch {
          // Abaikan chunk JSON parsial
        }
      }
    }
  },

  /** Memulihkan riwayat percakapan berdasarkan UUID sesi pengguna. */
  async getChatHistory(sessionId) {
    const activeId = sessionId || getChatSessionId();
    const res = await requestApi(`/chat/${activeId}`, {
      errorPrefix: 'Gagal memuat riwayat sesi'
    });
    return await res.json();
  },

  /** Menghapus riwayat percakapan pada sesi UUID tertentu di server. */
  async clearChatHistory(sessionId) {
    const activeId = sessionId || getChatSessionId();
    const res = await requestApi(`/chat/${activeId}`, {
      method: 'DELETE',
      errorPrefix: 'Gagal menghapus sesi'
    });
    return await res.json();
  },

  /** Mengambil daftar dokumen tambahan pada Knowledge Base AI (Super Admin). */
  async getKnowledgeDocs() {
    const res = await requestApi('/chat/knowledge', {
      errorPrefix: 'Gagal memuat Knowledge Base'
    });
    return await res.json();
  },

  /** Menambahkan dokumen baru ke Knowledge Base AI beserta vektor embedding-nya. */
  async createKnowledgeDoc(payload) {
    const res = await requestApi('/chat/knowledge', {
      method: 'POST',
      body: payload,
      errorPrefix: 'Gagal menyimpan dokumen ke Knowledge Base'
    });
    return await res.json();
  },

  /** Menghapus dokumen dari Knowledge Base AI berdasarkan ID. */
  async deleteKnowledgeDoc(id) {
    const res = await requestApi(`/chat/knowledge/${id}`, {
      method: 'DELETE',
      errorPrefix: 'Gagal menghapus dokumen Knowledge Base'
    });
    return await res.json();
  },

  /** Mengambil daftar akun tim dari PostgreSQL agar tersinkronisasi di semua browser. */
  async getAccounts() {
    const res = await requestApi('/auth/accounts', {
      errorPrefix: 'Gagal memuat daftar akun'
    });
    return await res.json();
  },

  /** Login dengan skema Last-In Wins (mengambil alih sesi aktif & mengeluarkan perangkat lama). */
  async loginAccount(email, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Gagal login (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /** Mengecek apakah token sesi di browser ini masih menjadi sesi terakhir yang sah di server. */
  async sendSessionHeartbeat(email, sessionToken) {
    const res = await fetch(`${API_BASE_URL}/auth/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sessionToken })
    });
    if (res.status === 401) return { valid: false, kicked: true };
    return { valid: res.ok, kicked: false };
  },

  /** Melepaskan token sesi di server saat pengguna klik Logout. */
  async logoutAccount(email, sessionToken) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sessionToken }),
      keepalive: true
    }).catch(() => {});
  },

  /** Menyimpan atau memperbarui kredensial akun tim di PostgreSQL. */
  async saveAccount(accountPayload) {
    const res = await requestApi('/auth/accounts', {
      method: 'POST',
      body: accountPayload,
      errorPrefix: 'Gagal menyimpan akun'
    });
    return await res.json();
  },

  /** Menghapus kredensial akun tim dari PostgreSQL. */
  async deleteAccount(id) {
    await requestApi(`/auth/accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      errorPrefix: 'Gagal menghapus akun'
    });
    return true;
  }
};    
