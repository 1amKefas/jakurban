import { createMemo, For } from 'solid-js';
import { DEFAULT_HOMEPAGE_CONFIG } from '../../constants/homepageDefault';

export default function ModernShowcaseSection(props) {
  const showcase = createMemo(() => ({
    ...DEFAULT_HOMEPAGE_CONFIG.showcase,
    ...(props.showcase || {}),
    cards:
      Array.isArray(props.showcase?.cards) && props.showcase.cards.length > 0
        ? props.showcase.cards
        : DEFAULT_HOMEPAGE_CONFIG.showcase.cards
  }));

  return (
    <section class="modern-showcase-section">
      <div class="container">
        <div class="modern-showcase-header">
          <span class="showcase-eyebrow">{showcase().eyebrow}</span>
          <h2>{showcase().title}</h2>
          <p>{showcase().subtitle}</p>
        </div>

        <div class="modern-bento-grid">
          <For each={showcase().cards}>
            {(item) => (
              <div class="modern-glass-card">
                <div class="modern-card-top">
                  <span class="modern-card-tag">{item.tag}</span>
                  <span class="modern-card-pill">{item.stat}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}