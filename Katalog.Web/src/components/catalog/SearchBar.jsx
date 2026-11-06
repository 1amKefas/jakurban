import { createSignal } from 'solid-js';
import { Icons } from '../common/Icons';

/* Komponen input pencarian kata kunci properti (lokasi, nama cluster, atau tipe unit). */
export default function SearchBar(props) {
  const [query, setQuery] = createSignal('');

  const handleSearch = () => {
    props.onSearch?.(query().trim());
  };

  return (
    <div class="search-pill-container">
      <input
        type="text"
        class="search-pill-input"
        placeholder="Lokasi, Nama Proyek, Harga ..."
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button type="button" class="search-pill-btn" onClick={handleSearch}>
        <Icons.Search />
        <span>Cari</span>
      </button>
    </div>
  );
}