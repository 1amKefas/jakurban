import { createSignal, Show, For } from 'solid-js'; // Moved For to the top
import logoImg from '../assets/img/jakhome.png';

export default function Navbar(props) {
  const [isLangOpen, setIsLangOpen] = createSignal(false);
  const [currentLang, setCurrentLang] = createSignal('Bahasa Indonesia');

  const languages = ['Bahasa Indonesia', 'English'];

  return (
    <nav class="navbar">
      <div class="nav-container">
        
        {/* Left Side: Brand */}
        <div class="nav-brand" onClick={() => props.setView('catalog')}>
          <img src={logoImg} alt="JakHome Logo" class="nav-logo-img" />
          {/* Added the text back since your brand usually has the name next to logo */}
        </div>

        {/* Right Side: Actions */}
        <div class="nav-actions">

          {/* Dashboard Link - Only visible when logged in */}
          <Show when={props.user}>
            <span 
              class={`nav-link ${props.view === 'dashboard' ? 'active' : ''}`} 
              onClick={() => props.setView('dashboard')}
              style={{ 
                cursor: 'pointer', 
                color: 'white', 
                "margin-right": '20px', 
                "font-size": '19px', 
                "font-weight": '500',
                "transition": 'all 0.3s ease'
              }}
            >
              Dashboard
            </span>
          </Show>
          
          {/* Language Selector */}
          <div class="lang-selector" onClick={() => setIsLangOpen(!isLangOpen())}>
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
                <For each={languages}>
                  {(lang) => (
                    <div 
                      class={`lang-option ${currentLang() === lang ? 'active' : ''}`} 
                      onClick={() => {
                        setCurrentLang(lang);
                        setIsLangOpen(false);
                      }}
                    >
                      {lang}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Dynamic Auth Button */}
          <Show 
            when={!props.user} 
            fallback={
              <button class="btn-signout" onClick={props.onLogout}>
                Sign Out
              </button>
            }
          >
            <button class="btn-signin" onClick={props.onLoginClick}>
              Sign in
            </button>
          </Show>

        </div>
      </div>
    </nav>
  );
}
