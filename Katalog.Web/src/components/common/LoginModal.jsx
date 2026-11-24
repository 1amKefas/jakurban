import { createSignal, createMemo, createEffect, Show } from 'solid-js';
import { Icons } from './Icons';
import logoImg from '../../assets/img/jakhome og.png';
import { t } from '../../utils/i18n';

const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/* Modal autentikasi khusus Administrator & Agent JakUrban. */
export default function LoginModal(props) {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [emailTouched, setEmailTouched] = createSignal(false);
  const [showPassword, setShowPassword] = createSignal(false);

  const registeredEmailSet = createMemo(
    () =>
      new Set(
        (props.registeredEmails || [])
          .map((item) => String(item || '').trim().toLowerCase())
          .filter(Boolean)
      )
  );

  const normalizedEmail = createMemo(() => email().trim().toLowerCase());
  const isEmailFormatValid = createMemo(() => STRICT_EMAIL_REGEX.test(normalizedEmail()));
  const isEmailRegistered = createMemo(
    () => isEmailFormatValid() && registeredEmailSet().has(normalizedEmail())
  );

  // Kolom password & submit hanya terbuka jika email valid DAN terdaftar
  const isPasswordUnlocked = createMemo(() => isEmailRegistered());
  const canSubmit = createMemo(() => isPasswordUnlocked() && password().trim().length > 0);

  const emailErrorMsg = createMemo(() => {
    if (!emailTouched() || !email().trim()) return '';
    if (!isEmailFormatValid()) return t('loginEmailInvalid');
    if (!isEmailRegistered()) return t('loginEmailNotFound');
    return '';
  });

  // Reset form setiap modal ditutup
  createEffect(() => {
    if (!props.isOpen) {
      setEmail('');
      setPassword('');
      setEmailTouched(false);
      setShowPassword(false);
      props.setLoginForm?.('email', '');
      props.setLoginForm?.('password', '');
    }
  });

  const handleEmailInput = (e) => {
    const val = e.currentTarget.value;
    setEmail(val);
    if (!emailTouched() && val.length > 0) setEmailTouched(true);
    props.onClearPasswordError?.();
    props.setLoginForm('email', val);

    const cleanVal = val.trim().toLowerCase();
    const stillRegistered =
      STRICT_EMAIL_REGEX.test(cleanVal) && registeredEmailSet().has(cleanVal);

    // Kunci & bersihkan password kembali jika email diubah menjadi tidak terdaftar
    if (!stillRegistered && password()) {
      setPassword('');
      setShowPassword(false);
      props.setLoginForm('password', '');
    }
  };

  const handlePasswordInput = (e) => {
    if (!isPasswordUnlocked()) return;
    const val = e.currentTarget.value;
    setPassword(val);
    props.onClearPasswordError?.();
    props.setLoginForm('password', val);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit()) return;
    props.onSubmit?.(e);
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div class="modal-content login-modal-card" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            class="close-modal-btn"
            onClick={props.onClose}
            aria-label={t('loginModalClose')}
          >
            <Icons.Close />
          </button>

          <div class="login-modal-header">
            <img src={logoImg} alt="JakHome Logo" class="modal-logo" />
            <h2 class="modal-title">{t('loginTitle')}</h2>
            <p class="modal-subtitle">{t('loginSubtitle')}</p>
          </div>

          <form class="modal-form" onSubmit={handleFormSubmit} novalidate>
            <div class="modal-field">
              <label for="login-email-input">{t('loginEmailLabel')}</label>
              <div
                class={`modal-input-wrap ${
                  emailTouched() && email().trim().length > 0
                    ? isEmailRegistered()
                      ? 'is-valid'
                      : 'is-invalid'
                    : ''
                }`}
              >
                <input
                  id="login-email-input"
                  type="email"
                  autocomplete="username"
                  placeholder={t('loginEmailPlaceholder')}
                  value={email()}
                  onInput={handleEmailInput}
                  onBlur={() => setEmailTouched(true)}
                  required
                />
                <Show when={isEmailRegistered()}>
                  <span class="input-trailing-icon valid" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                </Show>
              </div>
              <Show when={emailErrorMsg()}>
                <span class="field-feedback invalid">{emailErrorMsg()}</span>
              </Show>
            </div>

            <div class={`modal-field ${!isPasswordUnlocked() ? 'is-locked' : ''}`}>
              <label for="login-password-input">{t('loginPasswordLabel')}</label>
              <div
                class={`modal-input-wrap ${
                  !isPasswordUnlocked()
                    ? 'is-disabled'
                    : props.passwordError
                    ? 'is-invalid'
                    : ''
                }`}
              >
                <input
                  id="login-password-input"
                  type={showPassword() ? 'text' : 'password'}
                  autocomplete="current-password"
                  placeholder={
                    isPasswordUnlocked()
                      ? t('loginPasswordPlaceholder')
                      : t('loginPasswordLocked')
                  }
                  value={password()}
                  onInput={handlePasswordInput}
                  disabled={!isPasswordUnlocked()}
                  required
                />
                <Show
                  when={isPasswordUnlocked()}
                  fallback={
                    <span class="input-trailing-icon locked" aria-hidden="true">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </span>
                  }
                >
                  <button
                    type="button"
                    class="input-toggle-pass"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    <Show
                      when={showPassword()}
                      fallback={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      }
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    </Show>
                  </button>
                </Show>
              </div>
              <Show when={props.passwordError}>
                <span class="field-feedback invalid">{props.passwordError}</span>
              </Show>
            </div>

            <button
              type="submit"
              class="btn-submit-login"
              disabled={!canSubmit()}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>{t('loginSubmitBtn')}</span>
            </button>
          </form>

          <p class="login-public-note">{t('loginPublicNote')}</p>
        </div>
      </div>
    </Show>
  );
}