import { createStore } from 'solid-js/store';
import { createSignal, createMemo, For, Show } from 'solid-js';
import Navbar from './components/Navbar'; 
import LoginModal from './components/LoginModal';
import Hero from './components/Hero'; 
import { Icons } from './components/Icons';
import Footer from './components/Footer';
import PropertyCard from './components/PropertyCard';
import PropertyDetail from './components/PropertyDetail';
import Dashboard from './components/Dashboard';
import Chatbot from './components/Chatbot';
import FilterBar from './components/FilterBar';

const SEEDED_USERS = {
  admin: { email: 'admin@jakurban.com', password: '123', role: 'ADMIN' },
  superadmin: { email: 'super@jakurban.com', password: '123', role: 'SUPER_ADMIN' }
};

const INITIAL_CLUSTERS = [
  { id: 1, name: 'Cluster Setiabudi', location: 'Jakarta Selatan', price: 'Rp 900jt - 2.1M', priceNum: 900000000, beds: 3, baths: 2, landArea: 120, electricity: 2200, description: 'Hunian Terjangkau di daerah Jakarta Selatan, Terintegrasi dengan sistem smart home', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80' },
  { id: 2, name: 'Cluster Menteng', location: 'Jakarta Pusat', price: 'Rp 2.5M - 4M', priceNum: 2500000000, beds: 4, baths: 3, landArea: 200, electricity: 3500, description: 'Residensial premium di kawasan elite Menteng, dekat dengan fasilitas diplomatik dan pusat pemerintahan', img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80' },
  { id: 3, name: 'Cluster Kemang', location: 'Jakarta Selatan', price: 'Rp 1.2M - 1.8M', priceNum: 1200000000, beds: 3, baths: 2, landArea: 150, electricity: 2200, description: 'Hunian modern di area Kemang yang terkenal dengan gaya hidup kosmopolitan dan kuliner internasional', img: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80' },
  { id: 4, name: 'Cluster BSD', location: 'Tangerang', price: 'Rp 700jt - 1.2M', priceNum: 700000000, beds: 2, baths: 2, landArea: 90, electricity: 1300, description: 'Kawasan mandiri BSD City dengan konsep kota modern, lengkap dengan fasilitas komersial dan pendidikan', img: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=600&q=80' },
  { id: 5, name: 'Cluster Kelapa Gading', location: 'Jakarta Utara', price: 'Rp 1.5M - 2.2M', priceNum: 1500000000, beds: 4, baths: 3, landArea: 180, electricity: 3500, description: 'Hunian eksklusif di kawasan Kelapa Gading dengan akses mudah ke Mall of Indonesia dan pusat bisnis', img: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80' },
  { id: 6, name: 'Cluster Cibubur', location: 'Bekasi', price: 'Rp 450jt - 800jt', priceNum: 450000000, beds: 2, baths: 1, landArea: 72, electricity: 1300, description: 'Hunian asri dengan suasana hijau di perbatasan Jakarta-Bekasi, cocok untuk keluarga muda', img: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=600&q=80' },
];

function App() {
  const [user, setUser] = createSignal(null);
  const [view, setView] = createSignal('catalog');
  const [showLogin, setShowLogin] = createSignal(false);
  const [loginForm, setLoginForm] = createStore({ email: '', password: '' });
  const [clusters, setClusters] = createStore(INITIAL_CLUSTERS);
  const [selectedProperty, setSelectedProperty] = createSignal(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filters, setFilters] = createSignal({ location: '', priceRange: '', sort: '' });

  // Filter & search logic
  const filteredClusters = createMemo(() => {
    let result = [...clusters];
    
    // Search filter
    const q = searchQuery().toLowerCase();
    if (q) {
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.location.toLowerCase().includes(q) || 
        c.description.toLowerCase().includes(q) ||
        c.price.toLowerCase().includes(q)
      );
    }
    
    // Location filter
    const f = filters();
    if (f.location) {
      result = result.filter(c => c.location === f.location);
    }
    
    // Price range filter
    if (f.priceRange) {
      result = result.filter(c => {
        const p = c.priceNum || 0;
        switch (f.priceRange) {
          case '< Rp 500jt': return p < 500000000;
          case 'Rp 500jt - 1M': return p >= 500000000 && p <= 1000000000;
          case 'Rp 1M - 2M': return p > 1000000000 && p <= 2000000000;
          case '> Rp 2M': return p > 2000000000;
          default: return true;
        }
      });
    }
    
    // Sort
    if (f.sort === 'Harga Terendah') {
      result.sort((a, b) => (a.priceNum || 0) - (b.priceNum || 0));
    } else if (f.sort === 'Harga Tertinggi') {
      result.sort((a, b) => (b.priceNum || 0) - (a.priceNum || 0));
    }
    
    return result;
  });

  const uniqueLocations = createMemo(() => {
    return [...new Set(clusters.map(c => c.location))];
  });

  const handleLogin = (e) => {
    e.preventDefault();
    let auth = null;
    if (loginForm.email === SEEDED_USERS.admin.email && loginForm.password === SEEDED_USERS.admin.password) auth = SEEDED_USERS.admin;
    else if (loginForm.email === SEEDED_USERS.superadmin.email && loginForm.password === SEEDED_USERS.superadmin.password) auth = SEEDED_USERS.superadmin;
    if (auth) { setUser(auth.role); setShowLogin(false); setView('dashboard'); }
    else { alert('Kredensial tidak valid.'); }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setView('catalog');
  };

  const handleFilter = (filterData) => {
    setFilters(filterData);
  };

  return (
    <div class="app">
      <Navbar 
        view={view()} 
        setView={setView} 
        user={user()} 
        onLoginClick={() => setShowLogin(true)} 
        onLogout={() => {
          if (window.confirm("Apakah Anda yakin ingin keluar?")) { setUser(null); setView('catalog'); }
        }} 
      />

      <main>
        <Show when={view() === 'catalog'}>
          <Hero onSearch={handleSearch} />
          <div class="container">
            <div class="section-header">
              <div class="section-title"><h2>Daftar Properti</h2></div>
              <Show when={searchQuery()}>
                <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
                  <span style={{ color: '#666', "font-size": '14px' }}>Hasil pencarian: "{searchQuery()}"</span>
                  <button 
                    style={{ background: 'none', border: '1px solid #ddd', "border-radius": '50px', padding: '4px 12px', cursor: 'pointer', "font-size": '13px', color: '#666' }}
                    onClick={() => setSearchQuery('')}
                  >
                    ✕ Reset
                  </button>
                </div>
              </Show>
            </div>
            <FilterBar onFilter={handleFilter} locations={uniqueLocations()} />
            <Show when={filteredClusters().length > 0} fallback={
              <div style={{ "text-align": 'center', padding: '80px 20px', color: '#999' }}>
                <svg viewBox="0 0 24 24" style={{ width: '48px', height: '48px', stroke: '#ccc', fill: 'none', "stroke-width": '1.5', "margin-bottom": '15px' }}>
                  <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3 style={{ color: '#999', "font-weight": '600' }}>Tidak ada properti ditemukan</h3>
                <p style={{ "font-size": '14px' }}>Coba ubah filter atau kata kunci pencarian Anda.</p>
              </div>
            }>
              <div class="catalog-grid">
                <For each={filteredClusters()}>{(c) => (
                  <PropertyCard 
                    property={c} 
                    onCardClick={() => { setSelectedProperty(c); setView('detail'); }} 
                  />
                )}</For>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={view() === 'detail'}>
          <Show when={selectedProperty()}> 
            <PropertyDetail property={selectedProperty()} setView={setView} />
          </Show>
        </Show>

        <Show when={view() === 'dashboard' && (user() === 'ADMIN' || user() === 'SUPER_ADMIN')}>
          <Dashboard clusters={clusters} setClusters={setClusters} setView={setView} />
        </Show>

        <Show when={view() === 'chatbot'}>
          <Chatbot setView={setView} />
        </Show>
      </main>

      <Show when={view() !== 'chatbot'}>
        <Footer />
      </Show>

      <LoginModal isOpen={showLogin()} onClose={() => setShowLogin(false)} onSubmit={handleLogin} setLoginForm={setLoginForm} />

      <Show when={view() !== 'chatbot'}>
        <div class="chatbot-trigger" onClick={() => setView('chatbot')}><Icons.Chat /></div>
      </Show>
    </div>
  );
}

export default App;
