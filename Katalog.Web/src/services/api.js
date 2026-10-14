// Sesuaikan port dengan Katalog.Api/Properties/launchSettings.json (biasanya 5000, 5123, atau 5200)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5151/api';

const SESSION_STORAGE_KEY = 'jakurban_chat_session_uuid';

// Ambil atau buat UUID unik per sesi user agar chat tidak pernah bertabrakan
export const getChatSessionId = () => {
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
};

// Buat UUID baru saat user klik tombol "New chat"
export const resetChatSessionId = () => {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  return getChatSessionId();
};

export const normalizeProjectFromApi = (p) => {
  const photos = p.photos || p.Photos || (p.img || p.Img ? [p.img || p.Img] : []);
  const videos = p.videos || p.Videos || [];
  const rawUnits = p.units || p.Units || [];

  const units = rawUnits.map((u) => ({
    id: u.id ?? u.Id,
    name: u.name ?? u.Name ?? '',
    price: u.price ?? u.Price ?? '',
    landArea: u.landArea ?? u.LandArea ?? '',
    buildArea: u.buildArea ?? u.BuildArea ?? '',
    beds: Number(u.beds ?? u.Beds ?? 0),
    baths: Number(u.baths ?? u.Baths ?? 0),
    status: u.status ?? u.Status ?? 'Tersedia',
    description: u.description ?? u.Description ?? ''
  }));

  const firstUnit = units[0];

  return {
    id: p.id ?? p.Id,
    name: p.name ?? p.Name ?? '',
    cluster: p.cluster ?? p.Cluster ?? p.name ?? p.Name ?? '',
    location: p.location ?? p.Location ?? '',
    description: p.description ?? p.Description ?? '',
    img:
      photos[0] ||
      p.img ||
      p.Img ||
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    photos,
    videos,
    units,
    price: firstUnit ? firstUnit.price : p.price ?? p.Price ?? 'Hubungi Marketing',
    status: firstUnit ? firstUnit.status : p.status ?? p.Status ?? 'Tersedia'
  };
};

export const apiService = {
  async getProjects() {
    const res = await fetch(`${API_BASE_URL}/properties`);
    if (!res.ok) throw new Error(`Gagal memuat data properti (${res.status})`);
    const data = await res.json();
    return Array.isArray(data) ? data.map(normalizeProjectFromApi) : [];
  },

  async createProject(projectPayload) {
    const res = await fetch(`${API_BASE_URL}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectPayload)
    });
    if (!res.ok) throw new Error(`Gagal menyimpan project (${res.status})`);
    const saved = await res.json();
    return normalizeProjectFromApi(saved);
  },

  async updateProject(id, projectPayload) {
    const res = await fetch(`${API_BASE_URL}/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...projectPayload, id })
    });
    if (!res.ok) throw new Error(`Gagal memperbarui project (${res.status})`);
    const updated = await res.json();
    return normalizeProjectFromApi(updated);
  },

  async deleteProject(id) {
    const res = await fetch(`${API_BASE_URL}/properties/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`Gagal menghapus project (${res.status})`);
    return true;
  },

  async sendChatMessage(message) {
    const sessionId = getChatSessionId();
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message,
        query: message,
        prompt: message
      })
    });
    if (!res.ok) throw new Error(`Gagal menghubungi server AI (${res.status})`);
    return await res.json();
  }
};