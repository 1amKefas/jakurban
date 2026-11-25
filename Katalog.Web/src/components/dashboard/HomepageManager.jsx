import { createSignal, createEffect, createMemo, For, Show } from 'solid-js';
import {
  DEFAULT_HOMEPAGE_CONFIG,
  mergeHomepageConfig,
  normalizeDriveImageUrl
} from '../../constants/homepageDefault';
import { apiService } from '../../services/api';

const SUB_TABS = [
  { key: 'hero', label: 'Hero & Billboard' },
  { key: 'popup', label: 'Pop-Up Promo' },
  { key: 'carousel', label: 'Carousel & Statistik' },
  { key: 'showcase', label: 'Seksi Keunggulan' }
];

export default function HomepageManager(props) {
  const [subTab, setSubTab] = createSignal('hero');
  const [draft, setDraft] = createSignal(mergeHomepageConfig(props.homepageConfig));
  const [saveNotice, setSaveNotice] = createSignal('');
  const [saveError, setSaveError] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);
  const [uploadingKey, setUploadingKey] = createSignal('');
  const [previewBillboardIdx, setPreviewBillboardIdx] = createSignal(0);
  const [activeSlideIdx, setActiveSlideIdx] = createSignal(0);

  createEffect(() => {
    setDraft(mergeHomepageConfig(props.homepageConfig));
  });

  const patchDraft = (updater) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      updater(next);
      return next;
    });
  };

  const handleUploadFileToTarget = async (file, key, applyUrl) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      const uploadedUrl = await apiService.uploadImage(file);
      patchDraft((d) => applyUrl(d, uploadedUrl));
    } catch (err) {
      alert(`Gagal mengunggah gambar: ${err.message}`);
    } finally {
      setUploadingKey('');
    }
  };

  const handleSaveAll = async (e) => {
    e?.preventDefault();
    setSaveNotice('');
    setSaveError('');
    setIsSaving(true);

    const cleanData = structuredClone(draft());
    cleanData.hero.billboards = (cleanData.hero.billboards || []).map((b) => ({
      ...b,
      imageUrl: normalizeDriveImageUrl(b.imageUrl)
    }));
    cleanData.popup.imageUrl = normalizeDriveImageUrl(cleanData.popup.imageUrl);
    cleanData.carouselSlides = (cleanData.carouselSlides || []).map((slide) => ({
      ...slide,
      photos: (slide.photos || []).map((p) => ({
        ...p,
        url: normalizeDriveImageUrl(p.url)
      }))
    }));

    try {
      await props.onSaveConfig?.(cleanData);

      const activeBillboardCount = cleanData.hero.billboards.filter((b) => b.imageUrl).length;
      props.addActivityLog?.({
        action: 'UPDATE',
        category: 'HOMEPAGE',
        target: 'Konten Homepage & Billboard',
        details: `Memperbarui homepage (${activeBillboardCount} billboard hero, ${cleanData.carouselSlides.length} slide rekam jejak, Pop-Up ${
          cleanData.popup.enabled ? 'Aktif' : 'Nonaktif'
        })`
      });

      setSaveNotice('Berhasil disimpan ke server! Semua pengunjung & perangkat sekarang melihat versi terbaru.');
      setTimeout(() => setSaveNotice(''), 4000);
    } catch (err) {
      setSaveError(
        `Hanya tersimpan di browser ini — GAGAL sinkron ke server (${err.message}). Pastikan backend Render sudah selesai deploy.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (!confirm('Kembalikan seluruh teks, billboard, statistik, dan foto homepage ke pengaturan awal?')) return;
    setDraft(structuredClone(DEFAULT_HOMEPAGE_CONFIG));
    setPreviewBillboardIdx(0);
    setActiveSlideIdx(0);
  };

  // --- Helper Hero Billboard ---
  const previewBillboard = createMemo(() => {
    const list = draft().hero.billboards || [];
    const target = list[previewBillboardIdx()] || list.find((b) => b.imageUrl) || null;
    return target ? { ...target, resolvedUrl: normalizeDriveImageUrl(target.imageUrl) } : null;
  });

  const addBillboard = () => {
    patchDraft((d) => {
      d.hero.billboards.push({
        id: `bb-${Date.now()}`,
        imageUrl: '',
        caption: ''
      });
    });
    setPreviewBillboardIdx(draft().hero.billboards.length - 1);
  };

  const removeBillboard = (idx) => {
    patchDraft((d) => {
      if (d.hero.billboards.length <= 1) {
        d.hero.billboards[0] = { id: 'bb-1', imageUrl: '', caption: '' };
      } else {
        d.hero.billboards.splice(idx, 1);
      }
    });
    setPreviewBillboardIdx((prev) =>
      Math.max(0, Math.min(prev, draft().hero.billboards.length - 1))
    );
  };

  const moveBillboard = (idx, dir) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= draft().hero.billboards.length) return;
    patchDraft((d) => {
      const arr = d.hero.billboards;
      [arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]];
    });
    setPreviewBillboardIdx(nextIdx);
  };

  // --- Helper Carousel Slides ---
  const currentSlide = () => draft().carouselSlides[activeSlideIdx()] || draft().carouselSlides[0];

  const addSlide = () => {
    const num = draft().carouselSlides.length + 1;
    patchDraft((d) => {
      d.carouselSlides.push({
        id: `slide-${Date.now()}`,
        tag: `0${num} / HIGHLIGHT`,
        title: 'Judul Slide Baru',
        desc: 'Deskripsi singkat keunggulan atau pencapaian perusahaan.',
        stats: [
          { value: '10+', label: 'Statistik 1' },
          { value: '100+', label: 'Statistik 2' },
          { value: '100%', label: 'Statistik 3' }
        ],
        photos: [{ url: '', label: 'Highlight', caption: 'Keterangan Foto' }]
      });
    });
    setActiveSlideIdx(draft().carouselSlides.length - 1);
  };

  const removeSlide = (idx) => {
    if (draft().carouselSlides.length <= 1) {
      alert('Minimal harus ada 1 slide pada carousel homepage.');
      return;
    }
    patchDraft((d) => {
      d.carouselSlides.splice(idx, 1);
    });
    setActiveSlideIdx((prev) => Math.max(0, Math.min(prev, draft().carouselSlides.length - 1)));
  };

  const addPhotoToSlide = (slideIdx) => {
    patchDraft((d) => {
      d.carouselSlides[slideIdx].photos.push({
        url: '',
        label: 'Galeri',
        caption: 'Judul Foto Baru'
      });
    });
  };

  const removePhotoFromSlide = (slideIdx, photoIdx) => {
    patchDraft((d) => {
      d.carouselSlides[slideIdx].photos.splice(photoIdx, 1);
    });
  };

  const addShowcaseCard = () => {
    const num = draft().showcase.cards.length + 1;
    patchDraft((d) => {
      d.showcase.cards.push({
        id: `card-${Date.now()}`,
        tag: `0${num} / KEUNGGULAN`,
        stat: 'Highlight',
        title: 'Judul Kartu Baru',
        desc: 'Penjelasan singkat keunggulan proyek.'
      });
    });
  };

  const removeShowcaseCard = (idx) => {
    if (draft().showcase.cards.length <= 1) return;
    patchDraft((d) => {
      d.showcase.cards.splice(idx, 1);
    });
  };

  return (
    <div class="homepage-cms-wrapper">
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Kelola Konten Homepage</h1>
          <p class="page-subtitle">
            Atur Billboard latar Hero, teks & search bar, Pop-Up promo, slide Carousel & statistik, hingga kartu keunggulan secara terpusat.
          </p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-ghost" onClick={handleResetDefault}>
            Reset Default
          </button>
          <button type="button" class="btn-ghost" onClick={() => props.setView?.('catalog')}>
            Pratinjau Penuh
          </button>
          <button type="button" class="btn-primary" onClick={handleSaveAll} disabled={isSaving()}>
            {isSaving() ? 'Menyimpan...' : 'Simpan & Publikasikan'}
          </button>
        </div>
      </div>

      <Show when={saveNotice()}>
        <div class="cms-save-toast">{saveNotice()}</div>
      </Show>
      <Show when={saveError()}>
        <div class="cms-save-toast" style={{ background: '#fee2e2', color: '#991b1b', 'border-color': '#fecaca' }}>
          {saveError()}
        </div>
      </Show>

      <div class="log-filter-pills cms-subtabs">
        <For each={SUB_TABS}>
          {(tab) => (
            <button
              type="button"
              class={`filter-pill-btn ${subTab() === tab.key ? 'active' : ''}`}
              onClick={() => setSubTab(tab.key)}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      {/* TAB 1: HERO & BILLBOARD LATAR BELAKANG */}
      <Show when={subTab() === 'hero'}>
        <div class="form-section cms-card">
          <div class="section-header-inline">
            <div>
              <h3 class="section-heading no-margin">Live Mini-Preview Hero & Billboard</h3>
              <p class="text-xs text-muted">
                Billboard tampil di belakang judul & search bar dengan lapisan gelap otomatis agar teks tetap tajam terbaca.
              </p>
            </div>
            <Show when={(draft().hero.billboards || []).length > 1}>
              <div class="cms-preview-switcher">
                <For each={draft().hero.billboards || []}>
                  {(_, idx) => (
                    <button
                      type="button"
                      class={`btn-sm-outline ${previewBillboardIdx() === idx() ? 'cms-active-outline' : ''}`}
                      onClick={() => setPreviewBillboardIdx(idx())}
                    >
                      Slide #{idx() + 1}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div
            class="cms-hero-preview-stage"
            style={{
              'background-image': previewBillboard()?.resolvedUrl
                ? `url("${previewBillboard().resolvedUrl}")`
                : 'none'
            }}
          >
            <div
              class="cms-hero-preview-overlay"
              style={{
                background: previewBillboard()?.resolvedUrl
                  ? `rgba(15, 44, 89, ${draft().hero.overlayOpacity ?? 0.62})`
                  : 'var(--color-primary, #0F2C59)'
              }}
            />
            <div class="cms-hero-preview-content">
              <h4>{draft().hero.title || 'Judul Hero'}</h4>
              <p>{draft().hero.subtitle || 'Subjudul Hero'}</p>
              <div class="cms-hero-preview-search">
                <span>{draft().hero.searchPlaceholder || 'Lokasi, Nama Proyek, Harga ...'}</span>
                <span class="cms-hero-preview-search-btn">Cari</span>
              </div>
            </div>
            <Show when={previewBillboard()?.caption}>
              <span class="cms-hero-preview-caption">{previewBillboard().caption}</span>
            </Show>
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label>Judul Utama Hero (Tekan Enter untuk baris baru)</label>
              <textarea
                rows="2"
                value={draft().hero.title}
                onInput={(e) => patchDraft((d) => { d.hero.title = e.currentTarget.value; })}
              />
            </div>

            <div class="input-group">
              <label>Subjudul Hero</label>
              <textarea
                rows="2"
                value={draft().hero.subtitle}
                onInput={(e) => patchDraft((d) => { d.hero.subtitle = e.currentTarget.value; })}
              />
            </div>

            <div class="input-group">
              <label>Placeholder Search Bar</label>
              <input
                type="text"
                value={draft().hero.searchPlaceholder}
                onInput={(e) =>
                  patchDraft((d) => { d.hero.searchPlaceholder = e.currentTarget.value; })
                }
              />
            </div>

            <div class="input-group">
              <label>
                Kegelapan Overlay Billboard: <strong>{Math.round((draft().hero.overlayOpacity ?? 0.62) * 100)}%</strong>
              </label>
              <input
                type="range"
                min="0.25"
                max="0.85"
                step="0.05"
                value={draft().hero.overlayOpacity ?? 0.62}
                onInput={(e) =>
                  patchDraft((d) => { d.hero.overlayOpacity = parseFloat(e.currentTarget.value); })
                }
              />
              <span class="text-xs text-muted">
                Geser lebih gelap jika gambar billboard terlalu terang agar tulisan putih tetap jelas.
              </span>
            </div>

            <div class="input-group">
              <label>Kecepatan Ganti Slide Otomatis (Detik)</label>
              <input
                type="number"
                min="3"
                max="20"
                value={draft().hero.autoSlideSeconds ?? 6}
                onInput={(e) =>
                  patchDraft((d) => {
                    d.hero.autoSlideSeconds = Math.max(3, parseInt(e.currentTarget.value, 10) || 6);
                  })
                }
              />
            </div>
          </div>

          <div class="section-header-inline mt-10">
            <div>
              <h4 class="cms-sub-heading no-margin">
                Daftar Gambar Billboard Latar Belakang ({(draft().hero.billboards || []).length})
              </h4>
              <p class="text-xs text-muted">
                Bisa tempel link share Google Drive ("Anyone with the link") atau upload langsung dari perangkat. Kosongkan semua untuk kembali ke warna biru polos.
              </p>
            </div>
            <button type="button" class="btn-sm-primary" onClick={addBillboard}>
              + Tambah Billboard
            </button>
          </div>

          <div class="cms-photos-edit-list">
            <For each={draft().hero.billboards || []}>
              {(bb, idx) => (
                <div
                  class={`cms-photo-edit-row ${previewBillboardIdx() === idx() ? 'is-selected-row' : ''}`}
                  onClick={() => setPreviewBillboardIdx(idx())}
                >
                  <div class="cms-photo-thumb">
                    <Show
                      when={bb.imageUrl}
                      fallback={<span class="text-xs text-muted">Biru Polos</span>}
                    >
                      <img src={normalizeDriveImageUrl(bb.imageUrl)} alt={`Billboard ${idx() + 1}`} />
                    </Show>
                  </div>

                  <div class="form-grid flex-1">
                    <div class="input-group col-span-2">
                      <label>Billboard #{idx() + 1} — Link Google Drive / URL Gambar</label>
                      <div class="media-input-row">
                        <input
                          type="url"
                          value={bb.imageUrl}
                          onInput={(e) =>
                            patchDraft((d) => {
                              d.hero.billboards[idx()].imageUrl = e.currentTarget.value;
                            })
                          }
                          placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                        />
                        <label class="btn-secondary cms-upload-btn">
                          {uploadingKey() === `bb-${idx()}` ? 'Mengunggah...' : 'Upload Foto'}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            disabled={uploadingKey() !== ''}
                            onChange={(e) => {
                              const file = e.currentTarget.files?.[0];
                              e.currentTarget.value = '';
                              handleUploadFileToTarget(file, `bb-${idx()}`, (d, url) => {
                                d.hero.billboards[idx()].imageUrl = url;
                              });
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div class="input-group col-span-2">
                      <label>Label / Caption Halus di Pojok Bawah (Opsional)</label>
                      <input
                        type="text"
                        value={bb.caption || ''}
                        onInput={(e) =>
                          patchDraft((d) => {
                            d.hero.billboards[idx()].caption = e.currentTarget.value;
                          })
                        }
                        placeholder="Cth: Cluster Setiabudi — Jakarta Selatan (kosongkan jika tidak perlu)"
                      />
                    </div>
                  </div>

                  <div class="cms-row-controls">
                    <button
                      type="button"
                      class="photo-ctrl-btn"
                      disabled={idx() === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBillboard(idx(), -1);
                      }}
                      title="Geser ke Atas"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="photo-ctrl-btn"
                      disabled={idx() === (draft().hero.billboards || []).length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBillboard(idx(), 1);
                      }}
                      title="Geser ke Bawah"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      class="btn-text danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBillboard(idx());
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* TAB 2: POP-UP PROMO / PENGUMUMAN */}
      <Show when={subTab() === 'popup'}>
        <div class="form-section cms-card">
          <div class="section-header-inline">
            <div>
              <h3 class="section-heading no-margin">Pop-Up Promo / Pengumuman Homepage</h3>
              <p class="text-xs text-muted">
                Muncul otomatis saat pengunjung publik membuka katalog utama.
              </p>
            </div>
            <label class="cms-switch-label">
              <input
                type="checkbox"
                checked={draft().popup.enabled}
                onChange={(e) => patchDraft((d) => { d.popup.enabled = e.currentTarget.checked; })}
              />
              <span>{draft().popup.enabled ? 'Status: Aktif' : 'Status: Nonaktif'}</span>
            </label>
          </div>

          <div class="form-grid">
            <div class="input-group">
              <label>Label Atas (Badge)</label>
              <input
                type="text"
                value={draft().popup.badge}
                onInput={(e) => patchDraft((d) => { d.popup.badge = e.currentTarget.value; })}
                placeholder="Cth: PROMO TERBATAS"
              />
            </div>

            <div class="input-group">
              <label>Judul Pop-Up</label>
              <input
                type="text"
                value={draft().popup.title}
                onInput={(e) => patchDraft((d) => { d.popup.title = e.currentTarget.value; })}
              />
            </div>

            <div class="input-group col-span-2">
              <label>Isi Deskripsi Pop-Up</label>
              <textarea
                rows="3"
                value={draft().popup.description}
                onInput={(e) => patchDraft((d) => { d.popup.description = e.currentTarget.value; })}
              />
            </div>

            <div class="input-group col-span-2">
              <label>Gambar Banner (Link Google Drive atau Upload Langsung)</label>
              <div class="media-input-row">
                <input
                  type="url"
                  value={draft().popup.imageUrl}
                  onInput={(e) => patchDraft((d) => { d.popup.imageUrl = e.currentTarget.value; })}
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                />
                <label class="btn-secondary cms-upload-btn">
                  {uploadingKey() === 'popup' ? 'Mengunggah...' : 'Upload Banner'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={uploadingKey() !== ''}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = '';
                      handleUploadFileToTarget(file, 'popup', (d, url) => {
                        d.popup.imageUrl = url;
                      });
                    }}
                  />
                </label>
              </div>
              <Show when={draft().popup.imageUrl}>
                <div class="cms-img-preview-box">
                  <img
                    src={normalizeDriveImageUrl(draft().popup.imageUrl)}
                    alt="Preview Banner Pop-Up"
                  />
                </div>
              </Show>
            </div>

            <div class="input-group">
              <label>Teks Tombol Utama</label>
              <input
                type="text"
                value={draft().popup.ctaLabel}
                onInput={(e) => patchDraft((d) => { d.popup.ctaLabel = e.currentTarget.value; })}
              />
            </div>

            <div class="input-group">
              <label>Aksi Tombol</label>
              <select
                value={draft().popup.ctaAction}
                onChange={(e) => patchDraft((d) => { d.popup.ctaAction = e.currentTarget.value; })}
              >
                <option value="chatbot">Buka Asisten AI (Chatbot)</option>
                <option value="link">Buka Link Eksternal / WhatsApp</option>
                <option value="close">Hanya Tutup Pop-Up</option>
              </select>
            </div>

            <Show when={draft().popup.ctaAction === 'link'}>
              <div class="input-group col-span-2">
                <label>URL Tujuan Tombol</label>
                <input
                  type="url"
                  value={draft().popup.ctaUrl}
                  onInput={(e) => patchDraft((d) => { d.popup.ctaUrl = e.currentTarget.value; })}
                  placeholder="https://wa.me/628..."
                />
              </div>
            </Show>

            <div class="input-group col-span-2">
              <label class="cms-checkbox-inline">
                <input
                  type="checkbox"
                  checked={draft().popup.showOncePerSession}
                  onChange={(e) =>
                    patchDraft((d) => { d.popup.showOncePerSession = e.currentTarget.checked; })
                  }
                />
                <span>Tampilkan cukup 1 kali per sesi kunjungan</span>
              </label>
            </div>
          </div>
        </div>
      </Show>

      {/* TAB 3: CAROUSEL & STATISTIK */}
      <Show when={subTab() === 'carousel'}>
        <div class="form-section cms-card">
          <div class="section-header-inline">
            <div>
              <h3 class="section-heading no-margin">Slide Carousel & Statistik Rekam Jejak</h3>
              <p class="text-xs text-muted">
                Kelola slide, angka statistik (misal 15+, 320+, 100%), dan foto dokumentasi dari Google Drive atau upload.
              </p>
            </div>
            <button type="button" class="btn-sm-primary" onClick={addSlide}>
              + Tambah Slide
            </button>
          </div>

          <div class="cms-slide-selector">
            <For each={draft().carouselSlides}>
              {(slide, idx) => (
                <button
                  type="button"
                  class={`filter-pill-btn ${activeSlideIdx() === idx() ? 'active' : ''}`}
                  onClick={() => setActiveSlideIdx(idx())}
                >
                  Slide {idx() + 1}: {slide.tag || 'Tanpa Tag'}
                </button>
              )}
            </For>
          </div>

          <Show when={currentSlide()}>
            <div class="cms-slide-editor">
              <div class="section-header-inline">
                <strong>Mengedit Slide #{activeSlideIdx() + 1}</strong>
                <button
                  type="button"
                  class="btn-sm-outline btn-danger-outline"
                  onClick={() => removeSlide(activeSlideIdx())}
                >
                  Hapus Slide Ini
                </button>
              </div>

              <div class="form-grid">
                <div class="input-group">
                  <label>Tag Atas Slide</label>
                  <input
                    type="text"
                    value={currentSlide().tag}
                    onInput={(e) =>
                      patchDraft((d) => { d.carouselSlides[activeSlideIdx()].tag = e.currentTarget.value; })
                    }
                  />
                </div>
                <div class="input-group">
                  <label>Judul Slide (Gunakan Enter untuk baris baru)</label>
                  <textarea
                    rows="2"
                    value={currentSlide().title}
                    onInput={(e) =>
                      patchDraft((d) => { d.carouselSlides[activeSlideIdx()].title = e.currentTarget.value; })
                    }
                  />
                </div>
                <div class="input-group col-span-2">
                  <label>Deskripsi Slide</label>
                  <textarea
                    rows="2"
                    value={currentSlide().desc}
                    onInput={(e) =>
                      patchDraft((d) => { d.carouselSlides[activeSlideIdx()].desc = e.currentTarget.value; })
                    }
                  />
                </div>
              </div>

              <h4 class="cms-sub-heading">Statistik (3 Kotak Angka)</h4>
              <div class="cms-stats-edit-grid">
                <For each={currentSlide().stats || []}>
                  {(st, stIdx) => (
                    <div class="cms-mini-box">
                      <div class="input-group">
                        <label>Angka #{stIdx() + 1}</label>
                        <input
                          type="text"
                          value={st.value}
                          onInput={(e) =>
                            patchDraft((d) => {
                              d.carouselSlides[activeSlideIdx()].stats[stIdx()].value =
                                e.currentTarget.value;
                            })
                          }
                        />
                      </div>
                      <div class="input-group mt-6">
                        <label>Keterangan</label>
                        <input
                          type="text"
                          value={st.label}
                          onInput={(e) =>
                            patchDraft((d) => {
                              d.carouselSlides[activeSlideIdx()].stats[stIdx()].label =
                                e.currentTarget.value;
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class="section-header-inline mt-10">
                <h4 class="cms-sub-heading no-margin">Foto Slide (Link Google Drive / Upload)</h4>
                <button
                  type="button"
                  class="btn-sm-outline"
                  onClick={() => addPhotoToSlide(activeSlideIdx())}
                >
                  + Tambah Foto
                </button>
              </div>

              <div class="cms-photos-edit-list">
                <For each={currentSlide().photos || []}>
                  {(photo, pIdx) => (
                    <div class="cms-photo-edit-row">
                      <div class="cms-photo-thumb">
                        <Show
                          when={photo.url}
                          fallback={<span class="text-xs text-muted">Kosong</span>}
                        >
                          <img src={normalizeDriveImageUrl(photo.url)} alt={photo.caption} />
                        </Show>
                      </div>
                      <div class="form-grid flex-1">
                        <div class="input-group col-span-2">
                          <label>Link Google Drive / URL Foto</label>
                          <div class="media-input-row">
                            <input
                              type="url"
                              value={photo.url}
                              onInput={(e) =>
                                patchDraft((d) => {
                                  d.carouselSlides[activeSlideIdx()].photos[pIdx()].url =
                                    e.currentTarget.value;
                                })
                              }
                              placeholder="https://drive.google.com/file/d/.../view"
                            />
                            <label class="btn-secondary cms-upload-btn">
                              {uploadingKey() === `slide-${activeSlideIdx()}-${pIdx()}`
                                ? 'Mengunggah...'
                                : 'Upload'}
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                disabled={uploadingKey() !== ''}
                                onChange={(e) => {
                                  const file = e.currentTarget.files?.[0];
                                  e.currentTarget.value = '';
                                  handleUploadFileToTarget(
                                    file,
                                    `slide-${activeSlideIdx()}-${pIdx()}`,
                                    (d, url) => {
                                      d.carouselSlides[activeSlideIdx()].photos[pIdx()].url = url;
                                    }
                                  );
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <div class="input-group">
                          <label>Label Kecil (Tag)</label>
                          <input
                            type="text"
                            value={photo.label}
                            onInput={(e) =>
                              patchDraft((d) => {
                                d.carouselSlides[activeSlideIdx()].photos[pIdx()].label =
                                  e.currentTarget.value;
                              })
                            }
                          />
                        </div>
                        <div class="input-group">
                          <label>Caption Foto</label>
                          <input
                            type="text"
                            value={photo.caption}
                            onInput={(e) =>
                              patchDraft((d) => {
                                d.carouselSlides[activeSlideIdx()].photos[pIdx()].caption =
                                  e.currentTarget.value;
                              })
                            }
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        class="btn-text danger"
                        onClick={() => removePhotoFromSlide(activeSlideIdx(), pIdx())}
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* TAB 4: SEKSI KEUNGGULAN */}
      <Show when={subTab() === 'showcase'}>
        <div class="form-section cms-card">
          <h3 class="section-heading">Header Seksi Keunggulan</h3>
          <div class="form-grid">
            <div class="input-group">
              <label>Label Atas (Eyebrow)</label>
              <input
                type="text"
                value={draft().showcase.eyebrow}
                onInput={(e) => patchDraft((d) => { d.showcase.eyebrow = e.currentTarget.value; })}
              />
            </div>
            <div class="input-group">
              <label>Judul Seksi</label>
              <input
                type="text"
                value={draft().showcase.title}
                onInput={(e) => patchDraft((d) => { d.showcase.title = e.currentTarget.value; })}
              />
            </div>
            <div class="input-group col-span-2">
              <label>Subjudul Seksi</label>
              <textarea
                rows="2"
                value={draft().showcase.subtitle}
                onInput={(e) => patchDraft((d) => { d.showcase.subtitle = e.currentTarget.value; })}
              />
            </div>
          </div>

          <div class="section-header-inline mt-10">
            <h4 class="cms-sub-heading no-margin">
              Daftar Kartu Keunggulan ({draft().showcase.cards.length})
            </h4>
            <button type="button" class="btn-sm-outline" onClick={addShowcaseCard}>
              + Tambah Kartu
            </button>
          </div>

          <div class="cms-cards-edit-list">
            <For each={draft().showcase.cards}>
              {(card, cIdx) => (
                <div class="cms-mini-box">
                  <div class="section-header-inline">
                    <strong>Kartu #{cIdx() + 1}</strong>
                    <Show when={draft().showcase.cards.length > 1}>
                      <button
                        type="button"
                        class="btn-text danger"
                        onClick={() => removeShowcaseCard(cIdx())}
                      >
                        Hapus
                      </button>
                    </Show>
                  </div>
                  <div class="form-grid">
                    <div class="input-group">
                      <label>Tag Nomor</label>
                      <input
                        type="text"
                        value={card.tag}
                        onInput={(e) =>
                          patchDraft((d) => { d.showcase.cards[cIdx()].tag = e.currentTarget.value; })
                        }
                      />
                    </div>
                    <div class="input-group">
                      <label>Badge Pill</label>
                      <input
                        type="text"
                        value={card.stat}
                        onInput={(e) =>
                          patchDraft((d) => { d.showcase.cards[cIdx()].stat = e.currentTarget.value; })
                        }
                      />
                    </div>
                    <div class="input-group col-span-2">
                      <label>Judul Kartu</label>
                      <input
                        type="text"
                        value={card.title}
                        onInput={(e) =>
                          patchDraft((d) => { d.showcase.cards[cIdx()].title = e.currentTarget.value; })
                        }
                      />
                    </div>
                    <div class="input-group col-span-2">
                      <label>Deskripsi Kartu</label>
                      <textarea
                        rows="2"
                        value={card.desc}
                        onInput={(e) =>
                          patchDraft((d) => { d.showcase.cards[cIdx()].desc = e.currentTarget.value; })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}