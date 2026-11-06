import SearchBar from './SearchBar';

/**
 * Komponen banner utama (Hero Section) pada halaman katalog publik
 * yang memuat judul utama dan bilah pencarian properti.
 */
export default function Hero(props) {
  return (
    <section class="hero">
      <div class="container hero-content">
        <h1>Temukan Rumah<br />Masa Depan Anda</h1>
        <p>Pengalaman pencarian properti berbasis AI untuk hunian paling eksklusif di jantung kota Jakarta.</p>
        <SearchBar onSearch={props.onSearch} />
      </div>
    </section>
  );
}