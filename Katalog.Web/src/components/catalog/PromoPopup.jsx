import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { Icons } from '../common/Icons';
import { normalizeDriveImageUrl } from '../../constants/homepageDefault';

const POPUP_SESSION_KEY = 'jakurban_promo_popup_seen';

export default function PromoPopup(props) {
  const [visible, setVisible] = createSignal(false);

  createEffect(() => {
    const cfg = props.config;
    if (!cfg?.enabled || props.isAdmin || props.view !== 'catalog') {
      setVisible(false);
      return;
    }

    if (cfg.showOncePerSession) {
      try {
        if (sessionStorage.getItem(POPUP_SESSION_KEY)) return;
      } catch {
        // Abaikan jika sessionStorage tidak tersedia
      }
    }

    const timer = setTimeout(() => setVisible(true), 600);
    onCleanup(() => clearTimeout(timer));
  });

  const handleClose = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(POPUP_SESSION_KEY, '1');
    } catch {
      // Abaikan
    }
  };

  const handleCta = () => {
    const cfg = props.config;
    handleClose();
    if (cfg?.ctaAction === 'chatbot') {
      props.onOpenChat?.();
    } else if (cfg?.ctaAction === 'link' && cfg?.ctaUrl) {
      window.open(cfg.ctaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Show when={visible() && props.config?.enabled}>
      <div class="modal-overlay" onClick={handleClose}>
        <div class="modal-content promo-popup-card" onClick={(e) => e.stopPropagation()}>
          <button type="button" class="close-modal-btn" onClick={handleClose} aria-label="Tutup">
            <Icons.Close />
          </button>

          <Show when={props.config.imageUrl}>
            <div class="promo-popup-banner">
              <img
                src={normalizeDriveImageUrl(props.config.imageUrl)}
                alt={props.config.title}
              />
            </div>
          </Show>

          <div class="promo-popup-body">
            <Show when={props.config.badge}>
              <span class="showcase-eyebrow">{props.config.badge}</span>
            </Show>
            <h3 class="promo-popup-title">{props.config.title}</h3>
            <p class="promo-popup-desc">{props.config.description}</p>

            <Show when={props.config.ctaLabel}>
              <button type="button" class="btn-submit-login promo-popup-cta" onClick={handleCta}>
                {props.config.ctaLabel}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}