import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
import { Icons } from '../components/common/Icons';
import { DEFAULT_COVER_IMG } from '../constants/defaultData';
import { getStatusColor } from '../utils/formatters';
import { formatPublicLocation } from '../services/api';
import KprSimulator from '../components/catalog/KprSimulator';
import { t, isEn, getActiveAgentContact } from '../utils/i18n';

const parseInlineFormatting = (lineText) => {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<]+)/g;
  const parts = String(lineText || '').split(tokenRegex);

  return parts.map((part) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em>{part.slice(1, -1)}</em>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const href = /^https?:\/\/|^mailto:|^tel:/i.test(linkMatch[2].trim())
        ? linkMatch[2].trim()
        : `https://${linkMatch[2].trim()}`;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" class="rich-text-link">
          {linkMatch[1]}
        </a>
      );
    }
    if (/^https?:\/\/[^\s<]+$/i.test(part)) {
      return (
        <a href={part} target="_blank" rel="noopener noreferrer" class="rich-text-link">
          {part}
        </a>
      );
    }
    return part;
  });
};

export function RichTextContent(props) {
  const blocks = createMemo(() => {
    const raw = String(props.text || props.fallback || '').replace(/\r\n/g, '\n');
    const lines = raw.split('\n');
    const result = [];
    let currentList = null;

    const flushList = () => {
      if (currentList) {
        result.push(currentList);
        currentList = null;
      }
    };

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        flushList();
        result.push({ type: 'spacer' });
        continue;
      }
      const headingMatch = trimmed.match(/^#{1,3}\s+(.*)$/);
      if (headingMatch) {
        flushList();
        result.push({ type: 'heading', content: headingMatch[1] });
        continue;
      }
      const bulletMatch = trimmed.match(/^(?:[•\-*])\s+(.*)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        continue;
      }
      const numMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (numMatch) {
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(numMatch[1]);
        continue;
      }
      flushList();
      result.push({ type: 'paragraph', content: rawLine });
    }

    flushList();
    return result;
  });

  return (
    <div class={`detail-description rich-text-body ${props.class || ''}`}>
      <For each={blocks()}>
        {(block) => {
          if (block.type === 'spacer') return <div class="rich-text-spacer"></div>;
          if (block.type === 'heading') {
            return <h4 class="rich-text-heading">{parseInlineFormatting(block.content)}</h4>;
          }
          if (block.type === 'ul') {
            return (
              <ul class="rich-text-list">
                <For each={block.items}>{(item) => <li>{parseInlineFormatting(item)}</li>}</For>
              </ul>
            );
          }
          if (block.type === 'ol') {
            return (
              <ol class="rich-text-list ordered">
                <For each={block.items}>{(item) => <li>{parseInlineFormatting(item)}</li>}</For>
              </ol>
            );
          }
          return <p class="rich-text-paragraph">{parseInlineFormatting(block.content)}</p>;
        }}
      </For>
    </div>
  );
}

export function DetailHeroCarousel(props) {
  const [activeIdx, setActiveIdx] = createSignal(0);

  const mediaItems = createMemo(() => {
    const photoList = (props.photos || []).map((url) => ({ type: 'photo', url }));
    const videoList = (props.videos || []).map((url) => ({ type: 'video', url }));
    return [...photoList, ...videoList];
  });

  createEffect(() => {
    props.resetKey;
    setActiveIdx(0);
  });

  const currentMedia = () =>
    mediaItems()[activeIdx()] || mediaItems()[0] || { type: 'photo', url: DEFAULT_COVER_IMG };
  const nextMedia = () => setActiveIdx((prev) => (prev + 1) % mediaItems().length);
  const prevMedia = () =>
    setActiveIdx((prev) => (prev - 1 + mediaItems().length) % mediaItems().length);

  return (
    <div class="detail-hero-carousel full-bleed">
      <div class="hero-carousel-stage uncropped">
        <Show
          when={currentMedia().type === 'video'}
          fallback={
            <>
              <div
                class="hero-carousel-ambient-bg"
                style={{ 'background-image': `url("${currentMedia().url}")` }}
              ></div>
              <img
                src={currentMedia().url}
                class="hero-carousel-main-img uncropped"
                alt={`${props.title || ''} - Media ${activeIdx() + 1}`}
              />
            </>
          }
        >
          <video
            src={currentMedia().url}
            class="hero-carousel-main-img uncropped"
            controls
            playsInline
            style={{ background: '#000' }}
          />
        </Show>

        <div class="hero-carousel-top-badges">
          <span class="hero-badge-location">
            <Icons.MapPin />
            <span>{props.locationBadge}</span>
          </span>
          <span class="hero-badge-counter">
            {currentMedia().type === 'video' ? t('videoLabel') : t('photoLabel')} {activeIdx() + 1} {t('ofLabel')} {mediaItems().length}
          </span>
        </div>

        <Show when={mediaItems().length > 1}>
          <div class="hero-carousel-nav-bar">
            <button type="button" class="hero-nav-pill" onClick={prevMedia}>
              {t('prevBtn')}
            </button>
            <button type="button" class="hero-nav-pill" onClick={nextMedia}>
              {t('nextBtn')}
            </button>
          </div>
        </Show>
      </div>

      <Show when={mediaItems().length > 1}>
        <div class="container">
          <div class="hero-carousel-thumbs">
            <For each={mediaItems()}>
              {(item, idx) => (
                <button
                  type="button"
                  class={`hero-thumb-btn ${activeIdx() === idx() ? 'active' : ''}`}
                  onClick={() => setActiveIdx(idx())}
                >
                  <Show
                    when={item.type === 'video'}
                    fallback={
                      <img
                        src={item.url}
                        alt={props.thumbAltPrefix ? `${props.thumbAltPrefix} Thumb ${idx() + 1}` : `Thumb ${idx() + 1}`}
                      />
                    }
                  >
                    <video
                      src={item.url}
                      muted
                      preload="metadata"
                      class="hero-thumb-video"
                    />
                  </Show>
                  <Show when={idx() === 0 && item.type === 'photo'}>
                    <span class="thumb-cover-tag">Cover</span>
                  </Show>
                  <Show when={item.type === 'video'}>
                    <span class="thumb-cover-tag video-tag">
                      ▶ Video
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

export function DetailVideoSection(props) {
  return (
    <Show when={props.videos?.length > 0}>
      <div class="detail-video-section">
        <h4 class="detail-video-heading">
          {props.heading} ({props.videos.length})
        </h4>
        <div class="detail-video-grid">
          <For each={props.videos}>
            {(vidUrl) => <video src={vidUrl} controls class="detail-video-player" />}
          </For>
        </div>
      </div>
    </Show>
  );
}

export function DetailMapSection(props) {
  const mapQuery = () => encodeURIComponent(`${props.queryName || ''} ${props.location || ''}`.trim());
  const mapEmbedUrl = () =>
    props.customEmbedUrl ||
    `https://maps.google.com/maps?q=${mapQuery()}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const mapExternalUrl = () =>
    props.customMapUrl || `https://www.google.com/maps/search/?api=1&query=${mapQuery()}`;

  return (
    <div class="map-section">
      <div class="map-header">
        <div>
          <h3 style={{ color: 'var(--color-primary)', 'font-weight': '700', margin: '0 0 4px 0' }}>
            {props.heading}
          </h3>
          <p class="units-sub">{props.subtitle}</p>
        </div>
        <a
          href={mapExternalUrl()}
          target="_blank"
          rel="noopener noreferrer"
          class="map-open-link"
        >
          {t('openInGmaps')}
        </a>
      </div>
      <div class="map-container">
        <iframe
          title={`Peta Lokasi ${props.iframeTitle || ''}`}
          src={mapEmbedUrl()}
          class="map-iframe"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}

export function DetailContactCard(props) {
  const activeAgent = createMemo(() => getActiveAgentContact(props.accounts));
  const waHref = () =>
    `https://wa.me/${activeAgent().phoneNumber}?text=${encodeURIComponent(props.waMessage || '')}`;

  return (
    <div class="detail-sidebar-placeholder">
      <aside class="detail-sidebar-fixed">
        <div class="contact-card">
          <h3 class="contact-card-title">{t('contactUs')}</h3>

          <Show when={activeAgent().slug}>
            <div class="active-agent-banner">
              <span>{t('activeAgentLabel')}</span>
              <strong>{activeAgent().name}</strong>
            </div>
          </Show>
          <p class="side-desc">{props.description}</p>
          <a
            class="btn-wa"
            href={waHref()}
            aria-label={`WhatsApp ${activeAgent().phoneDisplay}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* SVG WhatsApp tetap sama */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path>
            </svg>
            <span>{activeAgent().phoneDisplay}</span>
          </a>

          <div class="contact-ai-divider">
            <button class="btn-outline contact-ai-btn" onClick={props.onAskAi}>
              {props.aiButtonLabel}
            </button>
          </div>
        </div>
        <Show when={props.kprConfig}>
          <KprSimulator
            projectName={props.kprConfig.projectName}
            unitName={props.kprConfig.unitName}
            units={props.kprConfig.units}
            initialPrice={props.kprConfig.initialPrice}
            defaultDpPercent={30}
            isUnitLocked={props.kprConfig.isUnitLocked}
          />
        </Show>
      </aside>
    </div>
  );
}

export default function PropertyDetail(props) {
  const property = () => props.property || {};
  const [unitView, setUnitView] = createSignal('table');
  let track;

  const photos = createMemo(() => {
    const p = property();
    return Array.isArray(p.photos) && p.photos.length > 0
      ? p.photos
      : [p.img || DEFAULT_COVER_IMG];
  });

  const videos = createMemo(() => (Array.isArray(property().videos) ? property().videos : []));
  const units = createMemo(() => (Array.isArray(property().units) ? property().units : []));

  const range = (key, fallbackVal = '-') => {
    const list = units();
    if (!list.length) return property()[key] || fallbackVal;
    const values = list.map((u) => Number(u[key])).filter((v) => !Number.isNaN(v) && v > 0);
    if (!values.length) return property()[key] || fallbackVal;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${min}` : `${min} - ${max}`;
  };

  const handleSelectUnit = (unit) => {
    if (props.onSelectUnit) {
      props.onSelectUnit(unit);
    } else {
      props.setSelectedUnit?.(unit);
      props.setView?.('unit-detail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const publicLocation = () => formatPublicLocation(property().location);

  return (
    <div class="detail-page-wrapper">
      <div class="container detail-top-bar">
        <button type="button" class="detail-back-pill" onClick={() => props.setView('catalog')}>
          <Icons.Grid />
          <span>{t('backToCatalog')}</span>
        </button>
      </div>

      <DetailHeroCarousel
        photos={photos()}
        videos={videos()}
        resetKey={property().id}
        title={property().name}
        locationBadge={publicLocation()}
      />

      <div class="container detail-main-body">
        <div class="detail-content-layout">
          <div class="detail-left-content">
            <div class="detail-info">
              <h1>{property().name}</h1>
              <div class="detail-location-row">
                <Icons.MapPin />
                <span>{publicLocation()}</span>
              </div>
              <div class="detail-price">{property().priceRange || property().price}</div>

              <div class="specs-grid">
                <div class="spec-item"><Icons.Bed /> {property().bedsRange || range('beds', 2)} {t('bedsLabel')}</div>
                <div class="spec-item"><Icons.Bath /> {property().bathsRange || range('baths', 1)} {t('bathsLabel')}</div>
                <div class="spec-item"><Icons.Car /> {property().carportRange || range('carport', 1)} {t('carportLabel')}</div>
                <div class="spec-item"><Icons.Land /> {property().landAreaRange || range('landArea', 90)} {t('landAreaLabel')}</div>
                <div class="spec-item"><Icons.Electricity /> {property().electricity || 2200} {t('electricityLabel')}</div>
              </div>

              <h3 class="detail-section-heading">
                {t('propDescHeading')}
              </h3>
              <RichTextContent
                text={property().description}
                fallback={
                  isEn()
                    ? 'Exclusive residential cluster in a strategic Jakarta location with integrated facilities.'
                    : 'Hunian eksklusif dengan lokasi strategis dan fasilitas kawasan terpadu.'
                }
              />

              <div class="units-section">
                <div class="units-header">
                  <div>
                    <h3 class="detail-section-heading">
                      {t('unitChoicesHeading')}
                    </h3>
                    <p class="units-sub">
                      {units().length} {t('unitChoicesSub')} {property().name} — {t('unitChoicesClickHint')}
                    </p>
                  </div>
                  <div class="units-toggle">
                    <button
                      type="button"
                      class="units-seg icon-only"
                      classList={{ on: unitView() === 'table' }}
                      onClick={() => setUnitView('table')}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="9" x2="9" y2="21"></line>
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="units-seg icon-only"
                      classList={{ on: unitView() === 'carousel' }}
                      onClick={() => setUnitView('carousel')}
                    >
                      <Icons.Grid />
                    </button>
                  </div>
                </div>

                <Show when={units().length > 0}>
                  <Show when={unitView() === 'table'}>
                    <div class="units-table-wrap">
                      <table class="units-table">
                        <thead>
                          <tr>
                            <th>{t('tablePhoto')}</th>
                            <th>{t('tableUnit')}</th>
                            <th><span class="units-ic"><Icons.Bed /> {t('bedsLabel')}</span></th>
                            <th><span class="units-ic"><Icons.Bath /> {t('bathsLabel')}</span></th>
                            <th><span class="units-ic"><Icons.Car /> {t('carportLabel')}</span></th>
                            <th>{t('tableLand')}</th>
                            <th>{t('tableStatus')}</th>
                            <th>{t('tablePrice')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={units()}>
                            {(u) => {
                              const unitThumb = () => u.photos?.[0] || photos()[0];
                              return (
                                <tr
                                  class="clickable-unit-row"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleSelectUnit(u)}
                                >
                                  <td>
                                    <div class="units-thumb">
                                      <Show when={unitThumb()} fallback={<Icons.Image />}>
                                        <img
                                          src={unitThumb()}
                                          alt={u.name}
                                          class="units-thumb-img"
                                        />
                                      </Show>
                                    </div>
                                  </td>
                                  <td class="name">{u.name}</td>
                                  <td>{u.beds}</td>
                                  <td>{u.baths}</td>
                                  <td>{u.carport ?? 1}</td>
                                  <td>{u.landArea} m²</td>
                                  <td>
                                    <span class={`badge ${getStatusColor(u.status)}`}>
                                      {u.status || 'Tersedia'}
                                    </span>
                                  </td>
                                  <td class="price">{u.price}</td>
                                </tr>
                              );
                            }}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>

                  <Show when={unitView() === 'carousel'}>
                    <div class="units-carousel">
                      <div class="units-track" ref={track}>
                        <For each={units()}>
                          {(u) => {
                            const unitThumb = () => u.photos?.[0] || photos()[0];
                            return (
                              <div
                                class="unit-card clickable-unit-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => handleSelectUnit(u)}
                              >
                                <div class="unit-card-img">
                                  <Show when={unitThumb()} fallback={<Icons.Image />}>
                                    <img
                                      src={unitThumb()}
                                      alt={u.name}
                                      style={{ width: '100%', height: '100%', 'object-fit': 'cover' }}
                                    />
                                  </Show>
                                </div>
                                <div class="unit-card-body">
                                  <div class="unit-card-head">
                                    <span class="unit-card-name">{u.name}</span>
                                    <span class="unit-card-price">{u.price}</span>
                                  </div>
                                  <div class="unit-card-specs">
                                    <div><Icons.Bed /> {u.beds} {t('bedsLabel')}</div>
                                    <div><Icons.Bath /> {u.baths} {t('bathsLabel')}</div>
                                    <div><Icons.Car /> {u.carport ?? 1} {t('carportLabel')}</div>
                                    <div><Icons.Land /> {u.landArea} {t('landAreaLabel')}</div>
                                  </div>
                                  <span class="unit-card-cta">{t('viewUnitDetail')}</span>
                                </div>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </Show>
                </Show>
              </div>

              <DetailMapSection
                heading={t('mapHeadingProp')}
                subtitle={`${property().name} — ${publicLocation()}`}
                queryName={property().name}
                location={publicLocation()}
                customEmbedUrl={property().mapEmbedUrl}
                customMapUrl={property().mapUrl}
                iframeTitle={property().name}
              />
            </div>
          </div>

          <DetailContactCard
            accounts={props.accounts}
            kprConfig={{
              projectName: property().name,
              units: units(),
              initialPrice: units()[0]?.rawPrice || property().priceNum || 900000000,
              isUnitLocked: false
            }}
            description={
              isEn()
                ? `Contact our official marketing agent for unit availability and site visit schedules at ${property().name}.`
                : `Silakan hubungi agen pemasaran resmi kami untuk informasi ketersediaan dan jadwal kunjungan lokasi ${property().name}.`
            }
            waMessage={
              isEn()
                ? `Hello, I am interested in ${property().name} (${publicLocation()}). Could you share the details?`
                : `Halo, saya tertarik dengan project ${property().name} di ${publicLocation()}. Boleh minta info detailnya?`
            }
            aiButtonLabel={t('askJakBtn')}
            onAskAi={() => {
              const prompt = isEn()
                ? `Please show me available units and mortgage simulation (30% DP) at ${property().name} (${publicLocation()})`
                : `Saya ingin tahu detail unit yang tersedia beserta simulasi KPR (DP 30%) di ${property().name} (${publicLocation()})`;
              if (props.onAskChatbot) {
                props.onAskChatbot(prompt);
              } else {
                props.setView('chatbot');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}