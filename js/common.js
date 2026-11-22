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
  { id: 'rosa',      name: 'Rosa',       primary: '#e0457b', secondary: '#fdeef2', text: '#c2185b' },
  { id: 'clasico',   name: 'Clásico',    primary: '#1f6feb', secondary: '#ffffff', text: '#1d2433' },
  { id: 'minimal',   name: 'Minimal',    primary: '#111111', secondary: '#fafafa', text: '#222222' },
  { id: 'oceano',    name: 'Océano',     primary: '#0e8fa8', secondary: '#eefafc', text: '#0b4f5c' },
  { id: 'bosque',    name: 'Bosque',     primary: '#2f7d4f', secondary: '#f1f7f2', text: '#1f3d2b' },
  { id: 'terracota', name: 'Terracota',  primary: '#c4643c', secondary: '#fbf3ee', text: '#5a2e1b' },
  { id: 'lavanda',   name: 'Lavanda',    primary: '#7c5cd6', secondary: '#f5f2fd', text: '#3b2a73' },
  { id: 'mostaza',   name: 'Mostaza',    primary: '#c99a06', secondary: '#fffaea', text: '#4a3a05' },
  { id: 'arena',     name: 'Arena',      primary: '#8a6a4b', secondary: '#f7f1ea', text: '#3d2f22' },
  { id: 'menta',     name: 'Menta',      primary: '#14a38b', secondary: '#effbf8', text: '#0d4a40' },
  { id: 'noche',     name: 'Noche',      primary: '#5b8cff', secondary: '#0f1424', text: '#e6ebff' },
  { id: 'carbon',    name: 'Carbón',     primary: '#f5b301', secondary: '#151515', text: '#f2f2f2' },
  { id: 'vino',      name: 'Vino',       primary: '#d4a373', secondary: '#2a0f17', text: '#f6e7d8' },
  { id: 'esmeralda', name: 'Esmeralda',  primary: '#3ddc97', secondary: '#0d1f1a', text: '#e3fff3' },
];

export const FONTS = [
  'Poppins', 'Inter', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Raleway', 'Nunito',
  'Manrope', 'DM Sans', 'Playfair Display', 'Cormorant Garamond', 'Cinzel', 'Tenor Sans',
  'Georgia', 'Arial',
];
const SYSTEM_FONTS = new Set(['Georgia', 'Arial', 'Helvetica', 'Times New Roman']);

export const CORNERS = { square: '2px', semi: '10px', round: '18px' };

export const BLOCK_TYPES = {
  hero:     { label: 'Sección de presentación', icon: '🖼️', unique: true },
  catalog:  { label: 'Catálogo de productos',   icon: '🛍️', unique: true },
  cart:     { label: 'Botón de carrito',        icon: '🛒', unique: true },
  text:     { label: 'Texto',                   icon: '📝' },
  image:    { label: 'Imagen / banner',         icon: '🏞️' },
  whatsapp: { label: 'Botón de WhatsApp',       icon: '💬' },
  divider:  { label: 'Separador',               icon: '➖' },
};

export const DEFAULT_DESIGN = {
  palette: 'rosa',
  colors: { primary: '#e0457b', secondary: '#fdeef2', text: '#c2185b' },
  font: 'Poppins',
  corners: 'round',
  layout: 'list',
  background: { type: 'color', image: '', overlay: 50, tint: 'dark' },
  hero: { image: '', overlay: 50, tint: 'dark' },
  blocks: [
    { id: 'b-hero', type: 'hero', visible: true },
    { id: 'b-catalog', type: 'catalog', visible: true },
    { id: 'b-cart', type: 'cart', visible: true },
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
