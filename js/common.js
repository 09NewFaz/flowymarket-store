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

const SVG = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const BENTO_ICONS = {
  sparkles: { label: 'Destello', svg: SVG('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>') },
  truck:    { label: 'Envío',    svg: SVG('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.3-.7l-3.4-3.4a1 1 0 0 0-.7-.3H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>') },
  chat:     { label: 'Atención', svg: SVG('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z"/>') },
  shield:   { label: 'Garantía', svg: SVG('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>') },
  star:     { label: 'Estrella', svg: SVG('<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>') },
  heart:    { label: 'Favorito', svg: SVG('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>') },
  clock:    { label: 'Rapidez',  svg: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
  award:    { label: 'Calidad',  svg: SVG('<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>') },
  gift:     { label: 'Regalo',   svg: SVG('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>') },
  tag:      { label: 'Oferta',   svg: SVG('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/>') },
};

export const BLOCK_TYPES = {
  hero:         { label: 'Sección de Presentación', icon: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14l5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="8.5" r="1.5"/>'), unique: true, cats: ['Sección de Presentación', 'Contenido'], desc: 'Sección de presentación con título, subtítulo y llamada a la acción' },
  catalog:      { label: 'Catálogo de Productos',   icon: SVG('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>'), unique: true, cats: ['Contenido', 'E-Commerce'], desc: 'Cuadrícula o lista de productos con varias opciones de visualización' },
  text:         { label: 'Texto',                   icon: SVG('<path d="M4 7V4h16v3M9 20h6M12 4v16"/>'), cats: ['Contenido'], desc: 'Contenido de texto enriquecido con opciones de formato' },
  image:        { label: 'Imagen',                  icon: SVG('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'), cats: ['Contenido', 'Multimedia'], desc: 'Imagen única con leyenda y opciones de enlace' },
  carousel:     { label: 'Carrusel de Productos',   icon: SVG('<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M3 7v10M21 7v10"/>'), cats: ['Contenido', 'E-Commerce'], desc: 'Carrusel desplazable de productos seleccionados' },
  bio:          { label: 'Biografía',               icon: SVG('<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>'), cats: ['Sección de Presentación', 'Contenido'], desc: 'Sección de perfil con imagen y descripción' },
  promo:        { label: 'Banner de Promociones',   icon: SVG('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/>'), cats: ['Contenido', 'E-Commerce'], desc: 'Muestra ofertas y promociones destacadas' },
  youtube:      { label: 'YouTube',                 icon: SVG('<rect x="2" y="5" width="20" height="14" rx="4"/><polygon points="10 9 16 12 10 15 10 9" fill="currentColor" stroke="none"/>'), cats: ['Contenido', 'Multimedia'], desc: 'Incorpora videos de YouTube' },
  map:          { label: 'Mapa',                    icon: SVG('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'), cats: ['Multimedia', 'Interactivo'], desc: 'Muestra una ubicación con Google Maps' },
  form:         { label: 'Formulario',              icon: SVG('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'), cats: ['Contenido', 'Interactivo'], desc: 'Crea formularios para recopilar consultas o datos' },
  social:       { label: 'Iconos de Redes Sociales', icon: SVG('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'), cats: ['Contenido', 'Interactivo'], desc: 'Muestra íconos de tus redes sociales' },
  cart:         { label: 'Botón de Carrito',        icon: SVG('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 8H6.2"/>'), unique: true, cats: ['E-Commerce', 'Interactivo'], desc: 'Botón flotante para abrir el carrito de compras' },
  links:        { label: 'Botones de Enlace',       icon: SVG('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>'), cats: ['Contenido', 'Interactivo'], desc: 'Botones de enlaces personalizados con imágenes' },
  fab:          { label: 'Botón Flotante',          icon: SVG('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z"/>'), cats: ['Interactivo'], desc: 'Botón de acción flotante para WhatsApp, teléfono, correo, etc.' },
  testimonials: { label: 'Testimonios',             icon: SVG('<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>'), cats: ['Contenido'], desc: 'Muestra reseñas y opiniones de tus clientes' },
  faq:          { label: 'Preguntas Frecuentes',    icon: SVG('<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'), cats: ['Contenido', 'Interactivo'], desc: 'Lista de preguntas frecuentes con respuestas desplegables' },
  gallery:      { label: 'Galería',                 icon: SVG('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'), cats: ['Contenido', 'Multimedia'], desc: 'Galería de imágenes en cuadrícula, mosaico o carrusel' },
  hours:        { label: 'Horario',                 icon: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), cats: ['Contenido'], desc: 'Muestra tu horario de atención' },
  footer:       { label: 'Pie de Página',           icon: SVG('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/>'), cats: ['Contenido'], desc: 'Pie de página con enlaces, contacto y redes sociales' },
  spacer:       { label: 'Espaciador',              icon: SVG('<path d="M5 12h14M12 5v3M12 16v3"/>'), cats: ['Contenido'], desc: 'Agrega espacio o un separador entre bloques' },
  bento:        { label: 'Bento de Características', icon: SVG('<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>'), cats: ['Contenido'], desc: 'Grilla de características con íconos y descripciones' },
  stats:        { label: 'Estadísticas',            icon: SVG('<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-6"/>'), cats: ['Contenido'], desc: 'Fila de cifras o métricas destacadas de tu negocio' },
  pricing:      { label: 'Tabla de Precios',        icon: SVG('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'), cats: ['Contenido', 'E-Commerce'], desc: 'Tabla de precios con planes y selector mensual/anual opcional' },
  popup:        { label: 'Ventana Emergente',       icon: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M16 6.5h2"/>'), cats: ['Contenido', 'Interactivo'], desc: 'Ventana emergente con disparador (carga, scroll, salida o clic)' },
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
        { icon: 'sparkles', title: 'Calidad garantizada', desc: 'Productos seleccionados con los mejores estándares.' },
        { icon: 'truck', title: 'Envío rápido', desc: 'Despachamos tus pedidos en tiempo récord.' },
        { icon: 'chat', title: 'Atención directa', desc: 'Te asesoramos por WhatsApp en cada paso.' },
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
  animations: { intro: 'none', entrance: 'none', speed: 'normal', hover: 'none', heroMotion: 'none' },
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
      animations: { ...DEFAULT_DESIGN.animations, ...(d.animations || {}) },
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
