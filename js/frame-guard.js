// Protección contra clickjacking.
// GitHub Pages no permite enviar la cabecera X-Frame-Options ni CSP frame-ancestors (y frame-ancestors
// no funciona en <meta>), así que si la página se carga dentro de un iframe de otro sitio se oculta.
// Solo se permite el iframe del propio sitio (la vista previa del panel).
(function () {
  if (window.top === window.self) return;
  var sameOrigin = false;
  try { sameOrigin = window.top.location.origin === window.location.origin; } catch (e) { sameOrigin = false; }
  if (!sameOrigin) {
    document.documentElement.style.display = 'none';
    throw new Error('Esta página no se puede mostrar dentro de otro sitio.');
  }
})();
