import { createSignal, Show, For } from 'solid-js';
import logoImg from '../../assets/img/jakhome.png';
import { getLang, setLangAndRefresh, t } from '../../utils/i18n';

const LANGUAGES = [
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'en', label: 'English' }
];

export default function Navbar(props) {
  const [isLangOpen, setIsLangOpen] = createSignal(false);

  return (
    <nav class="navbar">
      <div class="nav-container">
        <div class="nav-brand" onClick={() => props.setView('catalog')}>
          <img src={logoImg} alt="JakHome Logo" class="nav-logo-img" />
        </div>

        <div class="nav-actions">
          <Show when={props.user}>
            <span
              class={`nav-link ${props.view === 'dashboard' ? 'active' : ''}`}
              onClick={() => props.setView('dashboard')}
            >
                {t('navDashboard')}
            </span>
          </Show>

          <div class="lang-selector" onClick={() => setIsLangOpen((prev) => !prev)}>
            <svg class="lang-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>

            <svg class={`lang-arrow ${isLangOpen() ? 'open' : ''}`} viewBox="0 0 24 24">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>

            <Show when={isLangOpen()}>
              <div class="lang-dropdown">
                <For each={LANGUAGES}>
                  {(lang) => (
                    <div
                      class={`lang-option ${getLang() === lang.code ? 'active' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsLangOpen(false);
                        setLangAndRefresh(lang.code);
                      }}
                    >
                      {lang.label}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <Show
            when={!props.user}
            fallback={
              <button class="btn-signout" onClick={props.onLogout}>
                {t('navSignOut')}
              </button>
            }
          >
            <button class="btn-signin" onClick={props.onLoginClick}>
              {t('navSignIn')}
            </button>
          </Show>
        </div>
      </div>
    </nav>
  );
}