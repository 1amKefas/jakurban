import { createStore } from 'solid-js/store';
import { createSignal, For, Show } from 'solid-js';
import Navbar from './components/Navbar'; 
import LoginModal from './components/LoginModal';
import Hero from './components/Hero'; 
import { Icons } from './components/Icons';
import Footer from './components/Footer';
import PropertyCard from './components/PropertyCard';
import PropertyDetail from './components/PropertyDetail'; // FIXED: Removed the 's'
import Dashboard from './components/Dashboard';

const SEEDED_USERS = {
  admin: { email: 'admin@jakurban.com', password: '123', role: 'ADMIN' },
  superadmin: { email: 'super@jakurban.com', password: '123', role: 'SUPER_ADMIN' }
};

const INITIAL_CLUSTERS = [
  { id: 1, name: 'Cluster Setiabudi', location: 'Jakarta Selatan', price: 'Rp 900jt - 2.1M', description: 'Hunian Terjangkau di daerah Jakarta Selatan, Terintegrasi dengan sistem smart home', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80' }
];

function App() {
  const [user, setUser] = createSignal(null);
  const [view, setView] = createSignal('catalog');
  const [showLogin, setShowLogin] = createSignal(false);
  const [loginForm, setLoginForm] = createStore({ email: '', password: '' });
  const [clusters, setClusters] = createStore(INITIAL_CLUSTERS);
  const [selectedProperty, setSelectedProperty] = createSignal(null);

  const handleLogin = (e) => {
    e.preventDefault();
    let auth = null;
    if (loginForm.email === SEEDED_USERS.admin.email && loginForm.password === SEEDED_USERS.admin.password) auth = SEEDED_USERS.admin;
    else if (loginForm.email === SEEDED_USERS.superadmin.email && loginForm.password === SEEDED_USERS.superadmin.password) auth = SEEDED_USERS.superadmin;
    if (auth) { setUser(auth.role); setShowLogin(false); setView('dashboard'); }
    else { alert('Kredensial tidak valid.'); }
  };

  return (
    <div class="app">
      <Navbar 
        view={view()} 
        setView={setView} 
        user={user()} 
        onLoginClick={() => setShowLogin(true)} 
        onLogout={() => {
          if (window.confirm("Apakah Anda yakin ingin keluar?")) setUser(null);
        }} 
      />

      <main>
        <Show when={view() === 'catalog'}>
          <Hero />
          <div class="container">
            <div class="section-header">
              <div class="section-title"><h2>Daftar Properti</h2></div>
              <div class="filter-bar" style={{ display: 'flex', gap: '10px' }}>
                {['Semua', 'Rumah', 'Apartemen', 'Villa'].map(f => <span class="filter-chip">{f}</span>)}
              </div>
            </div>
            <div class="catalog-grid">
              <For each={clusters}>{(c) => (
                <PropertyCard 
                  property={c} 
                  onCardClick={() => { setSelectedProperty(c); setView('detail'); }} 
                />
              )}</For>
            </div>
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
          <div class="chatbot-fullpage">
            <div class="chat-container">
              <div class="chat-sidebar">
                <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "margin-bottom": '40px' }}>
                  <h3 style={{ margin: 0 }}>JakUrban AI</h3>
                  <button onClick={() => setView('catalog')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Icons.Close /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '14px', opacity: 0.8 }}>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>Saran Lokasi</div>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>Hitung KPR</div>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>Cek Ketersediaan</div>
                </div>
              </div>
              <div class="chat-main">
                <div class="chat-messages">
                  <div class="message-bubble bot-msg" style={{ background: 'var(--color-bg-light)', padding: '20px', borderRadius: '20px', maxWidth: '70%', boxShadow: 'var(--shadow-soft)' }}>
                    Selamat datang di asisten masa depan JakUrban.
                  </div>
                </div>
                <div class="chat-input-area">
                  <input class="chat-input" type="text" placeholder="Tuliskan keinginan hunian Anda..." />
                  <button class="btn-primary">Kirim</button>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </main>

      <Footer />

      <LoginModal isOpen={showLogin()} onClose={() => setShowLogin(false)} onSubmit={handleLogin} setLoginForm={setLoginForm} />

      <Show when={view() !== 'chatbot'}>
        <div class="chatbot-trigger" onClick={() => setView('chatbot')}><Icons.Chat /></div>
      </Show>
    </div>
  );
}

export default App;
