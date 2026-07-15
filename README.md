# Taxi Conil - Servicio de Taxi

Sitio web de servicio de taxi en Conil de la Frontera, Cádiz.

## Características

- Reserva de trayectos de taxi
- Múltiples idiomas (español, inglés, alemán, francés)
- Integración con Google Maps
- Sistema de reseñas de Google
- Diseño responsivo

## Tecnologías

- HTML5, CSS3, JavaScript
- Netlify Functions para backend
- Google Maps API
- Google Places API

## Configuración

Para ejecutar en local:
```bash
npm install
node server.js
```

## Variables de Entorno

Las siguientes variables de entorno son necesarias para el funcionamiento de las reseñas de Google:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
