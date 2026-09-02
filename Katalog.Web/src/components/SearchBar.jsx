import { Icons } from './Icons';

export default function SearchBar() {
  const handleSearch = () => {
    console.log("Searching for properties...");
    // Future: add search logic here
  };

  return (
    <div class="search-pill-container">
      <input 
        type="text" 
        class="search-pill-input" 
        placeholder="Lokasi, Nama Proyek ..." 
      />
      <button class="search-pill-btn" onClick={handleSearch}>
        <Icons.Search /> 
        <span>Cari</span>
      </button>
    </div>
  );
}
