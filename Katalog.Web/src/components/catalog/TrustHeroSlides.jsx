import { createSignal, createMemo, createEffect, For } from 'solid-js';
import {
  DEFAULT_HOMEPAGE_CONFIG,
  normalizeDriveImageUrl
} from '../../constants/homepageDefault';

export default function TrustHeroSlides(props) {
  const [activeIndex, setActiveIndex] = createSignal(0);

  const slides = createMemo(() =>
    Array.isArray(props.slides) && props.slides.length > 0
      ? props.slides
      : DEFAULT_HOMEPAGE_CONFIG.carouselSlides
  );

  createEffect(() => {
    if (activeIndex() >= slides().length) {
      setActiveIndex(0);
    }
  });

  const current = () => slides()[activeIndex()] || slides()[0];

  const prevSlide = () =>
    setActiveIndex((i) => (i - 1 + slides().length) % slides().length);
  const nextSlide = () =>
    setActiveIndex((i) => (i + 1) % slides().length);

  return (
    <section class="trust-hero-modern">
      <div class="trust-ambient-orb orb-1"></div>
      <div class="trust-ambient-orb orb-2"></div>

      <div class="container">
        <div class="trust-glass-shell">
          <div class="trust-modern-left">
            <div class="trust-top-meta">
              <span class="trust-modern-tag">{current().tag}</span>
              <div class="trust-slide-dots">
                <For each={slides()}>
                  {(_, idx) => (
                    <button
                      type="button"
                      class={`trust-dot-btn ${activeIndex() === idx() ? 'active' : ''}`}
                      onClick={() => setActiveIndex(idx())}
                      aria-label={`Slide ${idx() + 1}`}
                    />
                  )}
                </For>
              </div>
            </div>

            <h2>{current().title}</h2>
            <p>{current().desc}</p>

            <div class="trust-modern-stats">
              <For each={current().stats || []}>
                {(st) => (
                  <div class="trust-glass-stat">
                    <strong>{st.value}</strong>
                    <span>{st.label}</span>
                  </div>
                )}
              </For>
            </div>

            <div class="trust-modern-nav">
              <button type="button" class="trust-glass-btn" onClick={prevSlide}>
                ← Sebelumnya
              </button>
              <button type="button" class="trust-glass-btn" onClick={nextSlide}>
                Berikutnya →
              </button>
            </div>
          </div>

          <div class="trust-modern-right">
            <For each={current().photos || []}>
              {(photo) => (
                <div class="trust-glass-photo">
                  <img
                    src={normalizeDriveImageUrl(photo.url)}
                    alt={photo.caption}
                    loading="lazy"
                  />
                  <div class="trust-photo-overlay">
                    <span class="trust-photo-tag">{photo.label}</span>
                    <strong>{photo.caption}</strong>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </section>
  );
}