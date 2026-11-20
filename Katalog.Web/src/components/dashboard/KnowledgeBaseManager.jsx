import { createSignal, onMount, For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { apiService } from '../../services/api';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfJsPromise = null;
function loadPdfJs() {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    return Promise.resolve(window.pdfjsLib);
  }
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('pdfjsLib gagal dimuat'));
      }
    };
    script.onerror = () => reject(new Error('Gagal memuat library PDF.js'));
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}

// Helper membaca dan mendekompresi entry XML dari file arsip ZIP (.docx / .xlsx)
async function extractZipXmlEntries(buffer, targetPredicate) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const results = {};

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset++;
      continue;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    let compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + fileNameLength + extraFieldLength;
    const entryName = decoder.decode(bytes.subarray(offset + 30, offset + 30 + fileNameLength));

    if (compressedSize === 0) {
      let scan = dataStart;
      while (scan + 4 <= bytes.length) {
        const sig = view.getUint32(scan, true);
        if (sig === 0x04034b50 || sig === 0x02014b50 || sig === 0x08074b50) break;
        scan++;
      }
      compressedSize = Math.max(0, scan - dataStart);
    }

    if (targetPredicate(entryName)) {
      const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);
      let xmlText = '';
      if (compressionMethod === 0) {
        xmlText = decoder.decode(compressedSlice);
      } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compressedSlice).catch(() => {});
        writer.close().catch(() => {});
        xmlText = await new Response(ds.readable).text();
      }
      if (xmlText) results[entryName] = xmlText;
    }

    offset = dataStart + compressedSize;
  }

  return results;
}

const decodeXmlEntities = (str = '') =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

// Ekstraktor otomatis isi teks dari file PDF (.pdf), Excel (.xlsx), Word (.docx), CSV, MD, atau TXT
async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
    return await file.text();
  }

  // 1. Ekstraksi dokumen PDF (.pdf) beserta susunan baris tabel pricelist
  if (name.endsWith('.pdf')) {
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageTexts = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Kelompokkan teks berdasarkan koordinat Y (baris tabel) agar pricelist tetap rapi per baris unit
        const rowsMap = new Map();
        for (const item of textContent.items) {
          const str = (item.str || '').trim();
          if (!str) continue;
          const yKey = Math.round((item.transform?.[5] || 0) / 4) * 4;
          if (!rowsMap.has(yKey)) rowsMap.set(yKey, []);
          rowsMap.get(yKey).push({ x: item.transform?.[4] || 0, text: str });
        }

        const sortedRows = [...rowsMap.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([, cols]) =>
            cols
              .sort((c1, c2) => c1.x - c2.x)
              .map((c) => c.text)
              .join(' | ')
          );

        if (sortedRows.length > 0) {
          pageTexts.push(`--- Halaman ${pageNum} ---\n${sortedRows.join('\n')}`);
        }
      }

      const combinedPdfText = pageTexts.join('\n\n').trim();
      if (combinedPdfText) {
        return combinedPdfText;
      }
    } catch (err) {
      console.warn('Gagal mengekstrak teks PDF:', err);
    }
  }

  // 2. Ekstraksi dokumen Word (.docx)
  if (name.endsWith('.docx')) {
    try {
      const buffer = await file.arrayBuffer();
      const entries = await extractZipXmlEntries(buffer, (entry) => entry === 'word/document.xml');
      const xmlText = entries['word/document.xml'];
      if (xmlText) {
        const paragraphs = xmlText
          .split(/<\/w:p>/i)
          .map((p) =>
            [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gi)]
              .map((m) => m[1])
              .join('')
              .trim()
          )
          .filter(Boolean);

        if (paragraphs.length > 0) {
          return decodeXmlEntities(paragraphs.join('\n'));
        }
      }
    } catch (err) {
      console.warn('Gagal mengekstrak XML dari .docx:', err);
    }
  }

  // 3. Ekstraksi tabel spreadsheet Excel (.xlsx)
  if (name.endsWith('.xlsx')) {
    try {
      const buffer = await file.arrayBuffer();
      const entries = await extractZipXmlEntries(
        buffer,
        (entry) => entry === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry)
      );

      const sharedStrings = [];
      if (entries['xl/sharedStrings.xml']) {
        const siBlocks = entries['xl/sharedStrings.xml'].split(/<\/si>/i);
        for (const block of siBlocks) {
          const textParts = [...block.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/gi)].map((m) => m[1]);
          if (textParts.length > 0) {
            sharedStrings.push(decodeXmlEntities(textParts.join('')));
          }
        }
      }

      const sheetLines = [];
      for (const [entryName, sheetXml] of Object.entries(entries)) {
        if (!entryName.startsWith('xl/worksheets/')) continue;
        const rows = sheetXml.match(/<row\b[^>]*>[\s\S]*?<\/row>/gi) || [];
        for (const rowXml of rows) {
          const cells = rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>/gi) || [];
          const rowValues = [];
          for (const cellXml of cells) {
            const isShared = /\bt=["']s["']/i.test(cellXml);
            const inlineStr = cellXml.match(/<t(?:\s[^>]*)?>([^<]*)<\/t>/i);
            const valMatch = cellXml.match(/<v>([^<]*)<\/v>/i);
            if (inlineStr) {
              rowValues.push(decodeXmlEntities(inlineStr[1].trim()));
            } else if (valMatch) {
              const rawVal = valMatch[1].trim();
              const resolved = isShared ? sharedStrings[Number(rawVal)] ?? rawVal : rawVal;
              if (String(resolved).trim()) rowValues.push(String(resolved).trim());
            }
          }
          if (rowValues.length > 0) {
            sheetLines.push(rowValues.join(' | '));
          }
        }
      }

      if (sheetLines.length > 0) {
        return sheetLines.join('\n');
      }
    } catch (err) {
      console.warn('Gagal mengekstrak tabel dari .xlsx:', err);
    }
  }

  return '';
}

const truncateSnippet = (text = '', maxLength = 120) => {
  const str = String(text || '');
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
};

export default function KnowledgeBaseManager(props) {
  const [docs, setDocs] = createSignal([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isExtracting, setIsExtracting] = createSignal(false);
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

    setIsExtracting(true);
    try {
      const extracted = await extractTextFromFile(file);
      if (extracted && extracted.trim()) {
        setForm('content', extracted);
      } else {
        setForm('content', '');
        alert(
          `File "${file.name}" berupa gambar/scan tanpa lapisan teks digital. Silakan ketik atau tempelkan rincian unit/harga dari brosur tersebut pada kolom Isi Teks di bawah.`
        );
      }
    } finally {
      setIsExtracting(false);
      e.currentTarget.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanTitle = form.title.trim();
    const cleanContent = form.content.trim();

    if (!cleanTitle || !cleanContent) {
      alert('Judul dan Isi Pengetahuan wajib diisi!');
      return;
    }

    if (cleanContent.startsWith('[Lampiran File:')) {
      alert('Isi dokumen masih berupa teks placeholder. Silakan unggah ulang file atau isi rincian teks pengetahuan terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await apiService.createKnowledgeDoc({
        ...form,
        title: cleanTitle,
        content: cleanContent
      });
      setDocs((prev) => [saved, ...prev]);
      props.addActivityLog?.({
        action: 'CREATE',
        category: 'KNOWLEDGE',
        target: `Knowledge Base AI: ${cleanTitle}`,
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
      category: 'KNOWLEDGE',
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
            Otoritas Super Admin — Unggah file Pricelist PDF (.pdf), Word (.docx), Excel/CSV (.xlsx/.csv), atau SOP Perusahaan agar seluruh daftar unit & aturan langsung dipahami Chatbot RAG.
          </p>
        </div>
      </div>

      <div class="team-management-grid">
        <div class="team-form-card">
          <div class="card-section-title">
            <div>
              <h3>Unggah & Embed Dokumen Baru</h3>
              <p>Teks & tabel dari dokumen akan diekstrak otomatis dan di-embed ke memori RAG.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} class="credential-form">
            <div class="input-group">
              <label>Pilih File (PDF .pdf, Word .docx, Excel .xlsx, CSV, atau TXT)</label>
              <label class="upload-dropzone block-dropzone">
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
                  onChange={handleFileSelect}
                  hidden
                />
                <span>
                  {isExtracting()
                    ? 'Mengekstrak isi tabel & teks dari file...'
                    : form.fileName
                    ? `File Terpilih: ${form.fileName}`
                    : '+ Klik untuk Pilih File dari Perangkat'}
                </span>
              </label>
            </div>

            <div class="input-group">
              <label>Judul Dokumen / Topik Pengetahuan *</label>
              <input
                type="text"
                placeholder="Cth: Pricelist Lengkap Cluster Setiabudi (Semua Unit)"
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
                rows="8"
                placeholder="Isi tabel unit, harga, dan teks dokumen yang diekstrak akan muncul otomatis di sini. Anda juga dapat menyuntingnya sebelum disimpan..."
                value={form.content}
                onInput={(e) => setForm('content', e.currentTarget.value)}
                required
              ></textarea>
            </div>

            <button
              type="submit"
              class="btn-primary full-width-btn"
              disabled={isSubmitting() || isExtracting()}
            >
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