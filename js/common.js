// Utilidades compartidas entre la tienda y el panel.
// Este archivo vive en shared/js y el build lo copia a cada aplicación (dist/store y dist/admin).
// config.js lo genera scripts/build.mjs a partir de .env (solo valores públicos).
// supabase-js se sirve desde vendor/supabase.js (copiado de npm), no desde un CDN.
import { APP, SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, STORE_URL, ADMIN_URL } from './config.js';

const IN_BROWSER = typeof window !== 'undefined' && typeof location !== 'undefined';
const BASE_URL = IN_BROWSER ? location.href : 'https://example.invalid/';

// Solo el panel guarda sesión. La tienda (y su copia de vista previa dentro del panel) es siempre anónima.
const IS_ADMIN_PAGE = IN_BROWSER && APP === 'admin';
export { APP, STORE_URL, ADMIN_URL };
const lib = globalThis.supabase;
if (IN_BROWSER && !lib?.createClient) throw new Error('No se cargó vendor/supabase.js');
export const sb = lib?.createClient
  ? lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, IS_ADMIN_PAGE
    ? {}
    : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;
export { BUCKET };

// ---------- Texto y formato ----------
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Devuelve HTML seguro: el símbolo de moneda lo escribe el admin y se escapa. */
export function money(n, currency = '$') {
  const v = Number(n) || 0;
  const s = v.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${esc(currency)}${s}`;
}

/** Igual que money() pero en texto plano (para mensajes de WhatsApp, no HTML). */
export function moneyText(n, currency = '$') {
  const v = Number(n) || 0;
  return `${currency}${v.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** id compatible con la restricción ^[a-z0-9]{1,24}$ */
export function uid(len = 12) {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const r = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(r, (x) => a[x % a.length]).join('');
}

export function slugId(text) {
  const s = String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  return (s || 'item') + uid(4);
}

/** URL segura para imágenes (src): http(s), blob: o data:image/… (nunca javascript:). */
export function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const url = new URL(s, BASE_URL);
    if (['https:', 'http:', 'blob:'].includes(url.protocol)) return url.href;
    if (url.protocol === 'data:' && /^data:image\/(png|jpe?g|webp|gif);/i.test(s)) return s;
    return '';
  } catch { return ''; }
}

/** URL segura para enlaces (href): solo http(s). */
export function safeLink(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const url = new URL(s, BASE_URL);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

/** ¿La selección de opciones de un carrito sigue siendo válida para el producto? (espejo de place_order) */
export function validSelection(p, sel = []) {
  const opts = Array.isArray(p?.options) ? p.options : [];
  if (!Array.isArray(sel)) return false;
  for (const pair of sel) {
    if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1])) return false;
    const it = opts[pair[0]]?.items?.[pair[1]];
    if (!it || it.available === false) return false;
  }
  return opts.every((g, gi) => {
    const n = sel.filter(([x]) => x === gi).length;
    if (!g.multi && n > 1) return false;
    const hasAvailable = (g.items || []).some((it) => it.available !== false);
    return !(g.required && hasAvailable && n === 0);
  });
}

// ---------- Diseño ----------
export const PALETTES = [
  { id: 'modern',        name: 'Modern',        primary: '#2c3e50', secondary: '#f8f9fa', text: '#3498db' },
  { id: 'elegant',       name: 'Elegant',       primary: '#34495e', secondary: '#ecf0f1', text: '#9b59b6' },
  { id: 'minimal',       name: 'Minimal',       primary: '#212529', secondary: '#f8f9fa', text: '#20c997' },
  { id: 'sakura',        name: 'Sakura',        primary: '#ff758c', secondary: '#fff0f3', text: '#d4145a' },
  { id: 'matcha',        name: 'Matcha',        primary: '#86a578', secondary: '#f6f5f0', text: '#2c4a34' },
  { id: 'milano',        name: 'Milano',        primary: '#b54141', secondary: '#f7f0ea', text: '#2b2b2b' },
  { id: 'santorini',     name: 'Santorini',     primary: '#1e4e8c', secondary: '#ffffff', text: '#1a1a3c' },
  { id: 'brooklyn',      name: 'Brooklyn',      primary: '#2d2d2d', secondary: '#f5f5f5', text: '#1a1a1a' },
  { id: 'alexandra',     name: 'Alexandra',     primary: '#614051', secondary: '#f0ead6', text: '#bf4565' },
  { id: 'coastal',       name: 'Coastal',       primary: '#1d3557', secondary: '#f1faee', text: '#457b9d' },
  { id: 'nordic',        name: 'Nordic',        primary: '#394648', secondary: '#f4f4f2', text: '#7a6c5d' },
  { id: 'bistro',        name: 'Bistro',        primary: '#2f2504', secondary: '#f5f3e7', text: '#9b7e46' },
  { id: 'slate',         name: 'Slate',         primary: '#36454f', secondary: '#f5f5f5', text: '#71797e' },
  { id: 'artisan',       name: 'Artisan',       primary: '#5d4037', secondary: '#efebe9', text: '#8d6e63' },
  { id: 'luxe',          name: 'Luxe',          primary: '#212121', secondary: '#fafafa', text: '#ffc107' },
  { id: 'tech-noir',     name: 'Tech Noir',     primary: '#00ff7f', secondary: '#121212', text: '#ff9e00' },
  { id: 'dark-elegance', name: 'Dark Elegance', primary: '#7f5af0', secondary: '#16161a', text: '#fffffe' },
  { id: 'midnight-blue', name: 'Midnight Blue', primary: '#0ea5e9', secondary: '#0f172a', text: '#e2e8f0' },
];

export const FONTS = [
  'Roboto', 'Montserrat', 'Open Sans', 'Poppins', 'Inter', 'Lato', 'Raleway', 'Nunito',
  'Manrope', 'DM Sans', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Playfair Display', 'Cormorant Garamond', 'Cinzel', 'Tenor Sans',
];
const SYSTEM_FONTS = new Set(['Georgia', 'Arial', 'Helvetica', 'Times New Roman']);

export const CORNERS = { square: '2px', semi: '10px', round: '18px' };

export const BLOCK_CATEGORIES = [
  'Todos los Bloques',
  'Sección de Presentación',
  'Contenido',
  'Multimedia',
  'E-Commerce',
  'Interactivo',
];

export const BLOCK_TYPES = {
  hero:         { label: 'Sección de Presentación', icon: '🖼️', unique: true, cats: ['Sección de Presentación', 'Contenido'], desc: 'Sección de presentación con título, subtítulo y llamada a la acción' },
  catalog:      { label: 'Catálogo de Productos',   icon: '🛍️', unique: true, cats: ['Contenido', 'E-Commerce'], desc: 'Cuadrícula o lista de productos con varias opciones de visualización' },
  text:         { label: 'Texto',                   icon: '📝', cats: ['Contenido'], desc: 'Contenido de texto enriquecido con opciones de formato' },
  image:        { label: 'Imagen',                  icon: '🏞️', cats: ['Contenido', 'Multimedia'], desc: 'Imagen única con leyenda y opciones de enlace' },
  carousel:     { label: 'Carrusel de Productos',   icon: '🎠', cats: ['Contenido', 'E-Commerce'], desc: 'Carrusel desplazable de productos seleccionados' },
  bio:          { label: 'Biografía',               icon: '👤', cats: ['Sección de Presentación', 'Contenido'], desc: 'Sección de perfil con imagen y descripción' },
  promo:        { label: 'Banner de Promociones',   icon: '🏷️', cats: ['Contenido', 'E-Commerce'], desc: 'Muestra ofertas y promociones destacadas' },
  youtube:      { label: 'YouTube',                 icon: '▶️', cats: ['Contenido', 'Multimedia'], desc: 'Incorpora videos de YouTube' },
  map:          { label: 'Mapa',                    icon: '📍', cats: ['Multimedia', 'Interactivo'], desc: 'Muestra una ubicación con Google Maps' },
  form:         { label: 'Formulario',              icon: '📋', cats: ['Contenido', 'Interactivo'], desc: 'Crea formularios para recopilar consultas o datos' },
  social:       { label: 'Iconos de Redes Sociales', icon: '🔗', cats: ['Contenido', 'Interactivo'], desc: 'Muestra íconos de tus redes sociales' },
  cart:         { label: 'Botón de Carrito',        icon: '🛒', unique: true, cats: ['E-Commerce', 'Interactivo'], desc: 'Botón flotante para abrir el carrito de compras' },
  links:        { label: 'Botones de Enlace',       icon: '🔘', cats: ['Contenido', 'Interactivo'], desc: 'Botones de enlaces personalizados con imágenes' },
  fab:          { label: 'Botón Flotante',          icon: '💬', cats: ['Interactivo'], desc: 'Botón de acción flotante para WhatsApp, teléfono, correo, etc.' },
  testimonials: { label: 'Testimonios',             icon: '⭐', cats: ['Contenido'], desc: 'Muestra reseñas y opiniones de tus clientes' },
  faq:          { label: 'Preguntas Frecuentes',    icon: '❓', cats: ['Contenido', 'Interactivo'], desc: 'Lista de preguntas frecuentes con respuestas desplegables' },
  gallery:      { label: 'Galería',                 icon: '🖼️', cats: ['Contenido', 'Multimedia'], desc: 'Galería de imágenes en cuadrícula, mosaico o carrusel' },
  hours:        { label: 'Horario',                 icon: '🕒', cats: ['Contenido'], desc: 'Muestra tu horario de atención' },
  footer:       { label: 'Pie de Página',           icon: '📄', cats: ['Contenido'], desc: 'Pie de página con enlaces, contacto y redes sociales' },
  spacer:       { label: 'Espaciador',              icon: '➖', cats: ['Contenido'], desc: 'Agrega espacio o un separador entre bloques' },
  bento:        { label: 'Bento de Características', icon: '🍱', cats: ['Contenido'], desc: 'Grilla de características con íconos y descripciones' },
  stats:        { label: 'Estadísticas',            icon: '📊', cats: ['Contenido'], desc: 'Fila de cifras o métricas destacadas de tu negocio' },
  pricing:      { label: 'Tabla de Precios',        icon: '💳', cats: ['Contenido', 'E-Commerce'], desc: 'Tabla de precios con planes y selector mensual/anual opcional' },
  popup:        { label: 'Ventana Emergente',       icon: '🪟', cats: ['Contenido', 'Interactivo'], desc: 'Ventana emergente con disparador (carga, scroll, salida o clic)' },
};

export function createBlock(type) {
  const base = { id: `b-${uid(8)}`, type, visible: true };
  switch (type) {
    case 'catalog':
      return { ...base, template: 'list', showCategories: true, showSearch: true, showSortFilter: true, showTitle: true, showPrice: true, showDescription: true, showExternalLink: false, showCartButton: true };
    case 'cart':
      return { ...base, showCount: true, showTotal: true, sidePanel: false, position: 'bottom-right', size: 'md', animation: 'none', customColors: false, bgColor: '#4f46e5', iconColor: '#ffffff', labelColor: '#ffffff' };
    case 'text':
      return { ...base, content: 'Escribe aquí tu texto…', align: 'center', size: 'md', bold: false, italic: false, underline: false };
    case 'image':
      return { ...base, image: '', caption: '', link: '', alt: '' };
    case 'carousel':
      return { ...base, title: 'Destacados', categoryId: '', productIds: [], showPrice: true };
    case 'bio':
      return { ...base, image: '', name: 'Sobre nosotros', role: '', description: 'Cuéntales a tus clientes tu historia.', align: 'center' };
    case 'promo':
      return { ...base, badge: 'OFERTA', title: '¡Promoción especial!', subtitle: 'Aprovecha este descuento por tiempo limitado.', code: '', ctaText: 'Ver productos', ctaUrl: '#catalog', customColors: false, bgColor: '#ff758c', textColor: '#ffffff' };
    case 'youtube':
      return { ...base, title: '', url: '' };
    case 'map':
      return { ...base, title: 'Nuestra ubicación', query: '', height: 280 };
    case 'form':
      return { ...base, title: 'Contáctanos', description: 'Déjanos tu consulta y te respondemos pronto.', buttonText: 'Enviar por WhatsApp', fields: [{ label: 'Nombre', type: 'text', required: true }, { label: 'Teléfono o correo', type: 'text', required: true }, { label: 'Mensaje', type: 'textarea', required: true }] };
    case 'social':
      return { ...base, title: 'Síguenos', align: 'center', items: [{ network: 'instagram', url: '' }, { network: 'tiktok', url: '' }, { network: 'whatsapp', url: '' }] };
    case 'links':
      return { ...base, title: '', items: [{ title: 'Nuestro catálogo', subtitle: 'Explora todos los productos', url: '#catalog', image: '' }] };
    case 'fab':
      return { ...base, channel: 'whatsapp', value: '', message: 'Hola! Tengo una consulta', label: '', position: 'bottom-left', color: '#25d366' };
    case 'testimonials':
      return { ...base, title: 'Lo que dicen nuestros clientes', items: [{ author: 'Camila R.', role: 'Cliente verificada', rating: 5, text: 'Excelente atención y productos de primera calidad.' }] };
    case 'faq':
      return { ...base, title: 'Preguntas Frecuentes', items: [{ q: '¿Cómo realizo un pedido?', a: 'Agrega tus productos al carrito y confirma tu pedido por WhatsApp.' }] };
    case 'gallery':
      return { ...base, title: 'Galería', layout: 'grid', items: [] };
    case 'hours':
      return { ...base, title: 'Horario de atención', note: '', days: [
        { day: 'Lunes', hours: '09:00 - 19:00', closed: false },
        { day: 'Martes', hours: '09:00 - 19:00', closed: false },
        { day: 'Miércoles', hours: '09:00 - 19:00', closed: false },
        { day: 'Jueves', hours: '09:00 - 19:00', closed: false },
        { day: 'Viernes', hours: '09:00 - 19:00', closed: false },
        { day: 'Sábado', hours: '10:00 - 15:00', closed: false },
        { day: 'Domingo', hours: '', closed: true },
      ] };
    case 'footer':
      return { ...base, description: '', phone: '', email: '', address: '', copyright: '', links: [{ label: 'Inicio', url: '#top' }, { label: 'Catálogo', url: '#catalog' }] };
    case 'spacer':
      return { ...base, size: 'md', line: true };
    case 'bento':
      return { ...base, title: 'Por qué elegirnos', items: [
        { icon: '✨', title: 'Calidad garantizada', desc: 'Productos seleccionados con los mejores estándares.' },
        { icon: '🚀', title: 'Envío rápido', desc: 'Despachamos tus pedidos en tiempo récord.' },
        { icon: '💬', title: 'Atención directa', desc: 'Te asesoramos por WhatsApp en cada paso.' },
      ] };
    case 'stats':
      return { ...base, title: '', items: [
        { value: '+500', label: 'Clientes felices' },
        { value: '100%', label: 'Originales' },
        { value: '24h', label: 'Despacho rápido' },
      ] };
    case 'pricing':
      return { ...base, title: 'Planes y precios', showToggle: true, plans: [
        { name: 'Básico', monthly: '$15', yearly: '$144', desc: 'Ideal para empezar', features: 'Beneficio 1\nBeneficio 2', ctaText: 'Elegir plan', ctaUrl: '', featured: false },
        { name: 'Pro', monthly: '$29', yearly: '$278', desc: 'El más elegido', features: 'Todo lo del Básico\nBeneficio extra\nSoporte prioritario', ctaText: 'Elegir Pro', ctaUrl: '', featured: true },
      ] };
    case 'popup':
      return { ...base, trigger: 'load', delay: 3, buttonLabel: 'Ver promoción', title: '¡Bienvenido!', text: 'Usa el código BIENVENIDO en tu primera compra.', image: '', ctaText: 'Explorar tienda', ctaUrl: '#catalog' };
    default:
      return base;
  }
}

export function youtubeEmbedUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  let id = '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) {
    id = s;
  } else {
    try {
      const u = new URL(s);
      if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1).split('/')[0];
      else if (u.hostname.includes('youtube.com')) {
        id = u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/) || [])[1] || '';
      }
    } catch { return ''; }
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
}

export function mapsEmbedUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  return `https://maps.google.com/maps?q=${encodeURIComponent(s)}&output=embed`;
}

export const DEFAULT_DESIGN = {
  palette: 'sakura',
  colors: { primary: '#ff758c', secondary: '#fff0f3', text: '#d4145a' },
  font: 'Poppins',
  corners: 'round',
  layout: 'list',
  background: { type: 'color', image: '', video: '', overlay: 50, tint: 'dark' },
  hero: {
    type: 'color', image: '', video: '', overlay: 40, tint: 'dark',
    align: 'center', textColor: '#ffffff', fgImage: '',
    ctaText: '', ctaType: 'url', ctaUrl: '', ctaBlock: '',
    size: 'md', fullHeight: false,
  },
  blocks: [
    { id: 'b-hero', type: 'hero', visible: true },
    { id: 'b-catalog', type: 'catalog', visible: true, template: 'list', showCategories: true, showSearch: true, showSortFilter: true, showTitle: true, showPrice: true, showDescription: true, showExternalLink: false, showCartButton: true },
    { id: 'b-cart', type: 'cart', visible: true, showCount: true, showTotal: true, sidePanel: false, position: 'bottom-right', size: 'md', animation: 'none', customColors: false },
  ],
};

export const DEFAULT_STORE = { name: 'Mi tienda', description: '', whatsapp: '', currency: '$', logo: '' };

export function withDefaults(cfg = {}) {
  const d = cfg.design || {};
  return {
    store: { ...DEFAULT_STORE, ...(cfg.store || {}) },
    design: {
      ...DEFAULT_DESIGN, ...d,
      colors: { ...DEFAULT_DESIGN.colors, ...(d.colors || {}) },
      background: { ...DEFAULT_DESIGN.background, ...(d.background || {}) },
      hero: { ...DEFAULT_DESIGN.hero, ...(d.hero || {}) },
      blocks: Array.isArray(d.blocks) && d.blocks.length ? d.blocks : DEFAULT_DESIGN.blocks,
    },
    checkout: cfg.checkout || {},
    payments: cfg.payments || {},
  };
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
}
export function isDark(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}
function mix(hex, other, amount) {
  const a = hexToRgb(hex), b = hexToRgb(other);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}

const loadedFonts = new Set();
export function loadFont(name) {
  if (!name || SYSTEM_FONTS.has(name) || loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/** Aplica colores, fuente y esquinas como variables CSS. */
export function applyTheme(design, el = document.documentElement) {
  const c = design.colors || DEFAULT_DESIGN.colors;
  const dark = isDark(c.secondary);
  loadFont(design.font);
  const s = el.style;
  s.setProperty('--primary', c.primary);
  s.setProperty('--on-primary', isDark(c.primary) ? '#ffffff' : '#111111');
  s.setProperty('--bg', c.secondary);
  s.setProperty('--text', c.text);
  s.setProperty('--surface', dark ? mix(c.secondary, '#ffffff', 0.06) : mix(c.secondary, '#ffffff', 0.55));
  s.setProperty('--line', dark ? mix(c.secondary, '#ffffff', 0.14) : mix(c.secondary, c.text, 0.12));
  s.setProperty('--muted', mix(c.text, c.secondary, 0.35));
  s.setProperty('--soft', mix(c.primary, c.secondary, 0.85));
  s.setProperty('--font', `'${design.font || 'Poppins'}', system-ui, sans-serif`);
  s.setProperty('--radius', CORNERS[design.corners] || CORNERS.round);
  el.dataset.scheme = dark ? 'dark' : 'light';
}

// ---------- Pedidos ----------
export const ORDER_TYPES = [
  { key: 'pickup', label: 'Recoger en sucursal' },
  { key: 'delivery', label: 'Entrega a domicilio' },
  { key: 'table', label: 'Pedido en mesa' },
];
export const ORDER_STATUSES = ['Recibido', 'En Preparación', 'Listo', 'Entregado', 'Cancelado'];
export const ADDRESS_FIELDS = [
  { key: 'line1', label: 'Calle y número' },
  { key: 'line2', label: 'Depto / referencia' },
  { key: 'city', label: 'Ciudad' },
  { key: 'state', label: 'Provincia / región' },
  { key: 'zip', label: 'Código postal' },
];

export const ORDER_ERRORS = {
  pedido_invalido: 'El pedido no es válido.',
  demasiados_pedidos: 'Hiciste muchos pedidos seguidos. Espera unos minutos e inténtalo de nuevo.',
  tienda_pausada: 'La tienda no está recibiendo pedidos en este momento.',
  pedido_vacio: 'Tu carrito está vacío.',
  producto_no_disponible: 'Uno de los productos ya no está disponible. Revisa tu carrito.',
  cantidad_invalida: 'Alguna cantidad no es válida.',
  opciones_invalidas: 'Las opciones elegidas no son válidas. Vuelve a agregar el producto.',
  opcion_no_disponible: 'Una de las opciones elegidas ya no está disponible.',
  falta_opcion_obligatoria: 'Falta elegir una opción obligatoria en un producto.',
  sin_stock: 'No hay stock suficiente para uno de los productos.',
  tipo_invalido: 'Elige cómo quieres recibir tu pedido.',
  pago_invalido: 'Elige un método de pago.',
  codigo_invalido: 'El código de descuento no es válido.',
  falta_nombre: 'Escribe tu nombre.',
  falta_telefono: 'Escribe un teléfono válido.',
  falta_email: 'Escribe un correo válido.',
  falta_direccion: 'Completa la dirección de entrega.',
  falta_respuesta: 'Responde las preguntas obligatorias.',
  demasiados_intentos: 'Probaste demasiados códigos de descuento. Inténtalo de nuevo en una hora o confirma sin código.',
};
export function orderErrorMessage(err) {
  const msg = String(err?.message || err || '');
  const key = Object.keys(ORDER_ERRORS).find((k) => msg.includes(k));
  return key ? ORDER_ERRORS[key] : 'No pudimos enviar el pedido. Inténtalo de nuevo.';
}

export function waLink(phone, text) {
  const num = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export function publicImageUrl(path) {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
