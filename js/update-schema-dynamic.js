// Script para actualizar dinámicamente el schema JSON-LD con reseñas en tiempo real
(function() {
  // Detectar idioma de la página
  const htmlLang = document.documentElement.lang || 'es';
  const langMap = {
    'es-ES': 'es',
    'es': 'es',
    'en-GB': 'en',
    'en': 'en',
    'de-DE': 'de',
    'de': 'de',
    'fr-FR': 'fr',
    'fr': 'fr'
  };
  const lang = langMap[htmlLang] || 'es';

  // Función para obtener reseñas de la API de Netlify
  async function fetchReviews() {
    try {
      const response = await fetch(`/.netlify/functions/google-reviews?lang=${lang}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return null;
    }
  }

  // Función para actualizar el schema JSON-LD
  function updateSchema(reviewsData) {
    if (!reviewsData || !reviewsData.totalReviews) return;

    const totalReviews = reviewsData.totalReviews;
    const averageRating = Math.round(reviewsData.averageRating * 10) / 10;

    // Buscar todos los scripts de tipo application/ld+json
    const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');

    schemaScripts.forEach(script => {
      try {
        const schema = JSON.parse(script.textContent);

        // Buscar aggregateRating en el schema
        if (schema.aggregateRating) {
          schema.aggregateRating.ratingValue = averageRating;
          schema.aggregateRating.ratingCount = totalReviews;
          schema.aggregateRating.reviewCount = totalReviews;
          
          // Actualizar el script
          script.textContent = JSON.stringify(schema, null, 2);
          console.log(`Schema updated: ${totalReviews} reviews, ${averageRating} rating`);
        }

        // Buscar en @graph si existe
        if (schema['@graph']) {
          schema['@graph'].forEach(item => {
            if (item.aggregateRating) {
              item.aggregateRating.ratingValue = averageRating;
              item.aggregateRating.ratingCount = totalReviews;
              item.aggregateRating.reviewCount = totalReviews;
            }
          });
          script.textContent = JSON.stringify(schema, null, 2);
        }
      } catch (error) {
        console.error('Error parsing schema:', error);
      }
    });
  }

  // Ejecutar cuando la página cargue
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      const reviewsData = await fetchReviews();
      updateSchema(reviewsData);
    });
  } else {
    // Si ya cargó, ejecutar inmediatamente
    fetchReviews().then(updateSchema);
  }
})();
