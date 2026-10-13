import { createSignal } from 'solid-js';
import { Icons } from './Icons';

export default function SearchBar(props) {
  const [query, setQuery] = createSignal('');

  const handleSearch = () => {
    const text = query().trim();
    if (props.onSearch) {
      props.onSearch(text);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div class="search-pill-container">
      <input 
        type="text" 
        class="search-pill-input" 
        placeholder="Lokasi, Nama Proyek, Harga ..." 
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      <button class="search-pill-btn" onClick={handleSearch}>
        <Icons.Search /> 
        <span>Cari</span>
      </button>
    </div>
  );
}
