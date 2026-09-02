import { Icons } from './Icons';
import logoImg from '../assets/img/jakhome.png';

export default function Footer() {
  const companyLinks = ['Tentang Kami', 'Karir', 'Blog', 'Hubungi Kami'];
  const serviceLinks = ['Kalkulator KPR', 'Panduan Beli Rumah', 'Syarat & Ketentuan', 'Kebijakan Privasi'];

  return (
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          
          {/* Column 1: Brand & Tagline */}
          <div class="footer-column">
            <img src={logoImg} alt="JakHome Logo" class="footer-logo" />
            <p class="footer-tagline">
              Partner terpercaya dalam menemukan hunian impian Anda di Jakarta. 
              Menghadirkan properti eksklusif dengan transparansi dan kualitas terbaik.
            </p>
            <div class="social-icons">
              <div class="social-icon">Fb</div>
              <div class="social-icon">Ig</div>
              <div class="social-icon">Li</div>
            </div>
          </div>

          {/* Column 2: Company */}
          <div class="footer-column">
            <h4 class="footer-heading">Perusahaan</h4>
            <ul class="footer-links">
              {companyLinks.map(link => (
                <li class="footer-link">{link}</li>
              ))}
            </ul>
          </div>

          {/* Column 3: Services */}
          <div class="footer-column">
            <h4 class="footer-heading">Layanan</h4>
            <ul class="footer-links">
              {serviceLinks.map(link => (
                <li class="footer-link">{link}</li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact & Trust */}
          <div class="footer-column">
            <h4 class="footer-heading">Kontak Kami</h4>
            <div class="contact-info">
              <div class="contact-item">
                <Icons.Home />
                <span>Menara JakUrban, Lantai 15, Jl. Sudirman, Jakarta Pusat</span>
              </div>
              <div class="contact-item">
                <svg class="icon" style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3.8 la 2 2 0 0 1 1.5 1.1L12 11.5l4.5-4.5a2 2 0 0 1 3.5 0L22 7v9.92z"></path></svg>
                <span>+62 21 1234 5678</span>
              </div>
              <div class="contact-item">
                <svg class="icon" style={{width:'16px', height:'16px'}} viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <span>support@jakhome.com</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div class="footer-bottom">
          <div>© 2026 JakHome. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span>ID</span>
            <span>EN</span>
          </div>
        </div>
      </div>
    </footer>
  );
}


