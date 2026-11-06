import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { createDefaultUnitForm } from '../../constants/defaultData';
import { fileToDataUrl, getStatusColor } from '../../utils/formatters';
import { parseSmartRupiahNumber, resolveExactMapUrls } from '../../services/api';
import { RichTextContent } from '../../views/PropertyDetail';

export const JAKARTA_REGIONS = {
  'Jakarta Pusat': [
    'Cempaka Putih', 'Gambir', 'Johar Baru', 'Kemayoran',
    'Menteng', 'Sawah Besar', 'Senen', 'Tanah Abang'
  ],
  'Jakarta Utara': [
    'Cilincing', 'Kelapa Gading', 'Koja',
    'Pademangan', 'Penjaringan', 'Tanjung Priok'
  ],
  'Jakarta Barat': [
    'Cengkareng', 'Grogol Petamburan', 'Kalideres', 'Kebon Jeruk',
    'Kembangan', 'Palmerah', 'Taman Sari', 'Tambora'
  ],
  'Jakarta Selatan': [
    'Cilandak', 'Jagakarsa', 'Kebayoran Baru', 'Kebayoran Lama', 'Mampang Prapatan',
    'Pancoran', 'Pasar Minggu', 'Pesanggrahan', 'Setiabudi', 'Tebet'
  ],
  'Jakarta Timur': [
    'Cakung', 'Cipayung', 'Ciracas', 'Duren Sawit', 'Jatinegara',
    'Kramat Jati', 'Makasar', 'Matraman', 'Pasar Rebo', 'Pulo Gadung'
  ],
  'Kepulauan Seribu': [
    'Kepulauan Seribu Utara', 'Kepulauan Seribu Selatan'
  ]
};

const KOTA_LIST = Object.keys(JAKARTA_REGIONS);

const SvgBase = (props) => (
  <svg
    width={props.size || 15}
    height={props.size || 15}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth || 1.8}
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {props.children}
  </svg>
);

const ModalIcon = {
  Close: () => (
    <SvgBase size={16} strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </SvgBase>
  ),
  Camera: () => (
    <SvgBase>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </SvgBase>
  ),
  Video: () => (
    <SvgBase>
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </SvgBase>
  ),
  Upload: () => (
    <SvgBase>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </SvgBase>
  ),
  MapPin: () => (
    <SvgBase>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </SvgBase>
  ),
  Play: () => (
    <SvgBase size={13} strokeWidth={2}>
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </SvgBase>
  ),
  ArrowLeft: () => (
    <SvgBase size={14} strokeWidth={2.2}>
      <polyline points="15 18 9 12 15 6"></polyline>
    </SvgBase>
  ),
  ArrowRight: () => (
    <SvgBase size={14} strokeWidth={2.2}>
      <polyline points="9 18 15 12 9 6"></polyline>
    </SvgBase>
  )
};

const removeAtIndex = (list, index) => (list || []).filter((_, idx) => idx !== index);

const promoteToFirst = (list, index) => {
  const arr = [...(list || [])];
  if (index <= 0 || index >= arr.length) return arr;
  const [chosen] = arr.splice(index, 1);
  arr.unshift(chosen);
  return arr;
};

const moveItem = (list, index, direction) => {
  const arr = [...(list || [])];
  const targetIdx = index + direction;
  if (targetIdx < 0 || targetIdx >= arr.length) return arr;
  [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]];
  return arr;
};

const reorderList = (list, fromIndex, toIndex) => {
  const arr = [...(list || [])];
  if (
    fromIndex === null ||
    toIndex === null ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= arr.length ||
    toIndex >= arr.length
  ) {
    return arr;
  }
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  return arr;
};

function PhotoManagerCard(props) {
  const [isDragOver, setIsDragOver] = createSignal(false);

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(props.index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!Number.isNaN(fromIdx) && fromIdx !== props.index) {
      props.onDropReorder?.(fromIdx, props.index);
    }
  };

  return (
    <div
      class={`photo-manager-card ${props.index === 0 ? 'is-cover' : ''} ${
        isDragOver() ? 'drag-over' : ''
      }`}
      draggable={true}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title="Tahan dan geser (Drag & Drop) untuk mengubah urutan foto"
    >
      <div class="photo-manager-img-wrap">
        <img src={props.photo} alt={`${props.altPrefix || 'Foto'} ${props.index + 1}`} />
        <span class="photo-order-badge">
          {props.index === 0 ? props.coverLabel : `#${props.index + 1}`}
        </span>
        <button
          type="button"
          class="remove-media-btn"
          onClick={props.onRemove}
          title="Hapus Foto"
        >
          <ModalIcon.Close />
        </button>
      </div>

      <div class="photo-manager-controls">
        <button
          type="button"
          class="photo-ctrl-btn arrow-btn"
          disabled={props.index === 0}
          onClick={props.onMoveLeft}
          title="Geser ke Kiri"
          aria-label="Geser ke Kiri"
        >
          <ModalIcon.ArrowLeft />
        </button>
        <Show
          when={props.index !== 0}
          fallback={<span class="cover-active-label">Utama</span>}
        >
          <button
            type="button"
            class="photo-ctrl-btn make-cover"
            onClick={props.onSetCover}
            title="Jadikan Cover"
          >
            Set Cover
          </button>
        </Show>
        <button
          type="button"
          class="photo-ctrl-btn arrow-btn"
          disabled={props.index === props.total - 1}
          onClick={props.onMoveRight}
          title="Geser ke Kanan"
          aria-label="Geser ke Kanan"
        >
          <ModalIcon.ArrowRight />
        </button>
      </div>

      {props.children}
    </div>
  );
}

function RichDescriptionEditor(props) {
  const [showPreview, setShowPreview] = createSignal(false);
  let textareaRef;

  const insertFormat = (type) => {
    const el = textareaRef;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const currentVal = String(props.value || '');
    const selected = currentVal.slice(start, end);

    let replacement = '';
    let cursorOffset = 0;

    if (type === 'bold') {
      replacement = `**${selected || 'teks tebal'}**`;
      cursorOffset = selected ? replacement.length : 2;
    } else if (type === 'italic') {
      replacement = `*${selected || 'teks miring'}*`;
      cursorOffset = selected ? replacement.length : 1;
    } else if (type === 'heading') {
      const prefix = start > 0 && currentVal[start - 1] !== '\n' ? '\n### ' : '### ';
      replacement = `${prefix}${selected || 'Subjudul Bagian'}`;
      cursorOffset = replacement.length;
    } else if (type === 'bullet') {
      const lines = (selected || 'Item daftar').split('\n');
      const formatted = lines.map((l) => `- ${l.replace(/^[-•*]\s+/, '')}`).join('\n');
      const prefix = start > 0 && currentVal[start - 1] !== '\n' ? '\n' : '';
      replacement = `${prefix}${formatted}`;
      cursorOffset = replacement.length;
    } else if (type === 'number') {
      const lines = (selected || 'Item pertama\nItem kedua').split('\n');
      const formatted = lines
        .map((l, idx) => `${idx + 1}. ${l.replace(/^\d+[.)]\s+/, '')}`)
        .join('\n');
      const prefix = start > 0 && currentVal[start - 1] !== '\n' ? '\n' : '';
      replacement = `${prefix}${formatted}`;
      cursorOffset = replacement.length;
    } else if (type === 'link') {
      const label = selected || window.prompt('Masukkan teks untuk link:', 'Lihat Brosur / Lokasi') || 'Tautan';
      const url = window.prompt('Masukkan URL tujuan (https://...):', 'https://');
      if (!url) return;
      replacement = `[${label}](${url.trim()})`;
      cursorOffset = replacement.length;
    }

    const nextValue = currentVal.slice(0, start) + replacement + currentVal.slice(end);
    props.onChange(nextValue);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + cursorOffset;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div class="rich-editor-wrapper">
      <div class="rich-editor-toolbar">
        <div class="rich-toolbar-group">
          <button type="button" class="rich-tool-btn" onClick={() => insertFormat('bold')} title="Tebal (Bold)">
            <strong>B</strong>
          </button>
          <button type="button" class="rich-tool-btn" onClick={() => insertFormat('italic')} title="Miring (Italic)">
            <em>I</em>
          </button>
          <button type="button" class="rich-tool-btn" onClick={() => insertFormat('heading')} title="Subjudul">
            H3
          </button>
          <button type="button" class="rich-tool-btn" onClick={() => insertFormat('bullet')} title="Bullet List">
            • List
          </button>
          <button type="button" class="rich-tool-btn" onClick={() => insertFormat('number')} title="Numbered List">
            1. List
          </button>
          <button type="button" class="rich-tool-btn" onClick={() => insertFormat('link')} title="Sematkan Tautan (Link)">
            + Link
          </button>
        </div>
        <button
          type="button"
          class={`rich-tool-btn preview-toggle ${showPreview() ? 'active' : ''}`}
          onClick={() => setShowPreview((prev) => !prev)}
        >
          {showPreview() ? 'Mode Edit' : 'Lihat Preview'}
        </button>
      </div>

      <Show
        when={!showPreview()}
        fallback={
          <div class="rich-editor-preview">
            <RichTextContent
              text={props.value}
              fallback="Belum ada deskripsi yang ditulis."
            />
          </div>
        }
      >
        <textarea
          ref={textareaRef}
          rows={props.rows || 8}
          placeholder={props.placeholder}
          value={props.value || ''}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        ></textarea>
      </Show>
      <span class="text-xs text-muted">
        Tips: Gunakan tombol di atas atau ketik <code>**tebal**</code>, <code>*miring*</code>, <code>- list</code>, <code>1. nomor</code>, dan <code>[Teks](https://...)</code>.
      </span>
    </div>
  );
}

export default function ProjectFormModal(props) {
  const [photoUrlInput, setPhotoUrlInput] = createSignal('');
  const [videoUrlInput, setVideoUrlInput] = createSignal('');
  const [unitPhotoUrlInput, setUnitPhotoUrlInput] = createSignal('');
  const [editingUnitIndex, setEditingUnitIndex] = createSignal(null);
  const [unitDraft, setUnitDraft] = createStore(createDefaultUnitForm());

  const [selectedKota, setSelectedKota] = createSignal('');
  const [selectedKecamatan, setSelectedKecamatan] = createSignal('');

  const kecamatanList = createMemo(() => JAKARTA_REGIONS[selectedKota()] || []);

  const toRawDigitString = (unitObj) => {
    const num = parseSmartRupiahNumber(unitObj?.rawPrice || unitObj?.price || '');
    return num > 0 ? String(num) : '';
  };

  const syncLocationString = (kota, kec) => {
    const parts = [];
    if (kec) parts.push(kec);
    if (kota) parts.push(kota);
    props.setProjectForm('location', parts.join(', '));
  };

  const handleKotaChange = (e) => {
    const kota = e.currentTarget.value;
    setSelectedKota(kota);
    setSelectedKecamatan('');
    syncLocationString(kota, '');
  };

  const handleKecamatanChange = (e) => {
    const kec = e.currentTarget.value;
    setSelectedKecamatan(kec);
    syncLocationString(selectedKota(), kec);
  };

  createEffect(() => {
    if (!props.show) return;
    const loc = (props.projectForm.location || '').toLowerCase();
    if (!loc) {
      setSelectedKota('');
      setSelectedKecamatan('');
      return;
    }

    const matchedKota = KOTA_LIST.find((kota) => loc.includes(kota.toLowerCase())) || '';
    const matchedKec = matchedKota
      ? JAKARTA_REGIONS[matchedKota].find((kec) => loc.includes(kec.toLowerCase())) || ''
      : '';

    setSelectedKota(matchedKota);
    setSelectedKecamatan(matchedKec);
  });

  const handleProjectInput = (field) => (e) => {
    props.setProjectForm(field, e.currentTarget.value);
  };

  const handleUnitInput = (field) => (e) => {
    if (field === 'price') {
      const rawDigits = e.currentTarget.value.replace(/[^\d]/g, '');
      setUnitDraft('price', rawDigits);
      setUnitDraft('rawPrice', rawDigits ? Number(rawDigits) : 0);
      return;
    }
    setUnitDraft(field, e.currentTarget.value);
  };

  const handleAddPhotoUrl = () => {
    const url = photoUrlInput().trim();
    if (!url) return;
    props.setProjectForm('photos', [...props.projectForm.photos, url]);
    setPhotoUrlInput('');
  };

  /**
 * Membaca seluruh file dari elemen <input type="file"> menjadi array Base64 Data URL
 * lalu mereset nilai input agar file yang sama dapat dipilih kembali bila diperlukan.
 */
  const readFilesFromInput = async (e) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = '';
    return files.length ? Promise.all(files.map(fileToDataUrl)) : [];
  };

  const handlePhotoFilesUpload = async (e) => {
    const base64List = await readFilesFromInput(e);
    if (base64List.length) {
      props.setProjectForm('photos', [...props.projectForm.photos, ...base64List]);
    }
  };

  const handleAssignProjectPhotoToUnit = (photoUrl, unitIndexStr) => {
    if (unitIndexStr === '') return;
    if (unitIndexStr === 'ALL') {
      const updatedAll = (props.projectForm.units || []).map((u) => {
        const cur = Array.isArray(u.photos) ? u.photos : [];
        return cur.includes(photoUrl) ? u : { ...u, photos: [...cur, photoUrl] };
      });
      props.setProjectForm('units', updatedAll);
      return;
    }

    const idx = Number(unitIndexStr);
    if (Number.isNaN(idx) || !props.projectForm.units[idx]) return;
    const targetUnit = props.projectForm.units[idx];
    const currentPhotos = Array.isArray(targetUnit.photos) ? [...targetUnit.photos] : [];
    if (!currentPhotos.includes(photoUrl)) {
      const updatedUnits = [...props.projectForm.units];
      updatedUnits[idx] = { ...targetUnit, photos: [...currentPhotos, photoUrl] };
      props.setProjectForm('units', updatedUnits);
    }
    if (editingUnitIndex() === idx) {
      const draftPhotos = Array.isArray(unitDraft.photos) ? [...unitDraft.photos] : [];
      if (!draftPhotos.includes(photoUrl)) {
        setUnitDraft('photos', [...draftPhotos, photoUrl]);
      }
    }
  };

  const togglePhotoInUnitDraft = (photoUrl) => {
    const current = Array.isArray(unitDraft.photos) ? [...unitDraft.photos] : [];
    setUnitDraft(
      'photos',
      current.includes(photoUrl)
        ? current.filter((p) => p !== photoUrl)
        : [...current, photoUrl]
    );
  };

  const handleAddUnitPhotoUrl = () => {
    const url = unitPhotoUrlInput().trim();
    if (!url) return;
    setUnitDraft('photos', [...(unitDraft.photos || []), url]);
    if (!props.projectForm.photos.includes(url)) {
      props.setProjectForm('photos', [...props.projectForm.photos, url]);
    }
    setUnitPhotoUrlInput('');
  };

  const handleUnitPhotoFilesUpload = async (e) => {
    const base64List = await readFilesFromInput(e);
    if (base64List.length) {
      setUnitDraft('photos', [...(unitDraft.photos || []), ...base64List]);
      props.setProjectForm('photos', [...props.projectForm.photos, ...base64List]);
    }
  };

  const handleAddVideoUrl = () => {
    const url = videoUrlInput().trim();
    if (!url) return;
    props.setProjectForm('videos', [...props.projectForm.videos, url]);
    setVideoUrlInput('');
  };

  const handleVideoFilesUpload = async (e) => {
    const dataUrls = await readFilesFromInput(e);
    if (dataUrls.length) {
      props.setProjectForm('videos', [...props.projectForm.videos, ...dataUrls]);
    }
  };

  const resetUnitDraft = () => {
    setUnitDraft(createDefaultUnitForm());
    setEditingUnitIndex(null);
    props.setShowUnitForm(false);
  };

  const handleSaveUnitToProject = () => {
    const rawDigitPrice = String(unitDraft.price ?? '').replace(/[^\d]/g, '');
    const cleanName = String(unitDraft.name ?? '').trim();
    const cleanLand = String(unitDraft.landArea ?? '').trim();
    const cleanBuild = String(unitDraft.buildArea ?? '').trim();
    const cleanBeds = String(unitDraft.beds ?? '').trim();
    const cleanBaths = String(unitDraft.baths ?? '').trim();
    const cleanCarport = String(unitDraft.carport ?? '').trim();
    const cleanStatus = String(unitDraft.status ?? '').trim();
    const unitPhotos = Array.isArray(unitDraft.photos) ? unitDraft.photos : [];

    if (
      !cleanName ||
      !rawDigitPrice ||
      Number(rawDigitPrice) <= 0 ||
      !cleanLand ||
      !cleanBuild ||
      cleanBeds === '' ||
      cleanBaths === '' ||
      cleanCarport === '' ||
      !cleanStatus
    ) {
      alert(
        'Semua kolom spesifikasi Unit (Nama Unit, Harga, Luas Tanah, Luas Bangunan, Kamar Tidur, Kamar Mandi, Carport, dan Status) wajib diisi!'
      );
      return;
    }

    if (unitPhotos.length === 0) {
      alert('Wajib memilih atau mengunggah minimal 1 Foto untuk Unit ini!');
      return;
    }

    const savedUnit = {
      ...unitDraft,
      name: cleanName,
      price: rawDigitPrice,
      rawPrice: Number(rawDigitPrice) || 0,
      landArea: cleanLand,
      buildArea: cleanBuild,
      beds: Number(cleanBeds),
      baths: Number(cleanBaths),
      carport: Number(cleanCarport),
      status: cleanStatus,
      photos: [...unitPhotos],
      id: unitDraft.id || Date.now()
    };

    if (editingUnitIndex() !== null) {
      const updatedUnits = [...props.projectForm.units];
      updatedUnits[editingUnitIndex()] = savedUnit;
      props.setProjectForm('units', updatedUnits);
    } else {
      props.setProjectForm('units', [...props.projectForm.units, savedUnit]);
    }

    resetUnitDraft();
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();

    if (!String(props.projectForm.name || '').trim()) {
      alert('Nama Project / Cluster wajib diisi!');
      return;
    }

    if (!selectedKota() || !selectedKecamatan() || !String(props.projectForm.location || '').trim()) {
      alert('Kota Administrasi, Kecamatan, dan Lokasi Project wajib dipilih/diisi!');
      return;
    }

    if (!Array.isArray(props.projectForm.photos) || props.projectForm.photos.length === 0) {
      alert('Wajib mengunggah atau menambahkan minimal 1 Foto Project!');
      return;
    }

    if (!Array.isArray(props.projectForm.videos) || props.projectForm.videos.length === 0) {
      alert('Wajib mengunggah atau menambahkan minimal 1 Video Project!');
      return;
    }

    if (!Array.isArray(props.projectForm.units) || props.projectForm.units.length === 0) {
      alert('Wajib menambahkan minimal 1 Tipe Unit ke dalam daftar project sebelum menyimpan!');
      return;
    }

    props.onSubmit(e);
  };

  const handleEditUnitInModal = (index) => {
    const target = props.projectForm.units[index];
    const cleanDigits = toRawDigitString(target);

    setUnitDraft({
      ...createDefaultUnitForm(),
      ...target,
      price: cleanDigits,
      rawPrice: cleanDigits ? Number(cleanDigits) : 0,
      carport: target.carport ?? 1,
      photos: Array.isArray(target.photos) ? [...target.photos] : []
    });
    setEditingUnitIndex(index);
    props.setShowUnitForm(true);
  };

  const handleRemoveUnitInModal = (index) => {
    props.setProjectForm('units', removeAtIndex(props.projectForm.units, index));
    if (editingUnitIndex() === index) resetUnitDraft();
  };

  return (
    <Show when={props.show}>
      <div class="modal-backdrop" onClick={props.onClose}>
        <div class="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <div>
              <h2>{props.isEditing ? 'Edit Project Properti' : 'Tambah Project Baru'}</h2>
              <p class="modal-subtitle">
                Atur informasi project, pilih Kecamatan, urutkan foto cover, dan assign foto ke unit.
              </p>
            </div>
            <button type="button" class="btn-close" onClick={props.onClose} aria-label="Tutup Modal">
              <ModalIcon.Close />
            </button>
          </div>

          <form onSubmit={handleModalSubmit} class="modal-body scrollable-body">
            {/* SECTION 1: INFORMASI & LOKASI KECAMATAN PROJECT */}
            <div class="form-section">
              <h3 class="section-heading">1. Informasi & Lokasi Project / Cluster</h3>
              <div class="form-grid">
                <div class="input-group col-span-2">
                  <label>Nama Project / Cluster *</label>
                  <input
                    type="text"
                    placeholder="Cth: Cluster Emerald Residence"
                    value={props.projectForm.name}
                    onInput={handleProjectInput('name')}
                    required
                  />
                </div>

                <div class="input-group col-span-2">
                  <label>Pilih Wilayah DKI Jakarta (Sampai Level Kecamatan)</label>
                  <div class="location-cascade-grid two-cols">
                    <div class="input-group">
                      <span class="sub-label">1. Kota / Kab. Administrasi</span>
                      <select value={selectedKota()} onChange={handleKotaChange}>
                        <option value="">-- Pilih Kota / Kabupaten --</option>
                        <For each={KOTA_LIST}>
                          {(kota) => <option value={kota}>{kota}</option>}
                        </For>
                      </select>
                    </div>

                    <div class="input-group">
                      <span class="sub-label">2. Kecamatan</span>
                      <select
                        value={selectedKecamatan()}
                        onChange={handleKecamatanChange}
                        disabled={!selectedKota()}
                      >
                        <option value="">
                          {selectedKota() ? '-- Pilih Kecamatan --' : 'Pilih Kota dulu'}
                        </option>
                        <For each={kecamatanList()}>
                          {(kec) => <option value={kec}>Kec. {kec}</option>}
                        </For>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="input-group col-span-2">
                  <label class="label-with-icon">
                    <ModalIcon.MapPin />
                    <span>Lokasi Project Terformat (Kecamatan & Kota) *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Kec. ..., Jakarta ..."
                    value={props.projectForm.location}
                    onInput={handleProjectInput('location')}
                    required
                  />
                </div>

                <div class="input-group col-span-2">
                  <label class="label-with-icon">
                    <ModalIcon.MapPin />
                    <span>Embed Exact Location (Kode Iframe Google Maps / Link Maps / Koordinat Titik Persis)</span>
                  </label>
                  <input
                    type="text"
                    placeholder='Tempel <iframe src="https://www.google.com/maps/embed?...">, link Google Maps, atau koordinat (-6.2146, 106.8451)'
                    value={props.projectForm.exactLocation || ''}
                    onInput={handleProjectInput('exactLocation')}
                  />
                  <span class="text-xs text-muted">
                    Opsional: Buka Google Maps &rarr; Bagikan (Share) &rarr; Sematkan Peta (Embed a map) &rarr; Salin HTML, lalu tempel di sini untuk menampilkan titik lokasi persis.
                  </span>

                  <Show when={(props.projectForm.exactLocation || '').trim()}>
                    <div class="exact-map-preview-box">
                      <iframe
                        title="Preview Exact Location"
                        src={resolveExactMapUrls(props.projectForm.exactLocation, props.projectForm.location).mapEmbedUrl}
                        class="map-iframe"
                        loading="lazy"
                      ></iframe>
                    </div>
                  </Show>
                </div>

                <div class="input-group col-span-2">
                  <label>Deskripsi Project & Fasilitas Kawasan</label>
                  <RichDescriptionEditor
                    rows={8}
                    placeholder="Fasilitas keamanan 24 jam, clubhouse, dekat akses tol, atau tautan brosur..."
                    value={props.projectForm.description}
                    onChange={(val) => props.setProjectForm('description', val)}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: GALERI MEDIA, RE-ARRANGE FOTO COVER, & ASSIGN KE UNIT */}
            <div class="form-section">
              <h3 class="section-heading">
                2. Galeri Media Project (Atur Cover PropertyCard & Assign ke Unit)
              </h3>
              <p class="text-xs text-muted section-subhint">
                Foto urutan #1 otomatis menjadi <strong>Cover Utama di PropertyCard</strong>. Gunakan tombol Kiri / Kanan untuk mengurutkan foto.
              </p>

              <div class="form-grid">
                <div class="media-box col-span-2">
                  <label class="media-label label-with-icon">
                    <ModalIcon.Camera />
                    <span>Foto Project ({props.projectForm.photos.length})</span>
                  </label>
                  <div class="media-input-row">
                    <input
                      type="url"
                      placeholder="Tempel URL foto..."
                      value={photoUrlInput()}
                      onInput={(e) => setPhotoUrlInput(e.currentTarget.value)}
                    />
                    <button type="button" class="btn-secondary" onClick={handleAddPhotoUrl}>
                      + Link Foto
                    </button>
                  </div>
                  <label class="upload-dropzone label-with-icon-center">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoFilesUpload}
                      hidden
                    />
                    <ModalIcon.Upload />
                    <span>Pilih Beberapa File Foto dari Perangkat</span>
                  </label>

                  <Show when={props.projectForm.photos.length > 0}>
                    <div class="photo-manager-grid">
                      <For each={props.projectForm.photos}>
                        {(photo, idx) => {
                          const assignedUnitsCount = () =>
                            (props.projectForm.units || []).filter((u) =>
                              (u.photos || []).includes(photo)
                            ).length;

                          return (
                            <PhotoManagerCard
                              photo={photo}
                              index={idx()}
                              total={props.projectForm.photos.length}
                              coverLabel="COVER CARD"
                              altPrefix="Foto"
                              onRemove={() =>
                                props.setProjectForm('photos', removeAtIndex(props.projectForm.photos, idx()))
                              }
                              onMoveLeft={() =>
                                props.setProjectForm('photos', moveItem(props.projectForm.photos, idx(), -1))
                              }
                              onMoveRight={() =>
                                props.setProjectForm('photos', moveItem(props.projectForm.photos, idx(), 1))
                              }
                              onSetCover={() =>
                                props.setProjectForm('photos', promoteToFirst(props.projectForm.photos, idx()))
                              }
                              onDropReorder={(fromIdx, toIdx) =>
                                props.setProjectForm('photos', reorderList(props.projectForm.photos, fromIdx, toIdx))
                              }
                            >
                              <Show when={(props.projectForm.units || []).length > 0}>
                                <div class="photo-assign-row">
                                  <select
                                    class="photo-assign-select"
                                    onChange={(e) => {
                                      handleAssignProjectPhotoToUnit(photo, e.currentTarget.value);
                                      e.currentTarget.value = '';
                                    }}
                                  >
                                    <option value="">
                                      Assign ke Unit ({assignedUnitsCount()} terpilih)
                                    </option>
                                    <option value="ALL">Semua Unit</option>
                                    <For each={props.projectForm.units}>
                                      {(u, uIdx) => (
                                        <option value={uIdx()}>
                                          {(u.photos || []).includes(photo) ? '[Terpilih] ' : ''}
                                          {u.name}
                                        </option>
                                      )}
                                    </For>
                                  </select>
                                </div>
                              </Show>
                            </PhotoManagerCard>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>

                <div class="media-box col-span-2">
                  <label class="media-label label-with-icon">
                    <ModalIcon.Video />
                    <span>Video Project ({props.projectForm.videos.length})</span>
                  </label>
                  <div class="media-input-row">
                    <input
                      type="url"
                      placeholder="Tempel URL video (MP4)..."
                      value={videoUrlInput()}
                      onInput={(e) => setVideoUrlInput(e.currentTarget.value)}
                    />
                    <button type="button" class="btn-secondary" onClick={handleAddVideoUrl}>
                      + Link Video
                    </button>
                  </div>
                  <label class="upload-dropzone label-with-icon-center">
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={handleVideoFilesUpload}
                      hidden
                    />
                    <ModalIcon.Upload />
                    <span>Pilih Beberapa File Video dari Perangkat</span>
                  </label>

                  <Show when={props.projectForm.videos.length > 0}>
                    <div class="video-preview-list">
                      <For each={props.projectForm.videos}>
                        {(video, idx) => (
                          <div class="video-preview-item">
                            <span class="video-name label-with-icon">
                              <ModalIcon.Play />
                              <span>Video #{idx() + 1} ({video.slice(0, 32)}...)</span>
                            </span>
                            <button
                              type="button"
                              class="remove-video-btn"
                              onClick={() =>
                                props.setProjectForm('videos', removeAtIndex(props.projectForm.videos, idx()))
                              }
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
                  <h3 class="section-heading no-margin">
                    3. Daftar Unit di Project Ini ({props.projectForm.units.length})
                  </h3>
                  <span class="text-xs text-muted">
                    Masukkan harga unit dalam angka digit penuh (contoh: 900000000).
                  </span>
                </div>
                <Show when={!props.showUnitForm}>
                  <button
                    type="button"
                    class="btn-sm-primary"
                    onClick={() => {
                      resetUnitDraft();
                      props.setShowUnitForm(true);
                    }}
                  >
                    + Tambah Unit
                  </button>
                </Show>
              </div>

              <Show when={props.showUnitForm}>
                <div class="unit-subform">
                  <div class="unit-subform-header">
                    <strong>
                      {editingUnitIndex() !== null ? 'Edit Unit & Galeri Unit' : 'Tambah Unit Baru ke Project'}
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
                        onInput={handleUnitInput('name')}
                      />
                    </div>

                    <div class="input-group">
                      <label>Harga Unit (Angka Digit Murni) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Cth: 900000000 atau 1200000000"
                        value={unitDraft.price}
                        onInput={handleUnitInput('price')}
                      />
                    </div>

                    <div class="input-group">
                      <label>Luas Tanah (m²)</label>
                      <input
                        type="number"
                        placeholder="90"
                        value={unitDraft.landArea}
                        onInput={handleUnitInput('landArea')}
                      />
                    </div>

                    <div class="input-group">
                      <label>Luas Bangunan (m²)</label>
                      <input
                        type="number"
                        placeholder="45"
                        value={unitDraft.buildArea}
                        onInput={handleUnitInput('buildArea')}
                      />
                    </div>

                    <div class="input-group">
                      <label>Kamar Tidur (KT)</label>
                      <input
                        type="number"
                        min="0"
                        value={unitDraft.beds}
                        onInput={handleUnitInput('beds')}
                      />
                    </div>

                    <div class="input-group">
                      <label>Kamar Mandi (KM)</label>
                      <input
                        type="number"
                        min="0"
                        value={unitDraft.baths}
                        onInput={handleUnitInput('baths')}
                      />
                    </div>

                    <div class="input-group">
                      <label>Carport (Mobil)</label>
                      <input
                        type="number"
                        min="0"
                        value={unitDraft.carport ?? 1}
                        onInput={handleUnitInput('carport')}
                      />
                    </div>

                    <div class="input-group">
                      <label>Status Ketersediaan Unit</label>
                      <select value={unitDraft.status} onChange={handleUnitInput('status')}>
                        <option value="Tersedia">Tersedia</option>
                        <option value="Booking">Booking</option>
                        <option value="Sold">Sold (Terjual)</option>
                      </select>
                    </div>

                    <div class="input-group col-span-2">
                      <label>Deskripsi Spesifik Unit</label>
                      <RichDescriptionEditor
                        rows={5}
                        placeholder="Smart door lock, carport 2 mobil, spesifikasi bangunan, atau link tur virtual..."
                        value={unitDraft.description}
                        onChange={(val) => setUnitDraft('description', val)}
                      />
                    </div>

                    <div class="input-group col-span-2 unit-photo-picker-box">
                      <label>
                        Foto Unit Ini ({(unitDraft.photos || []).length} dipilih) — Klik foto dari Galeri Project di bawah atau upload baru:
                      </label>

                      <Show
                        when={props.projectForm.photos.length > 0}
                        fallback={
                          <span class="text-xs text-muted">
                            Belum ada foto di Galeri Project. Anda bisa upload langsung foto unit di bawah.
                          </span>
                        }
                      >
                        <div class="unit-gallery-selector">
                          <For each={props.projectForm.photos}>
                            {(projPhoto, pIdx) => {
                              const isSelected = () => (unitDraft.photos || []).includes(projPhoto);
                              return (
                                <button
                                  type="button"
                                  class={`unit-selectable-thumb ${isSelected() ? 'selected' : ''}`}
                                  onClick={() => togglePhotoInUnitDraft(projPhoto)}
                                  title="Klik untuk assign / lepas foto ini dari unit"
                                >
                                  <img src={projPhoto} alt={`Project Foto ${pIdx() + 1}`} />
                                  <span class="select-check-badge">
                                    {isSelected() ? 'Terpilih' : 'Pilih'}
                                  </span>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </Show>

                      <div class="media-input-row mt-8">
                        <input
                          type="url"
                          placeholder="Atau tempel URL foto khusus unit ini..."
                          value={unitPhotoUrlInput()}
                          onInput={(e) => setUnitPhotoUrlInput(e.currentTarget.value)}
                        />
                        <button type="button" class="btn-secondary" onClick={handleAddUnitPhotoUrl}>
                          + Link Foto Unit
                        </button>
                        <label class="btn-secondary label-with-icon">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleUnitPhotoFilesUpload}
                            hidden
                          />
                          <ModalIcon.Upload /> Upload Foto Unit
                        </label>
                      </div>

                      <Show when={(unitDraft.photos || []).length > 0}>
                        <div class="mt-10">
                          <span class="sub-label">Urutan Foto pada Unit Ini (Foto #1 menjadi Cover Unit):</span>
                          <div class="photo-manager-grid mt-6">
                            <For each={unitDraft.photos}>
                              {(uPhoto, uIdx) => (
                                <PhotoManagerCard
                                  photo={uPhoto}
                                  index={uIdx()}
                                  total={unitDraft.photos.length}
                                  coverLabel="COVER UNIT"
                                  altPrefix="Unit Foto"
                                  onRemove={() =>
                                    setUnitDraft('photos', removeAtIndex(unitDraft.photos, uIdx()))
                                  }
                                  onMoveLeft={() =>
                                    setUnitDraft('photos', moveItem(unitDraft.photos, uIdx(), -1))
                                  }
                                  onMoveRight={() =>
                                    setUnitDraft('photos', moveItem(unitDraft.photos, uIdx(), 1))
                                  }
                                  onSetCover={() =>
                                    setUnitDraft('photos', promoteToFirst(unitDraft.photos, uIdx()))
                                  }
                                  onDropReorder={(fromIdx, toIdx) =>
                                    setUnitDraft('photos', reorderList(unitDraft.photos, fromIdx, toIdx))
                                  }
                                />
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
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
                  each={props.projectForm.units}
                  fallback={
                    <div class="empty-units">
                      Belum ada unit yang ditambahkan. Klik tombol "+ Tambah Unit" di atas.
                    </div>
                  }
                >
                  {(unit, idx) => (
                    <div class="modal-unit-row">
                      <div class="project-cell">
                        <Show when={unit.photos?.[0]}>
                          <img src={unit.photos[0]} alt={unit.name} class="project-thumb" />
                        </Show>
                        <div>
                          <div class="unit-item-title">
                            <strong>{unit.name}</strong>
                            <span class={`badge ${getStatusColor(unit.status)}`}>{unit.status}</span>
                            <span class="media-pill">{(unit.photos || []).length} Foto</span>
                          </div>
                          <div class="unit-item-specs">
                            <span>Rp {toRawDigitString(unit) || '0'}</span>
                            <span>•</span>
                            <span>
                              LT {unit.landArea || '-'}m² / LB {unit.buildArea || '-'}m²
                            </span>
                            <span>•</span>
                            <span>
                              {unit.beds} KT, {unit.baths} KM, {unit.carport ?? 1} Carport
                            </span>
                          </div>
                        </div>
                      </div>
                      <div class="modal-unit-actions">
                        <button
                          type="button"
                          class="btn-text"
                          onClick={() => handleEditUnitInModal(idx())}
                        >
                          Edit & Foto
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
              <button type="button" class="btn-ghost" onClick={props.onClose}>
                Batal
              </button>
              <button type="submit" class="btn-primary" disabled={props.isSaving}>
                {props.isSaving
                  ? 'Menyimpan...'
                  : props.isEditing
                  ? 'Simpan Perubahan Project'
                  : 'Simpan Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}