import { createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import SearchBar from './SearchBar';
import {
  DEFAULT_HOMEPAGE_CONFIG,
  normalizeDriveImageUrl
} from '../../constants/homepageDefault';

/**
 * Komponen banner utama (Hero Section) dengan dukungan Billboard latar belakang
 * yang dikelola Super Admin tanpa menghilangkan teks utama dan SearchBar.
 */
export default function Hero(props) {
  const [activeSlide, setActiveSlide] = createSignal(0);

  const hero = createMemo(() => ({
    ...DEFAULT_HOMEPAGE_CONFIG.hero,
    ...(props.heroConfig || {})
  }));

  const activeBillboards = createMemo(() =>
    (hero().billboards || [])
      .map((item) => ({
        ...item,
        resolvedUrl: normalizeDriveImageUrl(item.imageUrl)
      }))
      .filter((item) => item.resolvedUrl)
  );

  const hasBillboard = createMemo(() => activeBillboards().length > 0);
  const overlayAlpha = createMemo(() => {
    const val = Number(hero().overlayOpacity);
    return Number.isNaN(val) ? 0.62 : Math.min(0.88, Math.max(0.2, val));
  });

  createEffect(() => {
    const list = activeBillboards();
    if (list.length <= 1) {
      setActiveSlide(0);
      return;
    }

    if (activeSlide() >= list.length) {
      setActiveSlide(0);
    }

    const sec = Math.max(3, Number(hero().autoSlideSeconds || 6));
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % list.length);
    }, sec * 1000);

    onCleanup(() => clearInterval(timer));
  });

  const currentBillboard = () => activeBillboards()[activeSlide()] || null;

  const prevBillboard = () => {
    const len = activeBillboards().length;
    if (len <= 1) return;
    setActiveSlide((i) => (i - 1 + len) % len);
  };

  const nextBillboard = () => {
    const len = activeBillboards().length;
    if (len <= 1) return;
    setActiveSlide((i) => (i + 1) % len);
  };

  return (
    <section class={`hero ${hasBillboard() ? 'has-billboard' : ''}`}>
      {/* LAYER 0: BILLBOARD BACKGROUND SLIDER */}
      <Show when={hasBillboard()}>
        <div class="hero-billboard-layer" aria-hidden="true">
          <For each={activeBillboards()}>
            {(slide, idx) => (
              <div
                class={`hero-billboard-slide ${activeSlide() === idx() ? 'active' : ''}`}
                style={{ 'background-image': `url("${slide.resolvedUrl}")` }}
              />
            )}
          </For>
          <div
            class="hero-billboard-overlay"
            style={{
              background: `linear-gradient(180deg, rgba(11, 25, 48, ${Math.min(
                0.92,
                overlayAlpha() + 0.08
              )}) 0%, rgba(15, 44, 89, ${overlayAlpha()}) 55%, rgba(11, 25, 48, ${Math.min(
                0.92,
                overlayAlpha() + 0.12
              )}) 100%)`
            }}
          />
        </div>
      </Show>

      {/* LAYER 2: KONTEN UTAMA (TEKS & SEARCH BAR TETAP DI DEPAN) */}
      <div class="container hero-content">
        <h1 class="hero-title-multiline">{hero().title}</h1>
        <p>{hero().subtitle}</p>
        <SearchBar onSearch={props.onSearch} placeholder={hero().searchPlaceholder} />
      </div>

      {/* KONTROL HALUS DI BAGIAN BAWAH HERO (HANYA MUNCUL JIKA ADA CAPTION ATAU >1 BILLBOARD) */}
      <Show when={hasBillboard() && (activeBillboards().length > 1 || currentBillboard()?.caption)}>
        <div class="hero-billboard-footer">
          <Show when={currentBillboard()?.caption}>
            <span class="hero-billboard-caption">{currentBillboard().caption}</span>
          </Show>

          <Show when={activeBillboards().length > 1}>
            <div class="hero-billboard-controls">
              <button
                type="button"
                class="hero-bb-arrow"
                onClick={prevBillboard}
                aria-label="Billboard Sebelumnya"
              >
                ‹
              </button>
              <div class="hero-bb-dots">
                <For each={activeBillboards()}>
                  {(_, idx) => (
                    <button
                      type="button"
                      class={`hero-bb-dot ${activeSlide() === idx() ? 'active' : ''}`}
                      onClick={() => setActiveSlide(idx())}
                      aria-label={`Billboard ${idx() + 1}`}
                    />
                  )}
                </For>
              </div>
              <button
                type="button"
                class="hero-bb-arrow"
                onClick={nextBillboard}
                aria-label="Billboard Berikutnya"
              >
                ›
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </section>
  );
}