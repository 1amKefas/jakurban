import { createMemo, Show } from 'solid-js';
import { Icons } from '../components/common/Icons';
import { getStatusColor } from '../utils/formatters';
import { DEFAULT_COVER_IMG } from '../constants/defaultData';
import { formatCompactRupiah, formatPublicLocation, parseSmartRupiahNumber } from '../services/api';
import { t, isEn } from '../utils/i18n';
import {
  DetailHeroCarousel,
  DetailVideoSection,
  DetailMapSection,
  DetailContactCard,
  RichTextContent
} from './PropertyDetail';

export default function UnitDetail(props) {
  const unit = () => props.unit || {};
  const project = () => props.project || {};

  /**
 * Mengambil daftar media (foto/video) milik unit; jika kosong, otomatis memakai media milik project.
 */
  const pickUnitOrProjectMedia = (unitList, projectList, fallback = []) => {
    if (Array.isArray(unitList) && unitList.length > 0) return unitList;
    if (Array.isArray(projectList) && projectList.length > 0) return projectList;
    return fallback;
  };

  const photos = createMemo(() =>
    pickUnitOrProjectMedia(unit().photos, project().photos, [project().img || DEFAULT_COVER_IMG])
  );
  const videos = createMemo(() =>
    pickUnitOrProjectMedia(unit().videos, project().videos, [])
  );

  const publicLocation = () => formatPublicLocation(project().location);
  const displayPrice = () => formatCompactRupiah(unit().rawPrice || unit().price);
  const numericUnitPrice = () => parseSmartRupiahNumber(unit().rawPrice || unit().price);

  const handleAskUnitKpr = () => {
    const prompt = isEn()
      ? `Please calculate the mortgage simulation (30% DP) for unit ${unit().name} at ${project().name || 'this cluster'} priced at ${displayPrice()}`
      : `Tolong hitung simulasi KPR (DP 30%) untuk unit ${unit().name} di ${project().name || 'cluster ini'} dengan harga ${displayPrice()}`;
    if (props.onAskChatbot) {
      props.onAskChatbot(prompt);
    } else {
      props.setView?.('chatbot');
    }
  };

  return (
    <Show when={props.unit}>
      <div class="detail-page-wrapper">
        <div class="container detail-top-bar">
          <button
            type="button"
            class="detail-back-pill"
            onClick={() => (props.onBack ? props.onBack() : props.setView?.('detail'))}
          >
            <Icons.Grid />
            <span>{t('backToProject')} {project().name || 'Project'}</span>
          </button>
        </div>

        <DetailHeroCarousel
          photos={photos()}
          resetKey={`${unit().id || ''}-${unit().name || ''}`}
          title={unit().name}
          thumbAltPrefix={unit().name}
          locationBadge={`${project().name ? `${project().name} — ` : ''}${publicLocation()}`}
        />

        <div class="container detail-main-body">
          <div class="detail-content-layout">
            <div class="detail-left-content">
              <DetailVideoSection
                videos={videos()}
                heading={isEn() ? 'Unit & Cluster Video Tour' : 'Video Tur Unit & Kawasan'}
              />

              <div class="detail-info">
                <div class="unit-status-meta-row">
                  <span class={`badge ${getStatusColor(unit().status)}`}>
                    {unit().status || 'Tersedia'}
                  </span>
                  <Show when={project().name}>
                    <span class="unit-project-label">{project().name}</span>
                  </Show>
                </div>

                <h1>{unit().name}</h1>

                <div class="detail-location-row">
                  <Icons.MapPin />
                  <span>{publicLocation()}</span>
                </div>

                <div class="detail-price">{displayPrice()}</div>

                <div class="specs-grid">
                  <div class="spec-item">
                    <Icons.Bed /> {unit().beds || 0} {t('bedsLabel')}
                  </div>
                  <div class="spec-item">
                    <Icons.Bath /> {unit().baths || 0} {t('bathsLabel')}
                  </div>
                  <div class="spec-item">
                    <Icons.Car /> {unit().carport ?? 1} {t('carportLabel')}
                  </div>
                  <div class="spec-item">
                    <Icons.Land /> {unit().landArea || '-'} {t('landAreaLabel')}
                  </div>
                  <div class="spec-item">
                    <Icons.BuildingArea /> {unit().buildArea || '-'} {t('buildAreaLabel')}
                  </div>
                  <div class="spec-item">
                    <Icons.Electricity /> {unit().electricity || project().electricity || 2200} {t('electricityLabel')}
                  </div>
                </div>

                <h3 class="detail-section-heading">
                  {t('unitDescHeading')}
                </h3>
                <RichTextContent
                  text={unit().description || project().description}
                  fallback={
                    isEn()
                      ? 'Modern residential unit with optimal layout and natural lighting in a strategic location.'
                      : 'Unit hunian modern dengan tata ruang optimal, pencahayaan alami maksimal, serta berada di kawasan strategis.'
                  }
                />

                <DetailMapSection
                  heading={t('mapHeadingUnit')}
                  subtitle={`${unit().name} (${project().name}) — ${publicLocation()}`}
                  queryName={project().name}
                  location={publicLocation()}
                  customEmbedUrl={project().mapEmbedUrl}
                  customMapUrl={project().mapUrl}
                  iframeTitle={unit().name}
                />
              </div>
            </div>

            <DetailContactCard
              accounts={props.accounts}
              kprConfig={{
                unitName: unit().name,
                projectName: project().name,
                initialPrice: numericUnitPrice(),
                isUnitLocked: true
              }}
              description={
                isEn() ? (
                  <>
                    Interested in <strong>{unit().name}</strong> at {project().name}? Contact our official marketing agent for booking info and site visits.
                  </>
                ) : (
                  <>
                    Tertarik dengan <strong>{unit().name}</strong> di {project().name}? Hubungi agen pemasaran resmi kami untuk info booking dan survei lokasi.
                  </>
                )
              }
              waMessage={
                isEn()
                  ? `Hello, I am interested in unit ${unit().name} (${displayPrice()}) at ${project().name || ''}. Is it still available?`
                  : `Halo, saya tertarik dengan unit ${unit().name} (${displayPrice()}) di ${project().name || ''}. Apakah unit ini masih tersedia?`
              }
              aiButtonLabel={t('askKprBtn')}
              onAskAi={handleAskUnitKpr}
            />
          </div>
        </div>
      </div>
    </Show>
  );
}