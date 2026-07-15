// Google Reviews Widget - Filtra reseñas de 4 y 5 estrellas - Multiidioma - Carrusel

const translations = {
  es: {
    google: 'Google',
    seeAll: 'Ver todas en Google',
    reviews: 'reseñas',
    writeReview: 'Escribir reseña en Google',
    readReviews: 'Leer más reseñas',
    anonymous: 'Anónimo',
    error: 'No se pudieron cargar las reseñas.',
    seeGoogle: 'Ver en Google',
    reviewsTitle: 'Lo que dicen nuestros clientes'
  },
  en: {
    google: 'Google',
    seeAll: 'See all on Google',
    reviews: 'reviews',
    writeReview: 'Write review on Google',
    readReviews: 'Read more reviews',
    anonymous: 'Anonymous',
    error: 'Could not load reviews.',
    seeGoogle: 'View on Google',
    reviewsTitle: 'What our customers say'
  },
  de: {
    google: 'Google',
    seeAll: 'Alle auf Google ansehen',
    reviews: 'Bewertungen',
    writeReview: 'Bewertung auf Google schreiben',
    readReviews: 'Mehr Bewertungen lesen',
    anonymous: 'Anonym',
    error: 'Bewertungen konnten nicht geladen werden.',
    seeGoogle: 'Auf Google ansehen',
    reviewsTitle: 'Was unsere Kunden sagen'
  },
  fr: {
    google: 'Google',
    seeAll: 'Voir toutes sur Google',
    reviews: 'avis',
    writeReview: 'Écrire un avis sur Google',
    readReviews: 'Lire plus d\'avis',
    anonymous: 'Anonyme',
    error: 'Impossible de charger les avis.',
    seeGoogle: 'Voir sur Google',
    reviewsTitle: 'Ce que disent nos clients'
  }
};

class GoogleReviewsWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('[Google Reviews] Container not found with ID:', containerId);
      return;
    }
    this.options = {
      maxReviews: options.maxReviews || Infinity,
      showRating: options.showRating !== false,
      showDate: options.showDate !== false,
      showGoogleLink: options.showGoogleLink !== false,
      googleBusinessUrl: options.googleBusinessUrl || 'https://maps.app.goo.gl/5kocLkscg2NXErMk9',
      writeReviewUrl: options.writeReviewUrl || options.googleBusinessUrl || 'https://maps.app.goo.gl/5kocLkscg2NXErMk9',
      language: options.language || this.detectLanguage(),
      autoRotate: options.autoRotate !== false,
      rotateInterval: options.rotateInterval || 5000,
      ...options
    };
    this.translations = translations[this.options.language] || translations.es;
    this.currentIndex = 0;
    this.rotationInterval = null;
    this.lastManualInteraction = 0;
    this.manualInteractionDelay = 5000; // 5 segundos
    this.init();
  }

  detectLanguage() {
    const path = window.location.pathname;
    if (path.includes('/en') || path.includes('-en.')) {
      return 'en';
    }
    if (path.includes('/de') || path.includes('-de.')) {
      return 'de';
    }
    if (path.includes('/fr') || path.includes('-fr.')) {
      return 'fr';
    }
    return 'es';
  }

  async init() {
    if (!this.container) {
      return;
    }

    try {
      const data = await this.fetchReviews();
      this.render(data);
      this.startRotation();
    } catch (error) {
      console.error('[Google Reviews] Error fetching reviews:', error);
      this.renderError();
    }
  }

  async fetchReviews() {
    const timestamp = new Date().getTime();
    const url = `/api/google-reviews?lang=${this.options.language}&_=${timestamp}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch reviews');
    }
    const data = await response.json();
    return data;
  }

  render(data) {
    const { reviews, totalReviews, averageRating } = data;
    const t = this.translations;
    this.reviews = reviews;

    // Crear HTML
    let html = `
      <div class="google-reviews-widget">
        <div class="google-reviews-header">
          <div class="google-reviews-rating">
            <div class="google-logo">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div class="rating-stars">
              ${this.renderStars(averageRating)}
              <span class="rating-number">${averageRating.toFixed(1)}</span>
            </div>
            <div class="review-count">${totalReviews} ${t.reviews}</div>
          </div>
          ${this.options.showGoogleLink ? `
            <a href="${this.options.googleBusinessUrl}" target="_blank" rel="noopener" class="google-reviews-link">
              ${t.readReviews || t.writeReview}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ` : ''}
        </div>
        <div class="google-reviews-carousel">
          <button class="carousel-arrow carousel-arrow-left" aria-label="Anterior">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div class="google-reviews-track">
    `;

    // Renderizar reseñas en carrusel
    const reviewsToShow = this.reviews.slice(0, this.options.maxReviews);
    
    reviewsToShow.forEach((review, index) => {
      const isActive = index === 0 ? 'active' : '';
      const isNext = index === 1 ? 'next' : '';
      const isPrev = index === reviewsToShow.length - 1 ? 'prev' : '';
      const profilePhotoUrl = review.reviewer?.profilePhotoUrl;
      const displayName = review.reviewer?.displayName || t.anonymous;
      const initial = displayName.charAt(0).toUpperCase();
      
      html += `
        <div class="google-review-card carousel-item ${isActive} ${isNext} ${isPrev}" data-index="${index}">
          <div class="review-header">
            <div class="review-author">
              <div class="author-avatar ${profilePhotoUrl ? 'author-avatar-with-photo' : ''}">
                ${profilePhotoUrl 
                  ? `<img src="${profilePhotoUrl}" alt="${displayName}" class="author-avatar-img" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.remove('author-avatar-with-photo'); this.parentElement.textContent='${initial}';">`
                  : initial}
              </div>
              <div class="author-info">
                <div class="author-name">${displayName}</div>
                <div class="review-stars">${this.renderStars(review.starRating)}</div>
              </div>
            </div>
            ${this.options.showDate ? `<div class="review-date">${this.formatDate(review.createTime)}</div>` : ''}
          </div>
          <div class="review-body">${review.comment || ''}</div>
        </div>
      `;
    });

    html += `
          </div>
          <button class="carousel-arrow carousel-arrow-right" aria-label="Siguiente">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
        <div class="carousel-dots">
    `;

    // Renderizar dots
    reviewsToShow.forEach((_, index) => {
      const isActive = index === 0 ? 'active' : '';
      html += `<button class="carousel-dot ${isActive}" data-index="${index}" aria-label="Reseña ${index + 1}"></button>`;
    });

    html += `
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  attachEventListeners() {
    const prevBtn = this.container.querySelector('.carousel-arrow-left');
    const nextBtn = this.container.querySelector('.carousel-arrow-right');
    const dots = this.container.querySelectorAll('.carousel-dot');

    prevBtn.addEventListener('click', () => this.prevSlide());
    nextBtn.addEventListener('click', () => this.nextSlide());

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const index = parseInt(dot.dataset.index);
        this.goToSlide(index);
      });
    });

    // Pausar rotación al hover
    const track = this.container.querySelector('.google-reviews-track');
    track.addEventListener('mouseenter', () => this.stopRotation());
    track.addEventListener('mouseleave', () => this.startRotation());
  }

  goToSlide(index) {
    const items = this.container.querySelectorAll('.carousel-item');
    const dots = this.container.querySelectorAll('.carousel-dot');
    const total = items.length;

    this.currentIndex = index;
    this.lastManualInteraction = Date.now(); // Registrar interacción manual
    this.stopRotation(); // Detener rotación automática
    this.startRotation(); // Reiniciar rotación con el delay

    items.forEach((item, i) => {
      item.classList.remove('active', 'next', 'prev');
      if (i === index) {
        item.classList.add('active');
      } else if (i === (index + 1) % total) {
        item.classList.add('next');
      } else if (i === (index - 1 + total) % total) {
        item.classList.add('prev');
      }
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  nextSlide() {
    const total = this.container.querySelectorAll('.carousel-item').length;
    this.goToSlide((this.currentIndex + 1) % total);
  }

  prevSlide() {
    const total = this.container.querySelectorAll('.carousel-item').length;
    this.goToSlide((this.currentIndex - 1 + total) % total);
  }

  startRotation() {
    if (this.options.autoRotate && !this.rotationInterval) {
      const timeSinceLastInteraction = Date.now() - this.lastManualInteraction;
      if (timeSinceLastInteraction < this.manualInteractionDelay) {
        // Esperar hasta que pase el tiempo de delay desde la última interacción manual
        const delayRemaining = this.manualInteractionDelay - timeSinceLastInteraction;
        setTimeout(() => {
          this.startRotation();
        }, delayRemaining);
        return;
      }
      this.rotationInterval = setInterval(() => {
        this.nextSlide();
      }, this.options.rotateInterval);
    }
  }

  stopRotation() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }

  renderStars(rating) {
    let stars = '';
    const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9);
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        // Estrella completa
        stars += '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
      } else if (i - 1 < rating) {
        // Estrella parcial - calcular porcentaje
        const percentage = (rating - (i - 1)) * 100;
        stars += `<svg width="16" height="16" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="star-grad-${uniqueId}-${i}">
              <stop offset="${percentage}%" stop-color="currentColor"/>
              <stop offset="${percentage}%" stop-color="currentColor" stop-opacity="0.3"/>
            </linearGradient>
          </defs>
          <path fill="url(#star-grad-${uniqueId}-${i})" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`;
      } else {
        // Estrella vacía
        stars += '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" fill-opacity="0.3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
      }
    }
    return stars;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const locale = this.options.language === 'es' ? 'es-ES' : 
                   this.options.language === 'en' ? 'en-GB' :
                   this.options.language === 'de' ? 'de-DE' : 'fr-FR';
    return date.toLocaleDateString(locale, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  renderError() {
    const t = this.translations;
    this.container.innerHTML = `
      <div class="google-reviews-error">
        <p>${t.error} <a href="${this.options.googleBusinessUrl}" target="_blank">${t.seeGoogle}</a></p>
      </div>
    `;
  }
}

// Inicializar cuando el DOM esté listo
function initGoogleReviews() {
  const containers = document.querySelectorAll('.google-reviews-widget-container');
  containers.forEach(container => {
    const maxReviewsAttr = container.dataset.maxReviews;
    const maxReviews = maxReviewsAttr ? parseInt(maxReviewsAttr) : Infinity;
    new GoogleReviewsWidget(container.id, {
      maxReviews: maxReviews,
      showRating: container.dataset.showRating !== 'false',
      showDate: container.dataset.showDate !== 'false',
      showGoogleLink: container.dataset.showGoogleLink !== 'false',
      googleBusinessUrl: container.dataset.googleUrl || 'https://maps.app.goo.gl/5kocLkscg2NXErMk9',
      writeReviewUrl: container.dataset.writeReviewUrl || container.dataset.googleUrl || 'https://maps.app.goo.gl/5kocLkscg2NXErMk9',
      language: container.dataset.language || 'es',
      autoRotate: container.dataset.autoRotate !== 'false',
      rotateInterval: parseInt(container.dataset.rotateInterval) || 5000
    });
  });
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGoogleReviews);
} else {
  initGoogleReviews();
}
