import { Icons } from '../common/Icons';
import { DEFAULT_COVER_IMG } from '../../constants/defaultData';
import { formatPublicLocation } from '../../services/api';

/**
 * Kartu ringkasan proyek/cluster pada grid katalog utama.
 * Menampilkan foto sampul, jumlah tipe unit, lokasi kecamatan, kisaran harga, dan rentang spesifikasi.
 */
export default function PropertyCard(props) {
  const p = () => props.property || {};
  const coverImg = () => p().photos?.[0] || p().img || DEFAULT_COVER_IMG;
  const unitCount = () => (p().units || []).length;

  const specItems = () => [
    { title: 'Rentang Kamar Tidur', Icon: Icons.Bed, value: p().bedsRange || p().beds || '-' },
    { title: 'Rentang Kamar Mandi', Icon: Icons.Bath, value: p().bathsRange || p().baths || '-' },
    { title: 'Rentang Carport', Icon: Icons.Car, value: p().carportRange || p().carport || 1 }
  ];

  return (
    <div class="property-card" onClick={props.onCardClick}>
      <div class="card-img-container">
        <img src={coverImg()} alt={p().name} />
        <span class="card-unit-badge">
          {unitCount() > 0 ? `${unitCount()} Tipe Unit` : p().status || 'Tersedia'}
        </span>
      </div>

      <div class="card-info">
        <div class="card-location-tag">
          <Icons.MapPin />
          <span>{formatPublicLocation(p().location)}</span>
        </div>
        <h3>{p().name}</h3>
        <span class="card-price">{p().priceRange || p().price}</span>

        <div class="card-specs-range">
          {specItems().map((spec) => (
            <span class="card-spec-pill" title={spec.title}>
              <spec.Icon /> {spec.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}