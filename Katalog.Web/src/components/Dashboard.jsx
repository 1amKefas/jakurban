import { createSignal, For, Show, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Icons } from './Icons';
import { apiService } from '../services/api';

export default function Dashboard(props) {
  // State Navigasi & Status Koneksi API
  const [adminView, setAdminView] = createSignal('management');
  const [showProjectModal, setShowProjectModal] = createSignal(false);
  const [isEditingProject, setIsEditingProject] = createSignal(false);
  const [expandedProjects, setExpandedProjects] = createSignal({});
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [apiStatus, setApiStatus] = createSignal('connecting'); // 'online' | 'offline' | 'connecting'

  // State Input Media Sementara di Modal Project
  const [photoUrlInput, setPhotoUrlInput] = createSignal('');
  const [videoUrlInput, setVideoUrlInput] = createSignal('');

  // State Form Unit di dalam Modal Project
  const [showUnitForm, setShowUnitForm] = createSignal(false);
  const [editingUnitIndex, setEditingUnitIndex] = createSignal(null);

  const defaultUnitForm = () => ({
    id: 0,
    name: '',
    price: '',
    landArea: '',
    buildArea: '',
    beds: 2,
    baths: 1,
    status: 'Tersedia',
    description: ''
  });

  const [unitDraft, setUnitDraft] = createStore(defaultUnitForm());

  const defaultProjectForm = () => ({
    id: 0,
    name: '',
    location: '',
    description: '',
    photos: [],
    videos: [],
    units: []
  });

  const [projectForm, setProjectForm] = createStore(defaultProjectForm());

  // Ambil data dari Backend saat Dashboard dibuka
  const loadProjectsFromBackend = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getProjects();
      props.setClusters(data);
      setApiStatus('online');
    } catch (err) {
      console.warn('Backend belum terjangkau, menggunakan state lokal:', err.message);
      setApiStatus('offline');
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    loadProjectsFromBackend();
  });

  const toggleExpandProject = (projectId) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const openAddProjectModal = () => {
    setProjectForm(defaultProjectForm());
    resetUnitDraft();
    setIsEditingProject(false);
    setShowProjectModal(true);
  };

  const openEditProjectModal = (project, openUnitAdder = false) => {
    const existingPhotos = Array.isArray(project.photos)
      ? [...project.photos]
      : project.img
      ? [project.img]
      : [];
    const existingVideos = Array.isArray(project.videos) ? [...project.videos] : [];
    const existingUnits = Array.isArray(project.units)
      ? project.units.map((u) => ({ ...u }))
      : [];

    setProjectForm({
      id: project.id,
      name: project.cluster || project.name || '',
      location: project.location || '',
      description: project.description || '',
      photos: existingPhotos,
      videos: existingVideos,
      units: existingUnits
    });

    resetUnitDraft();
    if (openUnitAdder) setShowUnitForm(true);
    setIsEditingProject(true);
    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setIsEditingProject(false);
    resetUnitDraft();
  };

  // Helper Konversi File ke Base64 agar bisa dikirim ke Backend API via JSON
  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // --- HANDLER MEDIA (FOTO & VIDEO) ---
  const handleAddPhotoUrl = () => {
    const url = photoUrlInput().trim();
    if (!url) return;
    setProjectForm('photos', [...projectForm.photos, url]);
    setPhotoUrlInput('');
  };

  const handlePhotoFilesUpload = async (e) => {
    const files = Array.from(e.currentTarget.files || []);
    if (!files.length) return;
    const base64List = await Promise.all(files.map(fileToDataUrl));
    setProjectForm('photos', [...projectForm.photos, ...base64List]);
    e.currentTarget.value = '';
  };

  const handleRemovePhoto = (index) => {
    setProjectForm(
      'photos',
      projectForm.photos.filter((_, idx) => idx !== index)
    );
  };

  const handleAddVideoUrl = () => {
    const url = videoUrlInput().trim();
    if (!url) return;
    setProjectForm('videos', [...projectForm.videos, url]);
    setVideoUrlInput('');
  };

  const handleVideoFilesUpload = (e) => {
    const files = Array.from(e.currentTarget.files || []);
    if (!files.length) return;
    const fileUrls = files.map((file) => URL.createObjectURL(file));
    setProjectForm('videos', [...projectForm.videos, ...fileUrls]);
    e.currentTarget.value = '';
  };

  const handleRemoveVideo = (index) => {
    setProjectForm(
      'videos',
      projectForm.videos.filter((_, idx) => idx !== index)
    );
  };

  // --- HANDLER UNIT DI DALAM PROJECT ---
  const resetUnitDraft = () => {
    setUnitDraft(defaultUnitForm());
    setEditingUnitIndex(null);
    setShowUnitForm(false);
  };

  const handleSaveUnitToProject = () => {
    if (!unitDraft.name.trim() || !unitDraft.price.trim()) {
      alert('Nama Unit dan Harga wajib diisi!');
      return;
    }

    const savedUnit = {
      ...unitDraft,
      beds: Number(unitDraft.beds || 0),
      baths: Number(unitDraft.baths || 0),
      id: unitDraft.id || Date.now()
    };

    if (editingUnitIndex() !== null) {
      const updatedUnits = [...projectForm.units];
      updatedUnits[editingUnitIndex()] = savedUnit;
      setProjectForm('units', updatedUnits);
    } else {
      setProjectForm('units', [...projectForm.units, savedUnit]);
    }

    resetUnitDraft();
  };

  const handleEditUnitInModal = (index) => {
    const target = projectForm.units[index];
    setUnitDraft({ ...target });
    setEditingUnitIndex(index);
    setShowUnitForm(true);
  };

  const handleRemoveUnitInModal = (index) => {
    setProjectForm(
      'units',
      projectForm.units.filter((_, idx) => idx !== index)
    );
    if (editingUnitIndex() === index) resetUnitDraft();
  };

  // --- SIMPAN PROJECT KE BACKEND API ---
  const handleSaveProject = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const defaultCover =
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80';
    const mainCover = projectForm.photos[0] || defaultCover;
    const firstUnit = projectForm.units[0];

    const payload = {
      id: isEditingProject() ? projectForm.id : 0,
      name: projectForm.name,
      cluster: projectForm.name,
      location: projectForm.location,
      description: projectForm.description,
      img: mainCover,
      photos: [...projectForm.photos],
      videos: [...projectForm.videos],
      units: projectForm.units.map((u) => ({
        ...u,
        beds: Number(u.beds || 0),
        baths: Number(u.baths || 0)
      })),
      price: firstUnit ? firstUnit.price : 'Hubungi Marketing',
      status: firstUnit ? firstUnit.status : 'Tersedia'
    };

    try {
      if (isEditingProject()) {
        const updatedFromServer = await apiService.updateProject(projectForm.id, payload);
        props.setClusters(
          props.clusters.map((c) => (c.id === projectForm.id ? updatedFromServer : c))
        );
      } else {
        const createdFromServer = await apiService.createProject(payload);
        props.setClusters([createdFromServer, ...(props.clusters || [])]);
        setExpandedProjects((prev) => ({ ...prev, [createdFromServer.id]: true }));
      }
      setApiStatus('online');
    } catch (err) {
      console.warn('Simpan ke API gagal, menyimpan ke state lokal:', err.message);
      setApiStatus('offline');
      const fallbackPayload = { ...payload, id: isEditingProject() ? projectForm.id : Date.now() };
      if (isEditingProject()) {
        props.setClusters(
          props.clusters.map((c) => (c.id === fallbackPayload.id ? fallbackPayload : c))
        );
      } else {
        props.setClusters([fallbackPayload, ...(props.clusters || [])]);
        setExpandedProjects((prev) => ({ ...prev, [fallbackPayload.id]: true }));
      }
    } finally {
      setIsSaving(false);
      closeProjectModal();
    }
  };

  // --- HAPUS PROJECT DARI BACKEND API ---
  const handleDeleteProject = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus project ini beserta seluruh unitnya?')) return;

    try {
      await apiService.deleteProject(id);
      setApiStatus('online');
    } catch (err) {
      console.warn('Hapus di API gagal, menghapus dari state lokal:', err.message);
    }
    props.setClusters(props.clusters.filter((p) => p.id !== id));
  };

  // --- HAPUS 1 UNIT DARI SUB-TABEL & UPDATE KE BACKEND ---
  const handleDeleteUnitFromTable = async (project, unitId) => {
    if (!confirm('Hapus unit ini dari project?')) return;

    const updatedUnits = (project.units || []).filter((u) => u.id !== unitId);
    const updatedProjectPayload = { ...project, units: updatedUnits };

    try {
      const saved = await apiService.updateProject(project.id, updatedProjectPayload);
      props.setClusters(props.clusters.map((p) => (p.id === project.id ? saved : p)));
    } catch {
      props.setClusters(
        props.clusters.map((p) => (p.id === project.id ? updatedProjectPayload : p))
      );
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Tersedia':
        return 'badge-success';
      case 'Booking':
        return 'badge-warning';
      case 'Sold':
        return 'badge-danger';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div class="dashboard-layout">
      {/* SIDEBAR */}
      <aside class="sidebar-modern">
        <div class="sidebar-header">
          <div class="brand-logo">✧</div>
          <div>
            <h3 class="brand-title">JakUrban OS</h3>
            <span class="brand-version">Enterprise Panel v3.2</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <button
            class={`nav-btn ${adminView() === 'analytics' ? 'active' : ''}`}
            onClick={() => setAdminView('analytics')}
          >
            <span class="icon">📊</span> Insights
          </button>
          <button
            class={`nav-btn ${adminView() === 'management' ? 'active' : ''}`}
            onClick={() => setAdminView('management')}
          >
            <span class="icon">🏢</span> Project Assets
          </button>

          <div class="nav-divider"></div>

          <button class="nav-btn" onClick={() => props.setView?.('catalog')}>
            <span class="icon">🌐</span> Main Site
          </button>
        </nav>

        <div style={{ "margin-top": 'auto', "padding-top": '16px', "border-top": '1px solid #e2e8f0', "font-size": '12px' }}>
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                "border-radius": '50%',
                background: apiStatus() === 'online' ? '#16a34a' : apiStatus() === 'connecting' ? '#eab308' : '#dc2626'
              }}
            ></span>
            <span>
              API Backend: <strong>{apiStatus() === 'online' ? 'Terhubung' : apiStatus() === 'connecting' ? 'Menghubungkan...' : 'Mode Lokal'}</strong>
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main class="main-workspace">
        {/* VIEW: ANALYTICS */}
        <Show when={adminView() === 'analytics'}>
          <div class="workspace-header">
            <div>
              <h1 class="page-title">Command Center</h1>
              <p class="page-subtitle">Ringkasan performa penjualan dan trafik katalog.</p>
            </div>
          </div>

          <div class="bento-grid">
            <div class="bento-card col-span-2">
              <span class="bento-label">Total Project Terdaftar</span>
              <div class="bento-value">
                {(props.clusters || []).length} <span class="trend up">Project Aktif</span>
              </div>
              <p class="bento-desc">
                Data terintegrasi secara real-time dengan database Katalog.Api.
              </p>
            </div>
            <div class="bento-card row-span-2">
              <span class="bento-label">Top Lead Projects</span>
              <div class="leaderboard">
                <For each={(props.clusters || []).slice(0, 4)}>
                  {(proj) => (
                    <div class="leader-item">
                      <div>
                        <strong>{proj.name}</strong>
                        <br />
                        <span class="text-sm text-gray">{(proj.units || []).length} Unit</span>
                      </div>
                      <div class="metric">{proj.location || 'Jakarta'}</div>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <div class="bento-card">
              <span class="bento-label">Total Unit</span>
              <div class="bento-value">
                {(props.clusters || []).reduce((acc, p) => acc + (p.units?.length || 0), 0)}
              </div>
            </div>
            <div class="bento-card">
              <span class="bento-label">Active Agents</span>
              <div class="bento-value">14</div>
            </div>
          </div>
        </Show>

        {/* VIEW: MANAGEMENT (PROJECT -> UNIT CRUD) */}
        <Show when={adminView() === 'management'}>
          <div class="workspace-header">
            <div>
              <h1 class="page-title">Project Assets</h1>
              <p class="page-subtitle">
                Kelola daftar project/cluster, galeri foto & video, serta inventori unit di dalamnya.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button class="btn-ghost" onClick={loadProjectsFromBackend} disabled={isLoading()}>
                {isLoading() ? 'Memuat...' : '↻ Sync API'}
              </button>
              <button class="btn-primary" onClick={openAddProjectModal}>
                + Tambah Project
              </button>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Project / Cluster</th>
                  <th>Media Galeri</th>
                  <th>Ringkasan Unit</th>
                  <th>Harga Mulai</th>
                  <th class="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={props.clusters}
                  fallback={
                    <tr>
                      <td colSpan="5" style={{ "text-align": 'center', padding: '32px', color: '#64748b' }}>
                        {isLoading() ? 'Sedang memuat data dari server...' : 'Belum ada project properti. Klik "+ Tambah Project" untuk memulai.'}
                      </td>
                    </tr>
                  }
                >
                  {(project) => {
                    const units = () => project.units || [];
                    const photos = () =>
                      project.photos || (project.img ? [project.img] : []);
                    const videos = () => project.videos || [];
                    const isExpanded = () => !!expandedProjects()[project.id];

                    return (
                      <>
                        <tr class="project-row">
                          <td>
                            <div class="project-cell">
                              <button
                                class="expand-btn"
                                onClick={() => toggleExpandProject(project.id)}
                                title="Lihat Daftar Unit"
                              >
                                {isExpanded() ? '▾' : '▸'}
                              </button>
                              <img
                                src={
                                  photos()[0] ||
                                  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=200&q=80'
                                }
                                alt={project.name}
                                class="project-thumb"
                              />
                              <div class="prop-info">
                                <strong>{project.name}</strong>
                                <span>📍 {project.location || 'Jakarta'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div class="media-badges">
                              <span class="media-pill">📷 {photos().length} Foto</span>
                              <span class="media-pill">🎬 {videos().length} Video</span>
                            </div>
                          </td>
                          <td>
                            <div class="unit-summary">
                              <strong>{units().length} Tipe/Unit</strong>
                              <span class="unit-link" onClick={() => toggleExpandProject(project.id)}>
                                {isExpanded() ? 'Sembunyikan unit' : 'Lihat detail unit'}
                              </span>
                            </div>
                          </td>
                          <td class="font-medium">
                            {units()[0]?.price || project.price || '-'}
                          </td>
                          <td class="td-actions">
                            <button
                              class="btn-sm-outline"
                              onClick={() => openEditProjectModal(project, true)}
                            >
                              + Unit
                            </button>
                            <button
                              class="btn-icon edit"
                              title="Edit Project & Media"
                              onClick={() => openEditProjectModal(project, false)}
                            >
                              ✏️
                            </button>
                            <button
                              class="btn-icon delete"
                              title="Hapus Project"
                              onClick={() => handleDeleteProject(project.id)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>

                        <Show when={isExpanded()}>
                          <tr class="units-drawer-row">
                            <td colSpan="5">
                              <div class="units-drawer">
                                <div class="units-drawer-header">
                                  <span>
                                    Daftar Unit di <strong>{project.name}</strong> ({units().length})
                                  </span>
                                  <button
                                    class="btn-xs-primary"
                                    onClick={() => openEditProjectModal(project, true)}
                                  >
                                    + Tambah Unit ke Project Ini
                                  </button>
                                </div>

                                <Show
                                  when={units().length > 0}
                                  fallback={
                                    <div class="empty-units">
                                      Belum ada unit di project ini. Klik "+ Tambah Unit ke Project Ini" untuk menambahkan.
                                    </div>
                                  }
                                >
                                  <div class="units-grid-list">
                                    <For each={units()}>
                                      {(u) => (
                                        <div class="unit-item-card">
                                          <div class="unit-item-main">
                                            <div>
                                              <div class="unit-item-title">
                                                <strong>{u.name}</strong>
                                                <span class={`badge ${getStatusColor(u.status)}`}>
                                                  {u.status}
                                                </span>
                                              </div>
                                              <div class="unit-item-specs">
                                                <span>LT: {u.landArea || '-'}m²</span>
                                                <span>•</span>
                                                <span>LB: {u.buildArea || '-'}m²</span>
                                                <span>•</span>
                                                <span>🛏️ {u.beds} KT</span>
                                                <span>•</span>
                                                <span>🚿 {u.baths} KM</span>
                                              </div>
                                              <Show when={u.description}>
                                                <p class="unit-item-desc">{u.description}</p>
                                              </Show>
                                            </div>
                                            <div class="unit-item-right">
                                              <div class="unit-price">{u.price}</div>
                                              <div class="unit-item-actions">
                                                <button
                                                  class="btn-text"
                                                  onClick={() => openEditProjectModal(project, false)}
                                                >
                                                  Kelola
                                                </button>
                                                <button
                                                  class="btn-text danger"
                                                  onClick={() =>
                                                    handleDeleteUnitFromTable(project, u.id)
                                                  }
                                                >
                                                  Hapus
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </Show>
                              </div>
                            </td>
                          </tr>
                        </Show>
                      </>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </main>

      {/* MODAL TAMBAH / EDIT PROJECT */}
      <Show when={showProjectModal()}>
        <div class="modal-backdrop" onClick={closeProjectModal}>
          <div class="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <div>
                <h2>{isEditingProject() ? 'Edit Project Properti' : 'Tambah Project Baru'}</h2>
                <p class="modal-subtitle">
                  Atur informasi project, unggah beberapa foto/video, dan kelola unit di dalamnya.
                </p>
              </div>
              <button class="btn-close" onClick={closeProjectModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProject} class="modal-body scrollable-body">
              {/* SECTION 1: INFORMASI PROJECT */}
              <div class="form-section">
                <h3 class="section-heading">1. Informasi Project / Cluster</h3>
                <div class="form-grid">
                  <div class="input-group">
                    <label>Nama Project / Cluster</label>
                    <input
                      type="text"
                      placeholder="Cth: Cluster Emerald Residence"
                      value={projectForm.name}
                      onInput={(e) => setProjectForm('name', e.currentTarget.value)}
                      required
                    />
                  </div>

                  <div class="input-group">
                    <label>Lokasi Project</label>
                    <input
                      type="text"
                      placeholder="Cth: Jagakarsa, Jakarta Selatan"
                      value={projectForm.location}
                      onInput={(e) => setProjectForm('location', e.currentTarget.value)}
                      required
                    />
                  </div>

                  <div class="input-group col-span-2">
                    <label>Deskripsi Project & Fasilitas Kawasan</label>
                    <textarea
                      rows="2"
                      placeholder="Fasilitas keamanan 24 jam, clubhouse, dekat akses tol..."
                      value={projectForm.description}
                      onInput={(e) => setProjectForm('description', e.currentTarget.value)}
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* SECTION 2: MULTI FOTO & VIDEO */}
              <div class="form-section">
                <h3 class="section-heading">2. Galeri Media (Multi Foto & Video)</h3>
                <div class="form-grid">
                  <div class="media-box">
                    <label class="media-label">📷 Foto Project ({projectForm.photos.length})</label>
                    <div class="media-input-row">
                      <input
                        type="url"
                        placeholder="Tempel URL foto..."
                        value={photoUrlInput()}
                        onInput={(e) => setPhotoUrlInput(e.currentTarget.value)}
                      />
                      <button type="button" class="btn-secondary" onClick={handleAddPhotoUrl}>
                        + Link
                      </button>
                    </div>
                    <label class="upload-dropzone">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoFilesUpload}
                        hidden
                      />
                      <span>📤 Pilih Beberapa File Foto dari Perangkat</span>
                    </label>

                    <Show when={projectForm.photos.length > 0}>
                      <div class="media-preview-grid">
                        <For each={projectForm.photos}>
                          {(photo, idx) => (
                            <div class="media-thumb-item">
                              <img src={photo} alt={`Foto ${idx() + 1}`} />
                              <button
                                type="button"
                                class="remove-media-btn"
                                onClick={() => handleRemovePhoto(idx())}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>

                  <div class="media-box">
                    <label class="media-label">🎬 Video Project ({projectForm.videos.length})</label>
                    <div class="media-input-row">
                      <input
                        type="url"
                        placeholder="Tempel URL video (MP4/YouTube)..."
                        value={videoUrlInput()}
                        onInput={(e) => setVideoUrlInput(e.currentTarget.value)}
                      />
                      <button type="button" class="btn-secondary" onClick={handleAddVideoUrl}>
                        + Link
                      </button>
                    </div>
                    <label class="upload-dropzone">
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleVideoFilesUpload}
                        hidden
                      />
                      <span>🎥 Pilih Beberapa File Video dari Perangkat</span>
                    </label>

                    <Show when={projectForm.videos.length > 0}>
                      <div class="video-preview-list">
                        <For each={projectForm.videos}>
                          {(video, idx) => (
                            <div class="video-preview-item">
                              <span class="video-name">
                                ▶ Video #{idx() + 1} ({video.slice(0, 32)}...)
                              </span>
                              <button
                                type="button"
                                class="remove-video-btn"
                                onClick={() => handleRemoveVideo(idx())}
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DAFTAR UNIT DI DALAM PROJECT */}
              <div class="form-section">
                <div class="section-header-inline">
                  <div>
                    <h3 class="section-heading" style={{ margin: 0 }}>
                      3. Daftar Unit di Project Ini ({projectForm.units.length})
                    </h3>
                    <span class="text-xs text-muted">
                      Tambahkan beberapa tipe/unit rumah yang dipasarkan di dalam project ini.
                    </span>
                  </div>
                  <Show when={!showUnitForm()}>
                    <button
                      type="button"
                      class="btn-sm-primary"
                      onClick={() => {
                        resetUnitDraft();
                        setShowUnitForm(true);
                      }}
                    >
                      + Tambah Unit
                    </button>
                  </Show>
                </div>

                <Show when={showUnitForm()}>
                  <div class="unit-subform">
                    <div class="unit-subform-header">
                      <strong>
                        {editingUnitIndex() !== null ? 'Edit Unit' : 'Tambah Unit Baru ke Project'}
                      </strong>
                      <button type="button" class="btn-text" onClick={resetUnitDraft}>
                        Tutup
                      </button>
                    </div>

                    <div class="form-grid">
                      <div class="input-group">
                        <label>Nama Unit / Tipe Rumah *</label>
                        <input
                          type="text"
                          placeholder="Cth: Tipe Magnolia 45/90"
                          value={unitDraft.name}
                          onInput={(e) => setUnitDraft('name', e.currentTarget.value)}
                        />
                      </div>

                      <div class="input-group">
                        <label>Harga Unit *</label>
                        <input
                          type="text"
                          placeholder="Cth: Rp 1.250.000.000"
                          value={unitDraft.price}
                          onInput={(e) => setUnitDraft('price', e.currentTarget.value)}
                        />
                      </div>

                      <div class="input-group">
                        <label>Luas Tanah (m²)</label>
                        <input
                          type="number"
                          placeholder="90"
                          value={unitDraft.landArea}
                          onInput={(e) => setUnitDraft('landArea', e.currentTarget.value)}
                        />
                      </div>

                      <div class="input-group">
                        <label>Luas Bangunan (m²)</label>
                        <input
                          type="number"
                          placeholder="45"
                          value={unitDraft.buildArea}
                          onInput={(e) => setUnitDraft('buildArea', e.currentTarget.value)}
                        />
                      </div>

                      <div class="input-group">
                        <label>Kamar Tidur</label>
                        <input
                          type="number"
                          min="0"
                          value={unitDraft.beds}
                          onInput={(e) => setUnitDraft('beds', e.currentTarget.value)}
                        />
                      </div>

                      <div class="input-group">
                        <label>Kamar Mandi</label>
                        <input
                          type="number"
                          min="0"
                          value={unitDraft.baths}
                          onInput={(e) => setUnitDraft('baths', e.currentTarget.value)}
                        />
                      </div>

                      <div class="input-group col-span-2">
                        <label>Status Ketersediaan Unit</label>
                        <select
                          value={unitDraft.status}
                          onChange={(e) => setUnitDraft('status', e.currentTarget.value)}
                        >
                          <option value="Tersedia">Tersedia</option>
                          <option value="Booking">Booking</option>
                          <option value="Sold">Sold (Terjual)</option>
                        </select>
                      </div>

                      <div class="input-group col-span-2">
                        <label>Deskripsi Spesifik Unit</label>
                        <textarea
                          rows="2"
                          placeholder="Smart door lock, carport 2 mobil, menghadap taman..."
                          value={unitDraft.description}
                          onInput={(e) => setUnitDraft('description', e.currentTarget.value)}
                        ></textarea>
                      </div>
                    </div>

                    <div class="unit-subform-actions">
                      <button type="button" class="btn-ghost" onClick={resetUnitDraft}>
                        Batal
                      </button>
                      <button
                        type="button"
                        class="btn-primary"
                        onClick={handleSaveUnitToProject}
                      >
                        {editingUnitIndex() !== null ? 'Update Unit' : 'Simpan Unit ke Daftar'}
                      </button>
                    </div>
                  </div>
                </Show>

                <div class="modal-units-list">
                  <For
                    each={projectForm.units}
                    fallback={
                      <div class="empty-units">
                        Belum ada unit yang ditambahkan. Klik tombol "+ Tambah Unit" di atas.
                      </div>
                    }
                  >
                    {(unit, idx) => (
                      <div class="modal-unit-row">
                        <div>
                          <div class="unit-item-title">
                            <strong>{unit.name}</strong>
                            <span class={`badge ${getStatusColor(unit.status)}`}>
                              {unit.status}
                            </span>
                          </div>
                          <div class="unit-item-specs">
                            <span>{unit.price}</span>
                            <span>•</span>
                            <span>
                              LT {unit.landArea || '-'}m² / LB {unit.buildArea || '-'}m²
                            </span>
                            <span>•</span>
                            <span>
                              {unit.beds} KT, {unit.baths} KM
                            </span>
                          </div>
                        </div>
                        <div class="modal-unit-actions">
                          <button
                            type="button"
                            class="btn-text"
                            onClick={() => handleEditUnitInModal(idx())}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            class="btn-text danger"
                            onClick={() => handleRemoveUnitInModal(idx())}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-ghost" onClick={closeProjectModal}>
                  Batal
                </button>
                <button type="submit" class="btn-primary" disabled={isSaving()}>
                  {isSaving()
                    ? 'Menyimpan...'
                    : isEditingProject()
                    ? 'Simpan Perubahan Project'
                    : 'Simpan Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* CSS STYLES */}
      <style>{`
        :root {
          --surface-bg: #f8fafc;
          --panel-bg: #ffffff;
          --border-color: #e2e8f0;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --primary: #0f172a;
          --primary-hover: #334155;
          --success-bg: #dcfce7;
          --success-text: #166534;
          --warning-bg: #fef08a;
          --warning-text: #854d0e;
          --danger-bg: #fee2e2;
          --danger-text: #991b1b;
          --radius-md: 10px;
          --radius-lg: 16px;
        }

        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif; }
        .dashboard-layout { display: flex; height: 100vh; width: 100vw; background: var(--surface-bg); color: var(--text-main); overflow: hidden; }
        .sidebar-modern { width: 280px; background: var(--panel-bg); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; padding: 24px; }
        .sidebar-header { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; }
        .brand-logo { width: 36px; height: 36px; background: var(--primary); color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .brand-title { margin: 0; font-size: 16px; font-weight: 700; }
        .brand-version { font-size: 12px; color: var(--text-muted); }
        .sidebar-nav { display: flex; flex-direction: column; gap: 8px; }
        .nav-btn { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: transparent; border: none; border-radius: 8px; color: var(--text-muted); font-size: 14px; font-weight: 500; cursor: pointer; text-align: left; transition: all 0.2s; }
        .nav-btn:hover { background: var(--surface-bg); color: var(--text-main); }
        .nav-btn.active { background: var(--primary); color: white; }
        .nav-divider { height: 1px; background: var(--border-color); margin: 16px 0; }
        .main-workspace { flex: 1; overflow-y: auto; padding: 40px; }
        .workspace-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .page-title { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
        .page-subtitle { margin: 0; color: var(--text-muted); font-size: 15px; }
        .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: 0.2s; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-secondary { background: #e2e8f0; color: var(--text-main); border: none; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .btn-sm-primary { background: var(--primary); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
        .btn-xs-primary { background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; }
        .btn-sm-outline { background: transparent; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; margin-right: 6px; }
        .btn-sm-outline:hover { background: var(--surface-bg); }
        .bento-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .bento-card { background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; }
        .col-span-2 { grid-column: span 2; }
        .row-span-2 { grid-row: span 2; }
        .bento-label { font-size: 13px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .bento-value { font-size: 36px; font-weight: 700; margin: 12px 0; display: flex; align-items: baseline; gap: 12px; }
        .trend.up { font-size: 14px; color: var(--success-text); background: var(--success-bg); padding: 4px 8px; border-radius: 20px; }
        .bento-desc { margin: 0; font-size: 14px; color: var(--text-muted); }
        .leaderboard { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
        .leader-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--surface-bg); border-radius: var(--radius-md); font-size: 14px; }
        .metric { font-weight: 700; color: var(--primary); }
        .table-container { background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
        .data-table th { background: var(--surface-bg); padding: 16px 24px; color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--border-color); }
        .data-table td { padding: 16px 24px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
        .project-cell { display: flex; align-items: center; gap: 12px; }
        .expand-btn { background: var(--surface-bg); border: 1px solid var(--border-color); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .project-thumb { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-color); }
        .prop-info { display: flex; flex-direction: column; gap: 4px; }
        .prop-info strong { font-size: 15px; color: var(--text-main); }
        .prop-info span { font-size: 13px; color: var(--text-muted); }
        .media-badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .media-pill { background: var(--surface-bg); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 20px; font-size: 12px; color: var(--text-muted); font-weight: 500; }
        .unit-summary { display: flex; flex-direction: column; gap: 2px; }
        .unit-link { font-size: 12px; color: #2563eb; cursor: pointer; text-decoration: underline; }
        .units-drawer-row td { background: #f8fafc; padding: 0; }
        .units-drawer { padding: 20px 24px 24px 64px; border-bottom: 1px solid var(--border-color); }
        .units-drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 13px; color: var(--text-muted); }
        .units-grid-list { display: flex; flex-direction: column; gap: 10px; }
        .unit-item-card { background: white; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px 18px; }
        .unit-item-main { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .unit-item-title { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .unit-item-specs { display: flex; gap: 8px; font-size: 12px; color: var(--text-muted); }
        .unit-item-desc { margin: 6px 0 0 0; font-size: 12px; color: var(--text-muted); }
        .unit-item-right { text-align: right; }
        .unit-price { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .unit-item-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .btn-text { background: none; border: none; color: #2563eb; font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; }
        .btn-text.danger { color: #dc2626; }
        .empty-units { padding: 16px; text-align: center; font-size: 13px; color: var(--text-muted); background: var(--surface-bg); border: 1px dashed var(--border-color); border-radius: 8px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-success { background: var(--success-bg); color: var(--success-text); }
        .badge-warning { background: var(--warning-bg); color: var(--warning-text); }
        .badge-danger { background: var(--danger-bg); color: var(--danger-text); }
        .badge-neutral { background: var(--surface-bg); color: var(--text-muted); }
        .td-actions { text-align: right; white-space: nowrap; }
        .btn-icon { background: none; border: none; cursor: pointer; padding: 6px; margin-left: 4px; border-radius: 6px; transition: 0.2s; }
        .btn-icon:hover { background: var(--surface-bg); }
        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
        .modal-dialog { background: var(--panel-bg); width: 100%; max-width: 680px; border-radius: var(--radius-lg); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
        .modal-dialog.modal-lg { max-width: 860px; }
        .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; }
        .modal-header h2 { margin: 0 0 4px 0; font-size: 20px; font-weight: 700; }
        .modal-subtitle { margin: 0; font-size: 13px; color: var(--text-muted); }
        .btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted); }
        .modal-body { padding: 24px; }
        .scrollable-body { overflow-y: auto; display: flex; flex-direction: column; gap: 24px; }
        .form-section { border: 1px solid var(--border-color); border-radius: 12px; padding: 18px; background: #ffffff; }
        .section-heading { margin: 0 0 14px 0; font-size: 15px; font-weight: 700; color: var(--text-main); }
        .section-header-inline { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .text-xs { font-size: 12px; }
        .text-muted { color: var(--text-muted); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label { font-size: 12px; font-weight: 600; color: var(--text-main); }
        .input-group input, .input-group select, .input-group textarea { padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; outline: none; transition: 0.2s; }
        .input-group input:focus, .input-group select:focus, .input-group textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(15,23,42,0.08); }
        .media-box { background: var(--surface-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .media-label { font-size: 13px; font-weight: 600; }
        .media-input-row { display: flex; gap: 8px; }
        .media-input-row input { flex: 1; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; }
        .upload-dropzone { border: 1px dashed #94a3b8; background: white; border-radius: 8px; padding: 10px; text-align: center; font-size: 12px; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: 0.2s; }
        .upload-dropzone:hover { border-color: var(--primary); color: var(--text-main); }
        .media-preview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 4px; }
        .media-thumb-item { position: relative; height: 64px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); }
        .media-thumb-item img { width: 100%; height: 100%; object-fit: cover; }
        .remove-media-btn { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.65); color: white; border: none; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .video-preview-list { display: flex; flex-direction: column; gap: 6px; }
        .video-preview-item { display: flex; justify-content: space-between; align-items: center; background: white; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 12px; }
        .remove-video-btn { background: none; border: none; color: #dc2626; font-size: 11px; font-weight: 600; cursor: pointer; }
        .unit-subform { background: var(--surface-bg); border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 14px; }
        .unit-subform-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; }
        .unit-subform-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
        .modal-units-list { display: flex; flex-direction: column; gap: 8px; }
        .modal-unit-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--surface-bg); }
        .modal-unit-actions { display: flex; gap: 12px; }
        .modal-footer { padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 12px; }
        .btn-ghost { background: transparent; border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
        .btn-ghost:hover { background: var(--surface-bg); }
      `}</style>
    </div>
  );
}