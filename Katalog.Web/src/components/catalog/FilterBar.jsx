import { createSignal, For } from 'solid-js';

const PRICE_OPTIONS = [
  'Semua',
  '< Rp 500jt',
  'Rp 500jt - 1M',
  'Rp 1M - 2M',
  '> Rp 2M'
];

const DEFAULT_LOCATIONS = [
  'Jakarta Selatan',
  'Jakarta Barat',
  'Jakarta Utara',
  'Jakarta Timur',
  'Jakarta Pusat',
  'Tangerang',
  'Bekasi',
  'Depok',
  'Bogor'
];

const SORT_OPTIONS = ['Terbaru', 'Harga Terendah', 'Harga Tertinggi'];

/**
 * Bilah filter katalog untuk menyaring properti berdasarkan lokasi, rentang harga, dan urutan harga.
 */
export default function FilterBar(props) {
  const [selectedLocation, setSelectedLocation] = createSignal('');
  const [selectedPriceRange, setSelectedPriceRange] = createSignal('Semua');
  const [selectedSort, setSelectedSort] = createSignal('Terbaru');

  /** Memperbarui state filter tertentu sekaligus mengirimkan seluruh state terbaru ke komponen induk. */
  const applyFilterChange = (setter, value) => {
    setter(value);
    props.onFilter?.({
      location: selectedLocation(),
      priceRange: selectedPriceRange(),
      sort: selectedSort()
    });
  };

  const locationList = () =>
    Array.isArray(props.locations) && props.locations.length > 0
      ? props.locations
      : DEFAULT_LOCATIONS;

  return (
    <div class="filter-bar">
      <div class="filter-group">
        <label class="filter-label" for="filter-location">Lokasi:</label>
        <select
          id="filter-location"
          class="filter-select"
          value={selectedLocation()}
          onInput={(e) => applyFilterChange(setSelectedLocation, e.currentTarget.value)}
        >
          <option value="">Semua Lokasi</option>
          <For each={locationList()}>
            {(loc) => <option value={loc}>{loc}</option>}
          </For>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Rentang Harga:</span>
        <div class="price-chips">
          <For each={PRICE_OPTIONS}>
            {(price) => (
              <button
                type="button"
                class={`price-chip ${selectedPriceRange() === price ? 'active' : ''}`}
                onClick={() => applyFilterChange(setSelectedPriceRange, price)}
              >
                {price}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-label" for="filter-sort">Urutkan:</label>
        <select
          id="filter-sort"
          class="filter-select"
          value={selectedSort()}
          onInput={(e) => applyFilterChange(setSelectedSort, e.currentTarget.value)}
        >
          <For each={SORT_OPTIONS}>
            {(opt) => <option value={opt}>{opt}</option>}
          </For>
        </select>
      </div>
    </div>
  );
}