import { Icons } from './Icons';

export default function PropertyDetail(props) {
  const { property, setView } = props;

  return (
    <div class="container">
      {/* Back Button */}
      <div class="detail-back-btn" onClick={() => setView('catalog')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Kembali ke Katalog</span>
      </div>

      <div class="detail-container">
        {/* LEFT COLUMN: Media and Info */}
        <div class="detail-main">
          <div class="detail-gallery">
            <img src={property.img} class="main-img" alt="Main View" />
            <div class="thumb-grid">
              <img src={property.img} class="thumb-img" alt="View 1" />
              <img src={property.img} class="thumb-img" alt="View 2" />
            </div>
          </div>

          <div class="detail-info">
            <h1>{property.name}</h1>
            <div class="detail-price">{property.price}</div>
            
            <div class="specs-grid">
              <div class="spec-item"><Icons.Bed /> {property.beds} Kamar Tidur</div>
              <div class="spec-item"><Icons.Bath /> {property.baths} Kamar Mandi</div>
              <div class="spec-item">
                <svg class="icon" viewBox="0 0 24 24" style={{width:'16px', height:'16px', stroke:'currentColor', fill:'none', strokeWidth:'2'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                120 m² Luas Tanah
              </div>
              <div class="spec-item">
                <svg class="icon" viewBox="0 0 24 24" style={{width:'16px', height:'16px', stroke:'currentColor', fill:'none', strokeWidth:'2'}}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                2200 VA Listrik
              </div>
            </div>

            <h3 style={{ color: 'var(--color-primary)', marginBottom: '15px', fontWeight: '700' }}>Deskripsi Properti</h3>
            <p class="detail-description">
              {property.description}. Unit ini dirancang dengan konsep modern kontemporer, 
              memaksimalkan pencahayaan alami dan sirkulasi udara. Terletak di lokasi strategis 
              yang memudahkan akses ke pusat bisnis, sekolah internasional, dan pusat perbelanjaan. 
              Sangat cocok untuk keluarga muda yang menginginkan kenyamanan dan prestise.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky CTA */}
        <aside class="detail-sidebar">
          <div class="contact-card">
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '10px' }}>Hubungi Kami</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
              Silahkan hubungi agen kami untuk informasi lebih lanjut.
            </p>
            
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: '#333' }}>
              +62 812 3456 7890
            </div>

            <button class="btn-visit">Atur Kunjungan</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
