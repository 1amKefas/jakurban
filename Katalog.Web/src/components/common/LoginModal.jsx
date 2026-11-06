import { Show } from 'solid-js';
import { Icons } from './Icons';
import logoImg from '../../assets/img/jakhome og.png';

/* Modal autentikasi khusus Administrator & Agent JakUrban. */
export default function LoginModal(props) {
  const handleFieldInput = (field) => (e) => {
    props.setLoginForm(field, e.currentTarget.value);
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <button type="button" class="close-modal-btn" onClick={props.onClose} aria-label="Tutup">
            <Icons.Close />
          </button>

          <img src={logoImg} alt="JakHome Logo" class="modal-logo" />
          <h2 class="modal-title">Akses Administrator</h2>

          <div class="admin-reminder">
            Form ini hanya ditujukan bagi administrator sistem JakHome.
          </div>

          <form class="modal-form" onSubmit={props.onSubmit}>
            <div class="modal-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="admin@jakhome.com"
                onInput={handleFieldInput('email')}
                required
              />
            </div>
            <div class="modal-field">
              <label>Kata Sandi</label>
              <input
                type="password"
                placeholder="••••••••"
                onInput={handleFieldInput('password')}
                required
              />
            </div>
            <button type="submit" class="btn-submit-login">Masuk</button>
          </form>
        </div>
      </div>
    </Show>
  );
}