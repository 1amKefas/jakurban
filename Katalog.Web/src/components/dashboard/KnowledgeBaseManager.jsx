import { createSignal, onMount, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { apiService } from '../../services/api';

// Ekstraktor otomatis isi teks dari file Word (.docx XML), CSV/Excel, atau TXT langsung di browser
async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
    return await file.text();
  }

  // Ekstraksi teks dari struktur dokumen Word (.docx)
  if (name.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawStr = decoder.decode(new Uint8Array(buffer));
    const matches = [...rawStr.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)].map((m) => m[1]);
    if (matches.length > 0) {
      return matches.join(' ').replace(/\s+/g, ' ').trim();
    }
  }

  return `[Lampiran File: ${file.name} (${Math.round(file.size / 1024)} KB)] — Silakan lengkapi ringkasan isi dokumen/gambar/tabel di bawah ini agar dapat langsung dijawab oleh Chatbot RAG.`;
}

/**
 * Memotong teks panjang menjadi cuplikan ringkas untuk tampilan tabel Knowledge Base.
 */
const truncateSnippet = (text = '', maxLength = 120) => {
  const str = String(text || '');
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
};

export default function KnowledgeBaseManager(props) {
  const [docs, setDocs] = createSignal([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [form, setForm] = createStore({
    title: '',
    category: 'Aturan KPR & Legalitas',
    fileName: '',
    content: ''
  });

  const loadDocs = async () => {
    try {
      const data = await apiService.getKnowledgeDocs();
      if (Array.isArray(data)) setDocs(data);
    } catch {
      // Gunakan state lokal jika server belum aktif
    }
  };

  onMount(loadDocs);

  const handleFileSelect = async (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setForm('fileName', file.name);
    if (!form.title) {
      setForm('title', file.name.replace(/\.[^/.]+$/, ''));
    }
    const extracted = await extractTextFromFile(file);
    setForm('content', extracted);
    e.currentTarget.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      alert('Judul dan Isi Pengetahuan wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await apiService.createKnowledgeDoc({ ...form });
      setDocs((prev) => [saved, ...prev]);
      props.addActivityLog?.({
        action: 'CREATE',
        category: 'PROJECT',
        target: `Knowledge Base AI: ${form.title}`,
        details: `Super Admin meng-embed dokumen (${form.fileName || form.category}) ke memori RAG`
      });
      setForm({ title: '', category: 'Aturan KPR & Legalitas', fileName: '', content: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Hapus dokumen "${doc.title}" dari Knowledge Base AI?`)) return;
    try {
      await apiService.deleteKnowledgeDoc(doc.id);
    } catch {}
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    props.addActivityLog?.({
      action: 'DELETE',
      category: 'PROJECT',
      target: `Knowledge Base AI: ${doc.title}`,
      details: 'Super Admin menghapus dokumen dari memori RAG Chatbot'
    });
  };

  return (
    <div>
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Knowledge Base AI (Embed Dokumen Perusahaan)</h1>
          <p class="page-subtitle">
            Otoritas Super Admin — Unggah file Word (.docx), CSV/Excel, Brosur Gambar, atau SOP Perusahaan agar langsung dipahami Chatbot secara instan tanpa reasoning lama.
          </p>
        </div>
      </div>

      <div class="team-management-grid">
        <div class="team-form-card">
          <div class="card-section-title">
            <div>
              <h3>Unggah & Embed Dokumen Baru</h3>
              <p>Teks dari dokumen akan di-embed satu kali ke memori RAG.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} class="credential-form">
            <div class="input-group">
              <label>Pilih File (Word .docx, CSV/Excel, TXT, atau Gambar Brosur)</label>
              <label class="upload-dropzone block-dropzone">
                <input
                  type="file"
                  accept=".docx,.csv,.txt,.md,.xlsx,.png,.jpg,.jpeg,.pdf"
                  onChange={handleFileSelect}
                  hidden
                />
                <span>
                  {form.fileName
                    ? `File Terpilih: ${form.fileName}`
                    : '+ Klik untuk Pilih File dari Perangkat'}
                </span>
              </label>
            </div>

            <div class="input-group">
              <label>Judul Dokumen / Topik Pengetahuan *</label>
              <input
                type="text"
                placeholder="Cth: Syarat Dokumen KPR & Biaya Pajak BPHTB"
                value={form.title}
                onInput={(e) => setForm('title', e.currentTarget.value)}
                required
              />
            </div>

            <div class="input-group">
              <label>Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm('category', e.currentTarget.value)}
              >
                <option value="Aturan KPR & Legalitas">Aturan KPR & Legalitas (SHM/PBG)</option>
                <option value="Pricelist & Cara Bayar">Pricelist, Promo & Cara Bayar</option>
                <option value="Spesifikasi Teknis Bangunan">Spesifikasi Teknis Material Bangunan</option>
                <option value="SOP & Profil Perusahaan">SOP & Informasi Umum Perusahaan</option>
              </select>
            </div>

            <div class="input-group">
              <label>Isi Teks / Hasil Ekstraksi Dokumen (Siap Di-Embed) *</label>
              <textarea
                rows="7"
                placeholder="Isi dokumen yang diekstrak akan muncul di sini. Anda juga dapat menyunting atau menempelkan tabel/aturan penting secara langsung..."
                value={form.content}
                onInput={(e) => setForm('content', e.currentTarget.value)}
                required
              ></textarea>
            </div>

            <button type="submit" class="btn-primary full-width-btn" disabled={isSubmitting()}>
              {isSubmitting() ? 'Meng-embed ke RAG...' : 'Simpan & Embed ke Chatbot RAG'}
            </button>
          </form>
        </div>

        <div class="table-container">
          <div class="table-card-header">
            <div>
              <h3>Dokumen Aktif di Memori RAG ({docs().length})</h3>
              <p>Seluruh dokumen di bawah ini otomatis menjadi rujukan jawaban instan JakUrban AI.</p>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Judul & File</th>
                <th>Kategori</th>
                <th>Cuplikan Isi</th>
                <th class="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <For
                each={docs()}
                fallback={
                  <tr>
                    <td colSpan="4" class="empty-table-cell">
                      Belum ada dokumen tambahan yang di-embed. Unggah file di sebelah kiri untuk memulai.
                    </td>
                  </tr>
                }
              >
                {(doc) => (
                  <tr>
                    <td>
                      <strong>{doc.title}</strong>
                      <div class="kb-doc-meta">
                        {doc.fileName || 'Input Teks'} • {doc.createdAt}
                      </div>
                    </td>
                    <td>
                      <span class="role-pill admin">{doc.category}</span>
                    </td>
                    <td class="kb-doc-snippet">
                      {truncateSnippet(doc.content)}
                    </td>
                    <td class="td-actions">
                      <button
                        type="button"
                        class="btn-sm-outline btn-danger-outline"
                        onClick={() => handleDelete(doc)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}