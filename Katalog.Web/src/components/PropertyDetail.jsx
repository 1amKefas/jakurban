import { createSignal, For, Show } from 'solid-js';
import { Icons } from './Icons';

const CarIcon = () => (
  <svg class="icon" viewBox="0 0 24 24" style={{width:'16px', height:'16px', stroke:'currentColor', fill:'none', "stroke-width":'2'}}><path d="M5 16v-4l2-5h10l2 5v4M3 16h18M7 19v-3M17 19v-3M7 12h10"></path></svg>
);

const LandIcon = () => (
  <svg class="icon" viewBox="0 0 24 24" style={{width:'16px', height:'16px', stroke:'currentColor', fill:'none', "stroke-width":'2'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
);

const ImageIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="1.5"></circle><path d="M21 16l-5-5-9 9"></path></svg>
);

export default function PropertyDetail(props) {
  const { property, setView } = props;
  const [unitView, setUnitView] = createSignal('table');
  let track;

  const units = property.units || [
    { name: 'Tipe A', beds: 1, baths: 1, carport: 1, landArea: 45, price: 'Rp 450jt' },
    { name: 'Tipe B', beds: 2, baths: 1, carport: 1, landArea: 72, price: 'Rp 560jt' },
    { name: 'Tipe C', beds: 2, baths: 2, carport: 1, landArea: 84, price: 'Rp 640jt' },
    { name: 'Tipe D', beds: 3, baths: 2, carport: 2, landArea: 108, price: 'Rp 720jt' },
    { name: 'Tipe E', beds: 3, baths: 2, carport: 2, landArea: 120, price: 'Rp 800jt' },
  ];

  const range = (key) => {
    const values = units.map((u) => u[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${min}` : `${min} - ${max}`;
  };

  return (
    <div class="container">
      {/* Back Button */}
      <div class="detail-back-btn" onClick={() => setView('catalog')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
            <div class="detail-location" style={{ color: '#666', "font-size": '16px', "margin-bottom": '10px', display: 'flex', "align-items": 'center', gap: '6px' }}>
              <svg class="icon" viewBox="0 0 24 24" style={{width:'16px', height:'16px', stroke:'currentColor', fill:'none', "stroke-width":'2'}}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {property.location}
            </div>
            <div class="detail-price">{property.price}</div>
            
            <div class="specs-grid">
              <div class="spec-item"><Icons.Bed /> {range('beds')} Kamar Tidur</div>
              <div class="spec-item"><Icons.Bath /> {range('baths')} Kamar Mandi</div>
              <div class="spec-item"><CarIcon /> {range('carport')} Carport</div>
              <div class="spec-item">
                <svg class="icon" viewBox="0 0 24 24" style={{width:'16px', height:'16px', stroke:'currentColor', fill:'none', "stroke-width":'2'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                {range('landArea')} m² Luas Tanah
              </div>
              <div class="spec-item">
                <svg class="icon" viewBox="0 0 24 24" style={{width:'16px', height:'16px', stroke:'currentColor', fill:'none', "stroke-width":'2'}}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                {property.electricity || 2200} VA Listrik
              </div>
            </div>

            <h3 style={{ color: 'var(--color-primary)', "margin-bottom": '15px', "font-weight": '700' }}>Deskripsi Properti</h3>
            <p class="detail-description">
              {property.description}. Setiap unit dirancang dengan konsep modern kontemporer, 
              memaksimalkan pencahayaan alami dan sirkulasi udara. Terletak di lokasi strategis 
              yang memudahkan akses ke pusat bisnis, sekolah internasional, dan pusat perbelanjaan. 
              Sangat cocok untuk keluarga muda yang menginginkan kenyamanan dan prestise.
            </p>

            <div class="units-section">
              <div class="units-header">
                <div>
                  <h3 style={{ color: 'var(--color-primary)', "font-weight": '700' }}>Pilihan Unit</h3>
                  <p class="units-sub">{units.length} tipe unit tersedia di {property.name}</p>
                </div>
                <div class="units-toggle">
                  <button class="units-seg" classList={{ on: unitView() === 'table' }} aria-pressed={unitView() === 'table'} onClick={() => setUnitView('table')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>
                  </button>
                  <button class="units-seg" classList={{ on: unitView() === 'carousel' }} aria-pressed={unitView() === 'carousel'} onClick={() => setUnitView('carousel')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="5" width="10" height="14" rx="2"></rect><path d="M3 8v8M21 8v8"></path></svg>

                  </button>
                </div>
              </div>

              <Show when={unitView() === 'table'}>
                <div class="units-table-wrap">
                  <table class="units-table">
                    <colgroup>
                      <col style={{ width: '112px' }} />
                      <col />
                      <col style={{ width: '160px' }} />
                      <col style={{ width: '160px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '150px' }} />
                      <col style={{ width: '150px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Foto</th>
                        <th>Unit</th>
                        <th><span class="units-ic"><Icons.Bed /> Kamar Tidur</span></th>
                        <th><span class="units-ic"><Icons.Bath /> Kamar Mandi</span></th>
                        <th><span class="units-ic"><CarIcon /> Carport</span></th>
                        <th>Luas Tanah</th>
                        <th>Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={units}>
                        {(u) => (
                          <tr>
                            <td><div class="units-thumb"><ImageIcon /></div></td>
                            <td class="name">{u.name}</td>
                            <td>{u.beds}</td>
                            <td>{u.baths}</td>
                            <td>{u.carport}</td>
                            <td>{u.landArea} m²</td>
                            <td class="price">{u.price}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>

              <Show when={unitView() === 'carousel'}>
                <div class="units-carousel">
                  <div class="units-track" ref={track}>
                    <For each={units}>
                      {(u) => (
                        <div class="unit-card">
                          <div class="unit-card-img"><ImageIcon /></div>
                          <div class="unit-card-body">
                            <div class="unit-card-head">
                              <span class="unit-card-name">{u.name}</span>
                              <span class="unit-card-price">{u.price}</span>
                            </div>
                            <div class="unit-card-specs">
                              <div><Icons.Bed /> {u.beds} Kamar Tidur</div>
                              <div><Icons.Bath /> {u.baths} Kamar Mandi</div>
                              <div><CarIcon /> {u.carport} Carport</div>
                              <div><LandIcon /> {u.landArea} m² Luas Tanah</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="units-arrows">
                    <button class="units-arrow" aria-label="Sebelumnya" onClick={() => track.scrollBy({ left: -296, behavior: 'smooth' })}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>
                    </button>
                    <button class="units-arrow" aria-label="Berikutnya" onClick={() => track.scrollBy({ left: 296, behavior: 'smooth' })}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky CTA */}
        <aside class="detail-sidebar">
          <div class="contact-card">
            <h3 style={{ color: 'var(--color-primary)', "margin-bottom": '10px' }}>Hubungi Kami</h3>
            <p class="side-desc" style={{ "font-size": '14px', color: '#666', "margin-bottom": '20px' }}>
              Silahkan hubungi agen kami untuk informasi lebih lanjut mengenai {property.name}.
            </p>
            
            <div class="side-tel" style={{ "font-size": '18px', "font-weight": '700', "margin-bottom": '20px', color: '#333' }}>
              +62 878 1911 2003
            </div>

            <a class="btn-wa" href="https://wa.me/6287819112003" aria-label="Hubungi via WhatsApp +62 878 1911 2003" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', "align-items": 'center', gap: '10px', "font-size": '16px', "font-weight": '500', color: '#fff', "background-color": '#25D366', padding: '10px 15px', "border-radius": '8px', "text-decoration": 'none' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg>
              <span>+62 878 1911 2003</span>
            </a>
            
            <div style={{ "margin-top": '15px', "padding-top": '15px', "border-top": '1px solid #eee' }}>
              <button class="btn-outline" style={{ width: '100%', "border-radius": '12px' }} onClick={() => setView('chatbot')}>
                Tanya Jak 
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}