export default function PropertyCard(props) {
  const { property, onCardClick } = props;

  return (
    <div class="property-card" onClick={onCardClick}>
      {/* Image Section */}
      <div class="card-img-container">
        <img src={property.img} alt={property.name} />
      </div>

      {/* Content Section */}
      <div class="card-info">
        <h3>{property.name}</h3>
        <span class="card-price">{property.price}</span>
        <p class="card-desc">{property.description}</p>
      </div>
    </div>
  );
}
