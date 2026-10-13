import { createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store'; 
import { Icons } from './Icons';

export default function Dashboard(props) {
  const [adminView, setAdminView] = createSignal('analytics'); 
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [newProp, setNewProp] = createStore({ name: '', price: '', location: '', beds: 0, baths: 0, description: '' });

  const handleAddProperty = (e) => {
    e.preventDefault();
    // Correct way to update a store in Solid: pass the new state
    props.setClusters([...props.clusters, { ...newProp, id: Date.now(), img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80', premium: false }]);
    setShowAddModal(false);
  };

  return (
    <div class="dashboard-container">
      <aside class="sidebar">
        <div style={{ "margin-bottom": '40px', padding: '0 10px' }}>
          <h3 style={{ color: 'var(--color-primary)', margin: 0 }}>JakUrban OS</h3>
          <small style={{ color: '#999' }}>Enterprise Panel v2.6</small>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div class={`sidebar-item ${adminView() === 'analytics' ? 'active' : ''}`} onClick={() => setAdminView('analytics')}><Icons.Analytics /> Insights</div>
          <div class={`sidebar-item ${adminView() === 'management' ? 'active' : ''}`} onClick={() => setAdminView('management')}><Icons.Home /> Project Assets</div>
          <div class="sidebar-item" onClick={() => props.setView('catalog')}><Icons.Home /> Main Site</div>
        </div>
      </aside>

      <div class="main-content">
        <Show when={adminView() === 'analytics'}>
          <h1 style={{ color: 'var(--color-primary)', "margin-bottom": '30px', fontSize: '32px' }}>Command Center</h1>
          <div class="bento-grid">
            <div class="bento-item bento-large">
              <span style={{ color: '#888', fontSize: '14px' }}>Traffic Real-time</span>
              <h2 style={{ fontSize: '42px', margin: '10px 0' }}>12,450 <small style={{ fontSize: '16px', color: 'var(--color-success)' }}>↑ 12%</small></h2>
              <p style={{ color: '#666', fontSize: '14px' }}>Peningkatan trafik signifikan di area Jakarta Selatan.</p>
            </div>
            <div class="bento-item bento-tall">
              <span style={{ color: '#888', fontSize: '14px' }}>Top Lead</span>
              <div style={{ "margin-top": '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ padding: '10px', background: '#f9f9f9', borderRadius: '10px', fontSize: '13px' }}><strong>Cluster Emerald</strong><br/>450 Klik</div>
                <div style={{ padding: '10px', background: '#f9f9f9', borderRadius: '10px', fontSize: '13px' }}><strong>Cluster Diamond</strong><br/>320 Klik</div>
              </div>
            </div>
            <div class="bento-item">
              <span style={{ color: '#888', fontSize: '14px' }}> conversion</span>
              <h2 style={{ fontSize: '32px', margin: '10px 0' }}>6.8%</h2>
            </div>
            <div class="bento-item">
              <span style={{ color: '#888', fontSize: '14px' }}>Active Agents</span>
              <h2 style={{ fontSize: '32px', margin: '10px 0' }}>14</h2>
            </div>
          </div>
        </Show>

        <Show when={adminView() === 'management'}>
          <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "margin-bottom": '30px' }}>
            <h1 style={{ color: 'var(--color-primary)', fontSize: '32px' }}>Project Assets</h1>
            <button class="btn-primary" onClick={() => setShowAddModal(true)}>+ Tambah Proyek</button>
          </div>
          <table class="admin-table">
            <thead>
              <tr><th>Nama Cluster</th><th>Lokasi</th><th>Harga</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              <For each={props.clusters}>{(c) => (
                <tr>
                  <td>{c.name}</td><td>{c.location}</td><td>{c.price}</td>
                  <td>
                    <button class="btn-edit">Edit</button>
                    <button class="btn-delete" onClick={() => props.setClusters(props.clusters.filter(p => p.id !== c.id))}>Hapus</button>
                  </td>
                </tr>
              )}</For>
            </tbody>
          </table>
        </Show>

        <Show when={showAddModal()}>
          <div class="modal-overlay">
            <div class="modal-content" style={{ width: '600px' }}>
              <h2 style={{ color: 'var(--color-primary)', "margin-bottom": '20px' }}>Tambah Proyek Baru</h2>
              <form class="form-grid" onSubmit={handleAddProperty}>
                <div class="form-field">
                  <label>Nama Cluster</label>
                  <input type="text" onInput={(e) => setNewProp('name', e.currentTarget.value)} required />
                </div>
                <div class="form-field">
                  <label>Harga</label>
                  <input type="text" placeholder="Rp 1 M" onInput={(e) => setNewProp('price', e.currentTarget.value)} required />
                </div>
                <div class="form-field">
                  <label>Lokasi</label>
                  <input type="text" onInput={(e) => setNewProp('location', e.currentTarget.value)} required />
                </div>
                <div class="form-field">
                  <label>Kamar Tidur</label>
                  <input type="number" onInput={(e) => setNewProp('beds', e.currentTarget.value)} required />
                </div>
                <div class="form-field" style={{ gridColumn: 'span 2' }}>
                  <label>Deskripsi</label>
                  <textarea rows="3" onInput={(e) => setNewProp('description', e.currentTarget.value)}></textarea>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', "justify-content": 'flex-end' }}>
                  <button type="button" class="btn-outline" onClick={() => setShowAddModal(false)}>Batal</button>
                  <button type="submit" class="btn-primary">Simpan Proyek</button>
                </div>
              </form>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
