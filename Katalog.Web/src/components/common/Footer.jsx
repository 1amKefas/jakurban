import { For } from 'solid-js';
import { Icons } from './Icons';
import logoImg from '../../assets/img/jakhome.png';

const LINK_SECTIONS = [
  {
    heading: 'Perusahaan',
    links: ['Tentang Kami', 'Hubungi Kami']
  },
  {
    heading: 'Layanan',
    links: ['Kalkulator KPR', 'Panduan Beli Rumah', 'Syarat & Ketentuan', 'Kebijakan Privasi']
  }
];

const SOCIALS = [
  { name: 'Instagram', href: 'https://www.instagram.com/jakurban62/', icon: () => <Icons.Instagram /> },
  { name: 'TikTok', href: 'https://www.tiktok.com/@jakurban62', icon: () => <Icons.TikTok /> },
  { name: 'Facebook', href: 'https://www.facebook.com/jakurban62', icon: () => <Icons.Facebook /> }
];

export default function Footer() {
  return (
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-column">
            <img src={logoImg} alt="JakHome Logo" class="footer-logo" />
            <p class="footer-tagline">
              Partner terpercaya dalam menemukan hunian impian Anda di Jakarta.
              Menghadirkan properti eksklusif dengan transparansi dan kualitas terbaik.
            </p>
            <div class="social-icons">
              <For each={SOCIALS}>
                {(item) => (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="social-icon"
                    aria-label={item.name}
                    title={item.name}
                  >
                    {item.icon()}
                  </a>
                )}
              </For>
            </div>
          </div>

          <For each={LINK_SECTIONS}>
            {(section) => (
              <div class="footer-column">
                <h4 class="footer-heading">{section.heading}</h4>
                <ul class="footer-links">
                  <For each={section.links}>
                    {(link) => <li class="footer-link">{link}</li>}
                  </For>
                </ul>
              </div>
            )}
          </For>

          <div class="footer-column">
            <h4 class="footer-heading">Kontak Kami</h4>
            <div class="contact-info">
              <div class="contact-item">
                <Icons.Phone />
                <span>+62 878 1911 2003</span>
              </div>
              <div class="contact-item">
                <Icons.Mail />
                <span>support@jakhome.com</span>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <div>© 2026 JakHome. All rights reserved.</div>
          <div class="footer-lang-tags">
            <span>ID</span>
            <span>EN</span>
          </div>
        </div>
      </div>
    </footer>
  );
}