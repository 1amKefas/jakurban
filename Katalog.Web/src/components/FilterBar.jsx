import { createSignal, For } from 'solid-js';

export default function FilterBar(props) {
  const [selectedLocation, setSelectedLocation] = createSignal('');
  const [selectedPriceRange, setSelectedPriceRange] = createSignal('Semua');
  const [selectedSort, setSelectedSort] = createSignal('Terbaru');

  const priceOptions = [
    'Semua',
    '< Rp 500jt',
    'Rp 500jt - 1M',
    'Rp 1M - 2M',
    '> Rp 2M'
  ];

  const defaultLocations = [
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

  const triggerFilter = (loc, price, sort) => {
    if (typeof props.onFilter === 'function') {
      props.onFilter({
        location: loc,
        priceRange: price,
        sort: sort
      });
    }
  };

  const handleLocationChange = (e) => {
    const val = e.currentTarget.value;
    setSelectedLocation(val);
    triggerFilter(val, selectedPriceRange(), selectedSort());
  };

  const handlePriceSelect = (price) => {
    setSelectedPriceRange(price);
    triggerFilter(selectedLocation(), price, selectedSort());
  };

  const handleSortChange = (e) => {
    const val = e.currentTarget.value;
    setSelectedSort(val);
    triggerFilter(selectedLocation(), selectedPriceRange(), val);
  };

  // Combine props.locations or fallback to defaultLocations
  const locationList = () => {
    if (props.locations && Array.isArray(props.locations) && props.locations.length > 0) {
      return props.locations;
    }
    return defaultLocations;
  };

  return (
    <div class="filter-bar">
      {/* Location Filter */}
      <div class="filter-group">
        <label class="filter-label" for="filter-location">Lokasi:</label>
        <select
          id="filter-location"
          class="filter-select"
          value={selectedLocation()}
          onInput={handleLocationChange}
        >
          <option value="">Semua Lokasi</option>
          <For each={locationList()}>
            {(loc) => <option value={loc}>{loc}</option>}
          </For>
        </select>
      </div>

      {/* Price Range Filter */}
      <div class="filter-group">
        <span class="filter-label">Rentang Harga:</span>
        <div class="price-chips">
          <For each={priceOptions}>
            {(price) => (
              <button
                type="button"
                class={`price-chip ${selectedPriceRange() === price ? 'active' : ''}`}
                onClick={() => handlePriceSelect(price)}
              >
                {price}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Sort Filter */}
      <div class="filter-group">
        <label class="filter-label" for="filter-sort">Urutkan:</label>
        <select
          id="filter-sort"
          class="filter-select"
          value={selectedSort()}
          onInput={handleSortChange}
        >
          <option value="Terbaru">Terbaru</option>
          <option value="Harga Terendah">Harga Terendah</option>
          <option value="Harga Tertinggi">Harga Tertinggi</option>
        </select>
      </div>
    </div>
  );
}
