import { createStore } from 'solid-js/store';
import { createSignal, createMemo, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import Navbar from './components/common/Navbar';
import LoginModal from './components/common/LoginModal';
import Hero from './components/catalog/Hero';
import { Icons } from './components/common/Icons';
import Footer from './components/common/Footer';
import PropertyCard from './components/catalog/PropertyCard';
import PropertyDetail from './views/PropertyDetail';
import Dashboard from './views/Dashboard';
import Chatbot from './views/Chatbot';
import FilterBar from './components/catalog/FilterBar';
import UnitDetail from './views/UnitDetail';
import { apiService, computeProjectSummary } from './services/api';
import TrustHeroSlides from './components/catalog/TrustHeroSlides';
import ModernShowcaseSection from './components/catalog/ModernShowcaseSection';
import { captureAgentFromUrl, t } from './utils/i18n';

const DEFAULT_ACCOUNTS = [
  {
    id: 'usr-super-1',
    name: 'Super Admin (Owner)',
    email: 'super@jakurban.com',
    password: '123',
    phone: '6287819112003',
    slug: 'owner',
    role: 'SUPER_ADMIN',
    title: 'Principal / Super Admin',
    createdAt: '01 Okt 2026, 09:00'
  },
  {
    id: 'usr-admin-1',
    name: 'Andi Pratama',
    email: 'admin@jakurban.com',
    password: '123',
    phone: '6281298765432',
    slug: 'andi-pratama',
    role: 'ADMIN',
    title: 'Senior Property Agent',
    createdAt: '05 Okt 2026, 10:30'
  }
];

const DEFAULT_LOGS = [
  {
    id: 'log-1',
    actorName: 'Super Admin (Owner)',
    actorEmail: 'super@jakurban.com',
    actorRole: 'SUPER_ADMIN',
    action: 'CREATE',
    category: 'TEAM',
    target: 'Andi Pratama (admin@jakurban.com)',
    details: 'Menambahkan kredensial akun Admin/Agent baru',
    timestamp: '20 Okt 2026, 09:15'
  },
  {
    id: 'log-2',
    actorName: 'Andi Pratama',
    actorEmail: 'admin@jakurban.com',
    actorRole: 'ADMIN',
    action: 'UPDATE',
    category: 'PROJECT',
    target: 'Cluster Setiabudi',
    details: 'Memperbarui harga dan ketersediaan unit',
    timestamp: '20 Okt 2026, 11:40'
  }
];

const INITIAL_CLUSTERS = [
  computeProjectSummary({
    id: 'proj-setiabudi',
    name: 'Cluster Setiabudi',
    location: 'Kec. Setiabudi, Jakarta Selatan',
    electricity: 2200,
    description: 'Hunian terjangkau di daerah Jakarta Selatan, terintegrasi dengan sistem smart home dan dekat akses MRT/LRT.',
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80'
    ],
    videos: [],
    units: [
      {
        id: 'u-101',
        name: 'Tipe Sapphire 72/90',
        rawPrice: 900000000,
        beds: 2,
        baths: 1,
        carport: 1,
        landArea: 90,
        buildArea: 72,
        status: 'Tersedia',
        description: 'Tipe compact modern 2 lantai untuk keluarga muda.',
        photos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80']
      },
      {
        id: 'u-102',
        name: 'Tipe Emerald 110/120',
        rawPrice: 1350000000,
        beds: 3,
        baths: 2,
        carport: 2,
        landArea: 120,
        buildArea: 110,
        status: 'Tersedia',
        description: 'Tipe sudut 2 lantai dengan smart door lock dan taman belakang luas.',
        photos: ['https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80']
      }
    ]
  }),
  computeProjectSummary({
    id: 'proj-menteng',
    name: 'Cluster Menteng',
    location: 'Kec. Menteng, Jakarta Pusat',
    electricity: 3500,
    description: 'Residensial premium di kawasan elite Menteng, dekat dengan fasilitas diplomatik dan pusat pemerintahan.',
    photos: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
    ],
    videos: [],
    units: [
      {
        id: 'u-201',
        name: 'Tipe Sovereign 180/200',
        rawPrice: 2500000000,
        beds: 4,
        baths: 3,
        carport: 2,
        landArea: 200,
        buildArea: 180,
        status: 'Tersedia',
        description: 'Hunian mewah 2 lantai dengan private courtyard.',
        photos: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80']
      },
      {
        id: 'u-202',
        name: 'Tipe Grand Ambassador 250/280',
        rawPrice: 3800000000,
        beds: 5,
        baths: 4,
        carport: 3,
        landArea: 280,
        buildArea: 250,
        status: 'Booking',
        description: 'Tipe flagship 3 lantai dengan private lift dan kolam renang.',
        photos: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80']
      }
    ]
  }),
  computeProjectSummary({
    id: 'proj-kemang',
    name: 'Cluster Kemang',
    location: 'Kec. Mampang Prapatan, Jakarta Selatan',
    electricity: 2200,
    description: 'Hunian modern di area Kemang yang terkenal dengan gaya hidup kosmopolitan dan sekolah internasional.',
    photos: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=80'
    ],
    videos: [],
    units: [
      {
        id: 'u-301',
        name: 'Tipe Botanica 110/150',
        rawPrice: 1200000000,
        beds: 3,
        baths: 2,
        carport: 1,
        landArea: 150,
        buildArea: 110,
        status: 'Tersedia',
        description: 'Konsep tropis modern dengan sirkulasi udara silang.',
        photos: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80']
      },
      {
        id: 'u-302',
        name: 'Tipe Casavera 145/180',
        rawPrice: 1750000000,
        beds: 4,
        baths: 3,
        carport: 2,
        landArea: 180,
        buildArea: 145,
        status: 'Tersedia',
        description: 'Dilengkapi rooftop garden dan garasi 2 mobil.',
        photos: ['https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=80']
      }
    ]
  })
];

const DEFAULT_ANALYTICS = {
  catalogViews: 1,
  chatQuestionsCount: 0,
  projectClicks: {},
  unitClicks: {}
};

const VISIT_SESSION_KEY = 'jakurban_visitor_session_counted';

const loadStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const createStoredSignal = (key, fallback, { removeWhenNull = false } = {}) => {
  const [state, setState] = createSignal(loadStored(key, fallback));
  const update = (nextVal) => {
    const resolved = typeof nextVal === 'function' ? nextVal(state()) : nextVal;
    setState(resolved);
    try {
      if (removeWhenNull && (resolved === null || resolved === undefined)) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(resolved));
      }
    } catch {
      // Abaikan jika ukuran melebihi kuota cache lokal
    }
  };
  return [state, update];
};

const formatTimestampId = (date = new Date()) =>
  `${date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })}, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

function App() {
  const [currentUser, setCurrentUser] = createStoredSignal('jakurban_current_user', null, { removeWhenNull: true });
  const [user, setUser] = createStoredSignal('jakurban_user_role', null, { removeWhenNull: true });
  const [accounts, updateAccounts] = createStoredSignal('jakurban_accounts', DEFAULT_ACCOUNTS);
  const [activityLogs, setActivityLogs] = createStoredSignal('jakurban_activity_logs', DEFAULT_LOGS);
  const [analytics, saveAnalytics] = createStoredSignal('jakurban_analytics', DEFAULT_ANALYTICS);
  const [view, setViewStorage] = createStoredSignal('jakurban_active_view', 'catalog');
  const [selectedPropertyId, setSelectedPropertyId] = createStoredSignal('jakurban_selected_property_id', null, { removeWhenNull: true });
  const [selectedUnitId, setSelectedUnitId] = createStoredSignal('jakurban_selected_unit_id', null, { removeWhenNull: true });

  const [showLogin, setShowLogin] = createSignal(false);
  const [showLogoutModal, setShowLogoutModal] = createSignal(false);
  const [loginForm, setLoginForm] = createStore({ email: '', password: '' });
  const [clusters, setClustersState] = createSignal(
    loadStored('jakurban_cached_clusters', INITIAL_CLUSTERS).map(computeProjectSummary)
  );
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filters, setFilters] = createSignal({ location: '', priceRange: '', sort: '' });
  const [pendingChatPrompt, setPendingChatPrompt] = createSignal('');

  /* Memeriksa apakah pengguna aktif memiliki otoritas Admin atau Super Admin. */
  const isAdmin = () =>
    ['ADMIN', 'SUPER_ADMIN'].includes(user()) ||
    ['ADMIN', 'SUPER_ADMIN'].includes(currentUser()?.role);

  const isPublicView = () => view() !== 'chatbot' && view() !== 'dashboard';

  const setClusters = (nextClusters) => {
    const resolved = typeof nextClusters === 'function' ? nextClusters(clusters()) : nextClusters;
    const normalized = (resolved || []).map(computeProjectSummary);
    setClustersState(normalized);
    try {
      localStorage.setItem('jakurban_cached_clusters', JSON.stringify(normalized));
    } catch {
      try {
        const lightCache = normalized.map((p) => ({
          ...p,
          videos: (p.videos || []).filter((v) => !String(v).startsWith('data:video/'))
        }));
        localStorage.setItem('jakurban_cached_clusters', JSON.stringify(lightCache));
      } catch {
        // Abaikan jika localStorage penuh
      }
    }
  };

  let isHandlingPopState = false;

  const buildUrlHash = (targetView, propId, unitId) => {
    if (targetView === 'detail' && propId) return `#detail/${encodeURIComponent(propId)}`;
    if (targetView === 'unit-detail' && propId && unitId) {
      return `#unit/${encodeURIComponent(propId)}/${encodeURIComponent(unitId)}`;
    }
    if (targetView === 'dashboard') return '#dashboard';
    if (targetView === 'chatbot') return '#chatbot';
    return window.location.pathname + window.location.search;
  };

  const setSelectedProperty = (prop) => setSelectedPropertyId(prop?.id ?? null);
  const setSelectedUnit = (unit) => setSelectedUnitId(unit?.id ?? unit?.name ?? null);

  const setView = (nextView, { replace = false } = {}) => {
    if (nextView === 'dashboard') {
      localStorage.setItem('jakurban_dashboard_tab', 'analytics');
    }
    setViewStorage(nextView);

    if (!isHandlingPopState && typeof window !== 'undefined') {
      const stateObj = {
        view: nextView,
        propertyId: selectedPropertyId(),
        unitId: selectedUnitId()
      };
      const targetUrl = buildUrlHash(nextView, stateObj.propertyId, stateObj.unitId);
      const currentState = window.history.state;

      const isSameState =
        currentState &&
        currentState.view === stateObj.view &&
        String(currentState.propertyId ?? '') === String(stateObj.propertyId ?? '') &&
        String(currentState.unitId ?? '') === String(stateObj.unitId ?? '');

      if (replace || !currentState) {
        window.history.replaceState(stateObj, '', targetUrl);
      } else if (!isSameState) {
        window.history.pushState(stateObj, '', targetUrl);
      }
    }
  };

  const selectedProperty = createMemo(() => {
    const list = clusters() || [];
    const targetId = selectedPropertyId();
    if (!targetId) return list[0] || null;
    return list.find((p) => String(p.id) === String(targetId)) || list[0] || null;
  });

  const selectedUnit = createMemo(() => {
    const units = selectedProperty()?.units || [];
    const targetUnitId = selectedUnitId();
    if (!targetUnitId) return units[0] || null;
    return (
      units.find(
        (u) => String(u.id) === String(targetUnitId) || String(u.name) === String(targetUnitId)
      ) ||
      units[0] ||
      null
    );
  });

  createEffect(() => {
    if (view() === 'dashboard' && !isAdmin()) {
      setView('catalog');
    }
  });

  // Hanya catat kunjungan jika user BUKAN Admin/Super Admin dan belum dihitung pada sesi tab ini
  const recordVisitorCatalogView = () => {
    if (isAdmin()) return;
    if (view() === 'dashboard') return;
    try {
      if (sessionStorage.getItem(VISIT_SESSION_KEY)) return;
      sessionStorage.setItem(VISIT_SESSION_KEY, '1');
    } catch {
      // Abaikan jika sessionStorage diblokir browser
    }

    saveAnalytics((prev) => ({
      ...prev,
      catalogViews: (prev.catalogViews || 0) + 1
    }));
  };

  onMount(async () => {
    // Tangkap parameter referral agent (?agent=...) dari URL jika ada
    captureAgentFromUrl();
    const initialView = view();
    const initPropId = selectedPropertyId();
    const initUnitId = selectedUnitId();

    window.history.replaceState(
      { view: 'catalog', propertyId: null, unitId: null },
      '',
      buildUrlHash('catalog', null, null)
    );

    if (initialView && initialView !== 'catalog') {
      if (initialView === 'unit-detail' && initPropId) {
        window.history.pushState(
          { view: 'detail', propertyId: initPropId, unitId: null },
          '',
          buildUrlHash('detail', initPropId, null)
        );
      }
      window.history.pushState(
        { view: initialView, propertyId: initPropId, unitId: initUnitId },
        '',
        buildUrlHash(initialView, initPropId, unitId)
      );
    }

    const handlePopState = (event) => {
      isHandlingPopState = true;
      const state = event.state;

      if (state && state.view) {
        if (state.propertyId !== undefined) setSelectedPropertyId(state.propertyId);
        if (state.unitId !== undefined) setSelectedUnitId(state.unitId);

        const targetView =
          state.view === 'dashboard' && !isAdmin() ? 'catalog' : state.view;
        setViewStorage(targetView);
      } else {
        setViewStorage('catalog');
      }

      scrollToTop();
      isHandlingPopState = false;
    };

    window.addEventListener('popstate', handlePopState);
    onCleanup(() => window.removeEventListener('popstate', handlePopState));

    recordVisitorCatalogView();

    try {
      const serverProjects = await apiService.getProjects();
      if (Array.isArray(serverProjects) && serverProjects.length > 0) {
        setClusters(serverProjects);
      }
    } catch (err) {
      console.warn('Menggunakan katalog lokal sementara (API belum aktif):', err.message);
    }
  });

  const addActivityLog = ({ action, category = 'PROJECT', target, details }, actorOverride = null) => {
    const actor = actorOverride || currentUser() || {
      name: 'Admin',
      email: 'admin@jakurban.com',
      role: user() || 'ADMIN'
    };

    const newEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      category,
      target,
      details,
      timestamp: formatTimestampId()
    };

    setActivityLogs((prev) => [newEntry, ...prev]);
  };

  const incrementClickMetric = (bucket, key) => {
    if (isAdmin()) return;
    saveAnalytics((prev) => ({
      ...prev,
      [bucket]: {
        ...(prev[bucket] || {}),
        [key]: ((prev[bucket] || {})[key] || 0) + 1
      }
    }));
  };

  // Jangan hitung klik project bila yang mengklik adalah Admin / Super Admin
  const trackProjectClick = (project) => {
    if (isAdmin() || !project) return;
    incrementClickMetric('projectClicks', project.name || `Project-${project.id}`);
  };

  // Jangan hitung klik unit bila yang mengklik adalah Admin / Super Admin
  const trackUnitClick = (unit, project) => {
    if (isAdmin() || !unit) return;
    incrementClickMetric('unitClicks', `${unit.name} (${project?.name || 'Cluster'})`);
  };

  // Jangan hitung sesi/pertanyaan chat bila yang mencoba adalah Admin / Super Admin
  const trackChatInteraction = () => {
    if (isAdmin()) return;
    saveAnalytics((prev) => ({
      ...prev,
      chatQuestionsCount: (prev.chatQuestionsCount || 0) + 1
    }));
  };

  const handleOpenChatWithPrompt = (promptText) => {
    if (promptText) setPendingChatPrompt(promptText);
    setView('chatbot');
  };

  const filteredClusters = createMemo(() => {
    let result = [...(clusters() || [])];
    const q = searchQuery().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.location || '').toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.price || '').toLowerCase().includes(q) ||
          (c.units || []).some((u) => (u.name || '').toLowerCase().includes(q))
      );
    }

    const f = filters();
    if (f.location) {
      const locQuery = f.location.toLowerCase();
      result = result.filter((c) => (c.location || '').toLowerCase().includes(locQuery));
    }

    if (f.priceRange && f.priceRange !== 'Semua') {
      result = result.filter((c) => {
        const minP = Number(c.priceNum || 0);
        const maxP = Number(c.maxPriceNum || minP);
        switch (f.priceRange) {
          case '< Rp 500jt':
            return minP > 0 && minP < 500000000;
          case 'Rp 500jt - 1M':
            return maxP >= 500000000 && minP <= 1000000000;
          case 'Rp 1M - 2M':
            return maxP > 1000000000 && minP <= 2000000000;
          case '> Rp 2M':
            return maxP > 2000000000;
          default:
            return true;
        }
      });
    }

    if (f.sort === 'Harga Terendah') {
      result.sort((a, b) => (a.priceNum || 0) - (b.priceNum || 0));
    } else if (f.sort === 'Harga Tertinggi') {
      result.sort((a, b) => (b.maxPriceNum || b.priceNum || 0) - (a.maxPriceNum || a.priceNum || 0));
    }

    return result;
  });

  const uniqueLocations = createMemo(() => [
    ...new Set((clusters() || []).map((c) => c.location).filter(Boolean))
  ]);

  const handleLogin = (e) => {
    e.preventDefault();
    const emailInput = (loginForm.email || '').trim().toLowerCase();
    const passInput = (loginForm.password || '').trim();

    const matchedAccount = accounts().find(
      (acc) => acc.email.toLowerCase() === emailInput && acc.password === passInput
    );

    if (matchedAccount) {
      setCurrentUser(matchedAccount);
      setUser(matchedAccount.role);
      setShowLogin(false);
      addActivityLog(
        {
          action: 'LOGIN',
          category: 'AUTH',
          target: 'Portal Dashboard',
          details: `${matchedAccount.name} masuk ke sistem sebagai ${
            matchedAccount.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin / Agent'
          }`
        },
        matchedAccount
      );
      setView('dashboard');
    } else {
      alert('Kredensial tidak valid. Pastikan email dan password sesuai dengan yang terdaftar.');
    }
  };

  // Buka Pop-Up Modal Logout
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  // Eksekusi Logout saat dikonfirmasi di Pop-Up Modal
  const confirmLogout = () => {
    const activeAccount = currentUser();
    if (activeAccount) {
      addActivityLog(
        {
          action: 'LOGOUT',
          category: 'AUTH',
          target: 'Portal Dashboard',
          details: `${activeAccount.name} keluar dari sesi sistem`
        },
        activeAccount
      );
    }
    setShowLogoutModal(false);
    setUser(null);
    setCurrentUser(null);
    setView('catalog');
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setView('catalog');
  };

  return (
    <div class="app">
      <Show when={isPublicView()}>
        <Navbar
          view={view()}
          setView={setView}
          user={user()}
          onLoginClick={() => setShowLogin(true)}
          onLogout={handleLogout}
        />
      </Show>

      <main>
        <Show when={view() === 'catalog'}>
          <Hero onSearch={handleSearch} />
          <div class="container">
            <div class="section-header">
              <div class="section-title">
                <h2>{t('propertyListTitle')}</h2>
              </div>
              <Show when={searchQuery()}>
                <div class="search-reset-bar">
                  <span class="search-result-label">
                    {t('searchResultFor')} "{searchQuery()}"
                  </span>
                  <button type="button" class="btn-reset-search" onClick={() => setSearchQuery('')}>
                    {t('resetSearch')}
                  </button>
                </div>
              </Show>
            </div>
            <FilterBar onFilter={setFilters} locations={uniqueLocations()} />
            <Show
              when={filteredClusters().length > 0}
              fallback={
                <div class="catalog-empty-state">
                  <svg viewBox="0 0 24 24" class="catalog-empty-icon">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <h3>{t('noPropertyFound')}</h3>
                  <p>{t('noPropertySub')}</p>
                </div>
              }
            >
              <div class="catalog-grid">
                <For each={filteredClusters()}>
                  {(c) => (
                    <PropertyCard
                      property={c}
                      onCardClick={() => {
                        trackProjectClick(c);
                        setSelectedProperty(c);
                        setView('detail');
                        scrollToTop();
                      }}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
          <TrustHeroSlides />
          <ModernShowcaseSection />
        </Show>

        <Show when={view() === 'detail' && selectedProperty()}>
          <PropertyDetail
            property={selectedProperty()}
            setView={setView}
            onAskChatbot={handleOpenChatWithPrompt}
            onSelectUnit={(unit) => {
              trackUnitClick(unit, selectedProperty());
              setSelectedUnit(unit);
              setView('unit-detail');
              scrollToTop();
            }}
          />
        </Show>

        <Show when={view() === 'unit-detail' && selectedUnit()}>
          <UnitDetail
            unit={selectedUnit()}
            project={selectedProperty()}
            onBack={() => setView('detail')}
            setView={setView}
            onAskChatbot={handleOpenChatWithPrompt}
          />
        </Show>

        <Show when={view() === 'dashboard' && isAdmin()}>
          <Dashboard
            clusters={clusters()}
            setClusters={setClusters}
            setView={setView}
            userRole={user()}
            currentUser={currentUser()}
            accounts={accounts()}
            setAccounts={updateAccounts}
            activityLogs={activityLogs()}
            addActivityLog={addActivityLog}
            analytics={analytics()}
            onLogout={handleLogout}
          />
        </Show>

        <Show when={view() === 'chatbot'}>
          <Chatbot
            setView={setView}
            initialPrompt={pendingChatPrompt()}
            onPromptConsumed={() => setPendingChatPrompt('')}
            onMessageSent={trackChatInteraction}
            onSelectRecommendedUnit={(rec) => {
              const foundProject = (clusters() || []).find(
                (p) => p.id === rec.projectId || p.name === rec.projectName
              );
              if (foundProject) {
                setSelectedProperty(foundProject);
                const foundUnit = (foundProject.units || []).find(
                  (u) => u.id === rec.id || u.name === rec.name
                );
                if (foundUnit) {
                  setSelectedUnit(foundUnit);
                  setView('unit-detail');
                  return;
                }
                setView('detail');
              }
            }}
          />
        </Show>
      </main>

      <Show when={isPublicView()}>
        <Footer />
      </Show>

      <LoginModal
        isOpen={showLogin()}
        onClose={() => setShowLogin(false)}
        onSubmit={handleLogin}
        setLoginForm={setLoginForm}
      />

      {/* POP-UP MODAL KONFIRMASI LOGOUT */}
      <Show when={showLogoutModal()}>
        <div class="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div class="modal-content logout-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              class="close-modal-btn"
              onClick={() => setShowLogoutModal(false)}
              aria-label="Tutup"
            >
              <Icons.Close />
            </button>

            <div class="logout-icon-circle">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>

            <h2 class="modal-title" style={{ 'margin-bottom': '8px' }}>
              Konfirmasi Keluar Sesi
            </h2>
            <p class="logout-modal-desc">
              Apakah Anda yakin ingin keluar?
            </p>

            <div class="logout-modal-actions">
              <button
                type="button"
                class="btn-cancel-logout"
                onClick={() => setShowLogoutModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                class="btn-confirm-logout"
                onClick={confirmLogout}
              >
                Ya, Keluar Sesi
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={isPublicView() && !isAdmin()}>
        <div class="chatbot-trigger" onClick={() => setView('chatbot')}>
          <Icons.Chat />
        </div>
      </Show>
    </div>
  );
}

export default App;