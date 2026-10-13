import { Icons } from './Icons';
import SearchBar from './SearchBar';

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
