import { Show } from 'solid-js';
import logoImg from '../assets/img/jakhome og.png'; // Adjust the path as necessary

export default function LoginModal(props) {
  return (
    <Show when={props.isOpen}>
      {/* The Overlay: Clicking this closes the modal */}
      <div class="modal-overlay" onClick={props.onClose}>
        
        {/* The Content: e.stopPropagation prevents closing when clicking inside */}
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          
          {/* "X" Close Button */}
          <button class="close-modal-btn" onClick={props.onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* Centered Logo */}
          <img src={logoImg} alt="JakHome Logo" class="modal-logo" />

          <h2 class="modal-title">Akses Administrator</h2>
          
          {/* Admin Reminder in Bahasa Indonesia */}
          <div class="admin-reminder">
            Form ini hanya ditujukan bagi administrator sistem JakHome.
          </div>

          <form class="modal-form" onSubmit={props.onSubmit}>
            <div class="modal-field">
              <label>Email</label>
              <input 
                type="email" 
                placeholder="admin@jakhome.com" 
                onInput={(e) => props.setLoginForm('email', e.currentTarget.value)} 
                required 
              />
            </div>
            <div class="modal-field">
              <label>Kata Sandi</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                onInput={(e) => props.setLoginForm('password', e.currentTarget.value)} 
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
