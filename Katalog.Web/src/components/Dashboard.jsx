import { createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store'; 
import { Icons } from './Icons'; // Pastikan komponen Icons tersedia

export default function Dashboard(props) {
  // State Navigasi & UI
  const [adminView, setAdminView] = createSignal('management'); 
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [isEditing, setIsEditing] = createSignal(false);

  // State Form Unit Properti
  const defaultForm = {
    id: null,
    name: '',
    cluster: '',
    price: '',
    landArea: '',
    buildArea: '',
    beds: 0,
    baths: 0,
    status: 'Tersedia',
    description: ''
  };
  const [newProp, setNewProp] = createStore({ ...defaultForm });

  // Mode Edit
  const openEditModal = (cluster) => {
    setNewProp({ ...cluster });
    setIsEditing(true);
    setShowAddModal(true);
  };

  // Tutup Modal & Reset
  const closeModal = () => {
    setShowAddModal(false);
    setIsEditing(false);
    setNewProp({ ...defaultForm });
  };

  // CRUD: Simpan (Tambah/Edit)
  const handleSaveProperty = (e) => {
    e.preventDefault();
    if (isEditing()) {
      props.setClusters(props.clusters.map(c => c.id === newProp.id ? { ...newProp } : c));
    } else {
      props.setClusters([...props.clusters, { 
        ...newProp, 
        id: Date.now(), 
        img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80' 
      }]);
    }
    closeModal();
  };

  // CRUD: Hapus
  const handleDelete = (id) => {
    if(confirm('Apakah Anda yakin ingin menghapus unit properti ini?')) {
      props.setClusters(props.clusters.filter(p => p.id !== id));
    }
  };

  // Helper untuk warna badge status
  const getStatusColor = (status) => {
    switch(status) {
      case 'Tersedia': return 'badge-success';
      case 'Booking': return 'badge-warning';
      case 'Sold': return 'badge-danger';
      default: return 'badge-neutral';
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
            <span class="brand-version">Enterprise Panel v3.0</span>
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
              <span class="bento-label">Traffic Real-time</span>
              <div class="bento-value">12,450 <span class="trend up">↑ 12%</span></div>
              <p class="bento-desc">Peningkatan trafik signifikan di area Jakarta Selatan dari kampanye Ads.</p>
            </div>
            <div class="bento-card row-span-2">
              <span class="bento-label">Top Lead Clusters</span>
              <div class="leaderboard">
                <div class="leader-item">
                  <div><strong>Cluster Emerald</strong><br/><span class="text-sm text-gray">Tipe 45/90</span></div>
                  <div class="metric">450 Klik</div>
                </div>
                <div class="leader-item">
                  <div><strong>Cluster Diamond</strong><br/><span class="text-sm text-gray">Tipe 60/120</span></div>
                  <div class="metric">320 Klik</div>
                </div>
              </div>
            </div>
            <div class="bento-card">
              <span class="bento-label">Conversion Rate</span>
              <div class="bento-value">6.8%</div>
            </div>
            <div class="bento-card">
              <span class="bento-label">Active Agents</span>
              <div class="bento-value">14</div>
            </div>
          </div>
        </Show>

        {/* VIEW: MANAGEMENT (CRUD) */}
        <Show when={adminView() === 'management'}>
          <div class="workspace-header">
            <div>
              <h1 class="page-title">Project Assets</h1>
              <p class="page-subtitle">Kelola inventori unit properti, harga, dan ketersediaan.</p>
            </div>
            <button class="btn-primary" onClick={() => setShowAddModal(true)}>
              + Tambah Unit
            </button>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Info Properti</th>
                  <th>Spesifikasi</th>
                  <th>Harga</th>
                  <th>Status</th>
                  <th class="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <For each={props.clusters}>{(c) => (
                  <tr>
                    <td>
                      <div class="prop-info">
                        <strong>{c.name}</strong>
                        <span>{c.cluster || c.location || 'Cluster Utama'}</span>
                      </div>
                    </td>
                    <td>
                      <div class="prop-specs">
                        <span>LT: {c.landArea || '-'}m² | LB: {c.buildArea || '-'}m²</span>
                        <span>🛏️ {c.beds} | 🚿 {c.baths}</span>
                      </div>
                    </td>
                    <td class="font-medium">{c.price}</td>
                    <td>
                      <span class={`badge ${getStatusColor(c.status || 'Tersedia')}`}>
                        {c.status || 'Tersedia'}
                      </span>
                    </td>
                    <td class="td-actions">
                      <button class="btn-icon edit" onClick={() => openEditModal(c)}>✏️</button>
                      <button class="btn-icon delete" onClick={() => handleDelete(c.id)}>🗑️</button>
                    </td>
                  </tr>
                )}</For>
              </tbody>
            </table>
          </div>
        </Show>
      </main>

      {/* MODAL CRUD */}
      <Show when={showAddModal()}>
        <div class="modal-backdrop" onClick={closeModal}>
          <div class="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>{isEditing() ? 'Edit Unit Properti' : 'Tambah Unit Baru'}</h2>
              <button class="btn-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSaveProperty} class="modal-body">
              <div class="form-grid">
                <div class="input-group col-span-2">
                  <label>Nama Unit / Tipe Rumah</label>
                  <input type="text" placeholder="Cth: Tipe Magnolia 45/90" value={newProp.name} onInput={(e) => setNewProp('name', e.currentTarget.value)} required />
                </div>
                
                <div class="input-group">
                  <label>Nama Cluster / Lokasi</label>
                  <input type="text" placeholder="Cth: Cluster Emerald" value={newProp.cluster} onInput={(e) => setNewProp('cluster', e.currentTarget.value)} required />
                </div>

                <div class="input-group">
                  <label>Status Ketersediaan</label>
                  <select value={newProp.status} onChange={(e) => setNewProp('status', e.currentTarget.value)}>
                    <option value="Tersedia">Tersedia</option>
                    <option value="Booking">Booking</option>
                    <option value="Sold">Sold (Terjual)</option>
                  </select>
                </div>

                <div class="input-group">
                  <label>Luas Tanah (m²)</label>
                  <input type="number" placeholder="90" value={newProp.landArea} onInput={(e) => setNewProp('landArea', e.currentTarget.value)} required />
                </div>

                <div class="input-group">
                  <label>Luas Bangunan (m²)</label>
                  <input type="number" placeholder="45" value={newProp.buildArea} onInput={(e) => setNewProp('buildArea', e.currentTarget.value)} required />
                </div>

                <div class="input-group">
                  <label>Kamar Tidur</label>
                  <input type="number" min="0" value={newProp.beds} onInput={(e) => setNewProp('beds', e.currentTarget.value)} required />
                </div>

                <div class="input-group">
                  <label>Kamar Mandi</label>
                  <input type="number" min="0" value={newProp.baths} onInput={(e) => setNewProp('baths', e.currentTarget.value)} required />
                </div>

                <div class="input-group col-span-2">
                  <label>Harga Properti</label>
                  <input type="text" placeholder="Cth: Rp 1.250.000.000" value={newProp.price} onInput={(e) => setNewProp('price', e.currentTarget.value)} required />
                </div>

                <div class="input-group col-span-2">
                  <label>Deskripsi Unggulan</label>
                  <textarea rows="3" placeholder="Fasilitas, keunggulan lokasi, promo KPR..." value={newProp.description} onInput={(e) => setNewProp('description', e.currentTarget.value)}></textarea>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-ghost" onClick={closeModal}>Batal</button>
                <button type="submit" class="btn-primary">{isEditing() ? 'Simpan Perubahan' : 'Tambahkan Unit'}</button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* CSS STYLES (SaaS Enterprise Look) */}
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
        
        /* SIDEBAR */
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

        /* MAIN CONTENT */
        .main-workspace { flex: 1; overflow-y: auto; padding: 40px; }
        .workspace-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .page-title { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
        .page-subtitle { margin: 0; color: var(--text-muted); font-size: 15px; }
        
        .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: 0.2s; }
        .btn-primary:hover { background: var(--primary-hover); }

        /* BENTO GRID */
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

        /* DATA TABLE */
        .table-container { background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
        .data-table th { background: var(--surface-bg); padding: 16px 24px; color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--border-color); }
        .data-table td { padding: 16px 24px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
        .data-table tr:last-child td { border-bottom: none; }
        
        .prop-info { display: flex; flex-direction: column; gap: 4px; }
        .prop-info strong { font-size: 15px; color: var(--text-main); }
        .prop-info span { font-size: 13px; color: var(--text-muted); }
        .prop-specs { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-muted); }
        
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .badge-success { background: var(--success-bg); color: var(--success-text); }
        .badge-warning { background: var(--warning-bg); color: var(--warning-text); }
        .badge-danger { background: var(--danger-bg); color: var(--danger-text); }
        .badge-neutral { background: var(--surface-bg); color: var(--text-muted); }
        
        .td-actions { text-align: right; white-space: nowrap; }
        .btn-icon { background: none; border: none; cursor: pointer; padding: 6px; margin-left: 4px; border-radius: 6px; transition: 0.2s; }
        .btn-icon:hover { background: var(--surface-bg); }

        /* MODAL */
        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal-dialog { background: var(--panel-bg); width: 100%; max-width: 680px; border-radius: var(--radius-lg); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden; }
        .modal-header { padding: 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
        .btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted); }
        
        .modal-body { padding: 24px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .input-group { display: flex; flex-direction: column; gap: 8px; }
        .input-group label { font-size: 13px; font-weight: 600; color: var(--text-main); }
        .input-group input, .input-group select, .input-group textarea { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 14px; outline: none; transition: 0.2s; }
        .input-group input:focus, .input-group select:focus, .input-group textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(15,23,42,0.1); }
        
        .modal-footer { margin-top: 32px; display: flex; justify-content: flex-end; gap: 12px; }
        .btn-ghost { background: transparent; border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
        .btn-ghost:hover { background: var(--surface-bg); }
      `}</style>
    </div>
  );
}