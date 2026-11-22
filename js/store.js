// ===== FlowyMarket: tienda pública =====
import {
  sb, esc, money, moneyText, safeUrl, safeLink, withDefaults, applyTheme, ORDER_TYPES, ADDRESS_FIELDS,
  orderErrorMessage, waLink, validSelection, youtubeEmbedUrl, mapsEmbedUrl, BENTO_ICONS,
} from './common.js';

const PREVIEW = new URLSearchParams(location.search).has('preview');
const CART_KEY = 'fm-cart-v1';

const ICON = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M4 12h7M4 18h4M18 4v16m0 0-3-3m3 3 3-3"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .55.22 1.05.59 1.42l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.82ZM6.5 8A1.5 1.5 0 1 1 6.5 5a1.5 1.5 0 0 1 0 3Z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 8H6.2"/><path d="M14 6V2m-2 2h4"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3ZM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"/></svg>',
};

const state = {
  cfg: withDefaults({}),
  cats: [],
  prods: [],
  cart: PREVIEW ? [] : loadCart(),
  query: '',
  sort: 'default',
  filter: { min: '', max: '', offer: false },
  searchOpen: false,
  activeCat: null,
};

// ---------- Datos ----------
async function loadAll() {
  const [cfg, cats, prods] = await Promise.all([
    sb.from('shop_config').select('store,design,checkout,payments').eq('id', 1).maybeSingle(),
    sb.from('categories').select('*').order('position').order('name'),
    sb.from('products').select('*').eq('hidden', false).order('position').order('title'),
  ]);
  if (cfg.error || cats.error || prods.error) throw cfg.error || cats.error || prods.error;
  state.cfg = withDefaults(cfg.data || {});
  state.cats = cats.data || [];
  state.prods = prods.data || [];
  pruneCart();
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function saveCart() {
  if (!PREVIEW) localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}
function pruneCart() {
  const before = state.cart.length;
  state.cart = state.cart.filter((l) => {
    const p = prodById(l.id);
    return p && p.cart && p.stock !== 0 && validSelection(p, l.sel);
  });
  if (state.cart.length < before && !PREVIEW) setTimeout(() => toast('Actualizamos tu carrito: algunos productos cambiaron'), 600);
  saveCart();
}

const cur = () => state.cfg.store.currency || '$';
const prodById = (id) => state.prods.find((p) => p.id === id);
const unitBase = (p) => (p.offer != null && Number(p.offer) < Number(p.price) ? Number(p.offer) : Number(p.price));

function lineUnit(line) {
  const p = prodById(line.id);
  if (!p) return 0;
  let extra = 0;
  for (const [g, i] of line.sel || []) extra += Math.max(Number(p.options?.[g]?.items?.[i]?.price) || 0, 0);
  return unitBase(p) + extra;
}
function lineOpts(line) {
  const p = prodById(line.id);
  return (line.sel || []).map(([g, i]) => p?.options?.[g]?.items?.[i]?.title).filter(Boolean);
}
const cartCount = () => state.cart.reduce((n, l) => n + l.q, 0);
const cartSubtotal = () => state.cart.reduce((s, l) => s + lineUnit(l) * l.q, 0);

// ---------- Utilidades UI ----------
const $ = (sel, root = document) => root.querySelector(sel);
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

function thumbHtml(p, overlay = '') {
  const src = safeUrl(p?.img);
  return `<div class="thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ICON.tag}${overlay}</div>`;
}
function priceHtml(p) {
  const hasOffer = p.offer != null && Number(p.offer) < Number(p.price);
  return hasOffer
    ? `<span>${money(p.offer, cur())}</span><s>${money(p.price, cur())}</s>`
    : `<span>${money(p.price, cur())}</span>`;
}

// ---------- Render principal ----------
function visibleProducts() {
  const q = state.query.trim().toLowerCase();
  const { min, max, offer } = state.filter;
  let list = state.prods.filter((p) => {
    if (q && !(`${p.title} ${p.description}`.toLowerCase().includes(q))) return false;
    const price = unitBase(p);
    if (min !== '' && price < Number(min)) return false;
    if (max !== '' && price > Number(max)) return false;
    if (offer && !(p.offer != null && Number(p.offer) < Number(p.price))) return false;
    return true;
  });
  const by = {
    asc: (a, b) => unitBase(a) - unitBase(b),
    desc: (a, b) => unitBase(b) - unitBase(a),
    name: (a, b) => a.title.localeCompare(b.title, 'es'),
  }[state.sort];
  if (by) list = [...list].sort(by);
  return list;
}

function heroActionHref(h) {
  if (h.ctaType === 'scroll' && h.ctaBlock) return `#blk-${h.ctaBlock}`;
  const raw = String(h.ctaUrl || '').trim();
  if (raw.startsWith('#')) return raw;
  return safeLink(raw);
}

function renderHero(b) {
  const { store, design } = state.cfg;
  const h = design.hero || {};
  const bgType = h.type || (h.image ? 'image' : 'color');
  const img = bgType === 'image' ? safeUrl(h.image) : '';
  const vid = bgType === 'video' ? safeUrl(h.video) : '';
  const ov = Math.min(Math.max(Number(h.overlay) || 0, 0), 100) / 100;
  const logo = safeUrl(store.logo);
  const fgImg = safeUrl(h.fgImage);
  const align = ['left', 'center', 'right'].includes(h.align) ? h.align : 'center';
  const size = ['sm', 'md', 'lg', 'xl'].includes(h.size) ? h.size : 'md';
  const textColor = /^#[0-9a-f]{6}$/i.test(h.textColor || '') ? h.textColor : '';
  const ctaHref = h.ctaText ? heroActionHref(h) : '';
  const isExt = ctaHref && !ctaHref.startsWith('#');
  return `<header id="blk-${esc(b.id)}" class="hero hero-${size} align-${align} ${img ? 'has-image' : ''} ${vid ? 'has-video' : ''} ${h.fullHeight ? 'full-h' : ''} ${h.tint === 'light' ? 'tint-light' : ''}"
      style="${img ? `background-image:url('${esc(img)}');` : ''}--ov:${(img || vid) ? ov : 0};${textColor ? `color:${esc(textColor)};` : ''}">
    ${vid ? `<video class="hero-video" src="${esc(vid)}" autoplay muted loop playsinline></video>` : ''}
    <div class="hero-inner">
      ${logo ? `<img class="hero-logo" src="${esc(logo)}" alt="">` : ''}
      <h1>${esc(store.name)}</h1>
      ${store.description ? `<p>${esc(store.description)}</p>` : ''}
      ${fgImg ? `<img class="hero-fg" src="${esc(fgImg)}" alt="">` : ''}
      ${h.ctaText && ctaHref ? `<div class="hero-cta"><a class="btn" href="${esc(ctaHref)}" ${isExt ? 'target="_blank" rel="noopener"' : ''}>${esc(h.ctaText)}</a></div>` : ''}
    </div>
  </header>`;
}

function renderCatalog(b = {}) {
  const tpl = b.template || state.cfg.design.layout || 'list';
  const layout = ['list', 'grid', 'glass', 'classic', 'boutique', 'compact'].includes(tpl) ? tpl : 'list';
  const showCats = b.showCategories !== false;
  const showSearch = b.showSearch !== false;
  const showTools = b.showSortFilter !== false;
  const showTitle = b.showTitle !== false;
  const showPrice = b.showPrice !== false;
  const showDesc = b.showDescription !== false;
  const showCartBtn = b.showCartButton !== false;

  const list = visibleProducts();
  const filtersOn = state.filter.min !== '' || state.filter.max !== '' || state.filter.offer;
  const groups = [];
  const flat = state.sort !== 'default' || state.query;
  if (flat) {
    groups.push({ id: 'all', name: state.query ? 'Resultados' : '', items: list });
  } else {
    for (const c of state.cats) {
      const items = list.filter((p) => p.category_id === c.id);
      if (items.length) groups.push({ id: c.id, name: c.name, items });
    }
    const orphans = list.filter((p) => !state.cats.some((c) => c.id === p.category_id));
    if (orphans.length) groups.push({ id: 'otros', name: 'Otros', items: orphans });
  }
  const chips = state.cats.filter((c) => state.prods.some((p) => p.category_id === c.id));
  const active = state.activeCat || chips[0]?.id;

  const card = (p) => {
    const soldout = p.stock === 0;
    const canQuick = showCartBtn && p.cart && !soldout && !state.cfg.checkout.paused;
    const badge = soldout ? '<span class="badge gray">Agotado</span>' : p.offer != null && Number(p.offer) < Number(p.price) ? '<span class="badge">Oferta</span>' : '';
    return `<div class="card ${soldout ? 'soldout' : ''}" role="button" tabindex="0" data-product="${esc(p.id)}">
      ${thumbHtml(p, badge)}
      <div class="card-body">
        ${showTitle ? `<h3>${esc(p.title)}</h3>` : ''}
        ${showDesc && p.description ? `<p>${esc(p.description)}</p>` : ''}
        <div class="card-foot">
          ${showPrice ? `<div class="price">${priceHtml(p)}</div>` : '<span></span>'}
          ${canQuick ? `<button type="button" class="quick-add" data-quick-add="${esc(p.id)}" aria-label="Agregar ${esc(p.title)} al carrito">${ICON.cart}</button>` : ''}
        </div>
      </div>
    </div>`;
  };

  const hasBar = showCats || showSearch || showTools;
  return `<section class="catalog" id="catalog">
    ${hasBar ? `<div class="catbar">
      ${(showCats || showSearch) ? `<div class="catbar-row">
        ${showCats ? `<button class="icon-btn" data-act="menu" aria-label="Categorías">${ICON.menu}</button>` : ''}
        ${showSearch ? `<button class="icon-btn" data-act="search" aria-label="Buscar">${ICON.search}</button>` : ''}
        ${showCats ? `<nav class="chips" aria-label="Categorías">
          ${chips.map((c) => `<button class="chip ${c.id === active ? 'active' : ''}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('')}
        </nav>` : ''}
      </div>` : ''}
      ${showSearch ? `<div class="searchbox ${state.searchOpen || state.query ? 'open' : ''}">
        <input type="search" id="q" placeholder="Buscar productos…" value="${esc(state.query)}" autocomplete="off">
      </div>` : ''}
      ${showTools ? `<div class="tools">
        <button class="pill ${state.sort !== 'default' ? 'on' : ''}" data-act="sort">${ICON.sort} Ordenar</button>
        <button class="pill ${filtersOn ? 'on' : ''}" data-act="filter">${ICON.filter} Filtrar</button>
      </div>` : ''}
    </div>` : ''}
    ${groups.length ? groups.map((g) => `
      <div class="cat-section" id="cat-${esc(g.id)}" data-section="${esc(g.id)}">
        ${g.name ? `<h2 class="cat-title">${esc(g.name)}</h2>` : ''}
        <div class="products ${layout}">${g.items.map(card).join('')}</div>
      </div>`).join('') : '<p class="empty">No encontramos productos.</p>'}
  </section>`;
}

const SSVG = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const UI_IC = {
  phone: SSVG('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>'),
  mail:  SSVG('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  pin:   SSVG('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  link:  SSVG('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>'),
  tag:   SSVG('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/>'),
};

const SOCIAL_META = {
  instagram: { label: 'Instagram', icon: SSVG('<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>') },
  tiktok:    { label: 'TikTok',    icon: SSVG('<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>') },
  facebook:  { label: 'Facebook',  icon: SSVG('<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/>') },
  x:         { label: 'X',         icon: SSVG('<path d="M4 4l16 16M20 4 4 20"/>') },
  youtube:   { label: 'YouTube',   icon: SSVG('<rect x="2" y="5" width="20" height="14" rx="4"/><polygon points="10 9 16 12 10 15 10 9" fill="currentColor" stroke="none"/>') },
  whatsapp:  { label: 'WhatsApp',  icon: ICON.wa },
  email:     { label: 'Correo',    icon: UI_IC.mail },
  web:       { label: 'Web',       icon: SSVG('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>') },
};

function safeActionHref(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (s.startsWith('#')) return s;
  if (s.startsWith('mailto:') || s.startsWith('tel:')) return s;
  return safeLink(s);
}

function renderBlock(b) {
  if (b.visible === false) return '';
  const id = `blk-${esc(b.id)}`;
  switch (b.type) {
    case 'hero': return renderHero(b);
    case 'catalog': return `<div id="${id}">${renderCatalog(b)}</div>`;
    case 'text': {
      if (!b.content) return '';
      const align = ['left', 'center', 'right', 'justify'].includes(b.align) ? b.align : 'center';
      const sz = ['sm', 'md', 'lg'].includes(b.size) ? b.size : 'md';
      const cls = `block-text align-${align} sz-${sz}${b.bold ? ' is-bold' : ''}${b.italic ? ' is-italic' : ''}${b.underline ? ' is-under' : ''}`;
      return `<section id="${id}" class="${cls}">${esc(b.content)}</section>`;
    }
    case 'image': {
      const src = safeUrl(b.image);
      if (!src) return '';
      const img = `<img src="${esc(src)}" alt="${esc(b.alt || '')}" loading="lazy">`;
      const href = safeActionHref(b.link);
      const isExt = href && !href.startsWith('#');
      return `<section id="${id}" class="block-image">${href ? `<a href="${esc(href)}" ${isExt ? 'target="_blank" rel="noopener"' : ''}>${img}</a>` : img}${b.caption ? `<p class="img-cap">${esc(b.caption)}</p>` : ''}</section>`;
    }
    case 'carousel': {
      const items = (b.categoryId ? state.prods.filter((p) => p.category_id === b.categoryId) : state.prods).slice(0, 16);
      if (!items.length) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="prod-carousel">${items.map((p) => `<div class="car-card" role="button" tabindex="0" data-product="${esc(p.id)}">
          ${thumbHtml(p)}
          <div class="car-body"><b>${esc(p.title)}</b>${b.showPrice !== false ? `<div class="price">${priceHtml(p)}</div>` : ''}</div>
        </div>`).join('')}</div>
      </section>`;
    }
    case 'bio': {
      const img = safeUrl(b.image);
      const align = b.align === 'left' ? 'left' : 'center';
      return `<section id="${id}" class="block-sec block-bio align-${align}">
        ${img ? `<img class="bio-img" src="${esc(img)}" alt="${esc(b.name || '')}" loading="lazy">` : ''}
        <div class="bio-text">
          ${b.name ? `<h2>${esc(b.name)}</h2>` : ''}
          ${b.role ? `<div class="bio-role">${esc(b.role)}</div>` : ''}
          ${b.description ? `<p>${esc(b.description)}</p>` : ''}
        </div>
      </section>`;
    }
    case 'promo': {
      const style = b.customColors && /^#[0-9a-f]{6}$/i.test(b.bgColor || '') && /^#[0-9a-f]{6}$/i.test(b.textColor || '')
        ? `background:${esc(b.bgColor)};color:${esc(b.textColor)};` : '';
      const href = safeActionHref(b.ctaUrl);
      const isExt = href && !href.startsWith('#');
      return `<section id="${id}" class="block-sec"><div class="promo-card" style="${style}">
        ${b.badge ? `<span class="promo-badge">${esc(b.badge)}</span>` : ''}
        ${b.title ? `<h3>${esc(b.title)}</h3>` : ''}
        ${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}
        <div class="promo-actions">
          ${b.code ? `<button type="button" class="promo-code" data-copy="${esc(b.code)}">${UI_IC.tag}<span>${esc(b.code)} · Copiar</span></button>` : ''}
          ${b.ctaText && href ? `<a class="btn" href="${esc(href)}" ${isExt ? 'target="_blank" rel="noopener"' : ''}>${esc(b.ctaText)}</a>` : ''}
        </div>
      </div></section>`;
    }
    case 'youtube': {
      const embed = youtubeEmbedUrl(b.url);
      if (!embed) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="embed-16x9"><iframe src="${esc(embed)}" title="${esc(b.title || 'YouTube')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
      </section>`;
    }
    case 'map': {
      const embed = mapsEmbedUrl(b.query);
      if (!embed) return '';
      const h = Math.min(Math.max(Number(b.height) || 280, 180), 500);
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="map-box" style="height:${h}px"><iframe src="${esc(embed)}" title="${esc(b.title || 'Mapa')}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
      </section>`;
    }
    case 'form': {
      const fields = Array.isArray(b.fields) ? b.fields : [];
      if (!fields.length) return '';
      return `<section id="${id}" class="block-sec"><form class="blk-form" data-blk-form="${esc(b.id)}">
        ${b.title ? `<h2 class="sec-title" style="padding:0;margin-bottom:6px">${esc(b.title)}</h2>` : ''}
        ${b.description ? `<p class="muted" style="margin:0 0 14px">${esc(b.description)}</p>` : ''}
        ${fields.map((f, fi) => `<div class="field">
          <label>${esc(f.label || `Campo ${fi + 1}`)}${f.required ? ' *' : ''}</label>
          ${f.type === 'textarea'
            ? `<textarea name="f${fi}" rows="3" ${f.required ? 'required' : ''}></textarea>`
            : `<input type="${['email', 'tel'].includes(f.type) ? f.type : 'text'}" name="f${fi}" ${f.required ? 'required' : ''}>`}
        </div>`).join('')}
        <button type="submit" class="btn block">${esc(b.buttonText || 'Enviar')}</button>
      </form></section>`;
    }
    case 'social': {
      const items = (Array.isArray(b.items) ? b.items : []).filter((it) => it.url);
      if (!items.length) return '';
      const align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'center';
      return `<section id="${id}" class="block-sec align-${align}">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="social-row justify-${align}">${items.map((it) => {
          const meta = SOCIAL_META[it.network] || SOCIAL_META.web;
          let href = String(it.url || '').trim();
          if (it.network === 'email' && !href.startsWith('mailto:')) href = `mailto:${href}`;
          else if (it.network === 'whatsapp' && !/^https?:/i.test(href)) href = waLink(href, 'Hola!');
          else href = safeActionHref(href);
          if (!href) return '';
          return `<a class="social-pill" href="${esc(href)}" target="_blank" rel="noopener"><span>${meta.icon}</span><span>${esc(meta.label)}</span></a>`;
        }).join('')}</div>
      </section>`;
    }
    case 'links': {
      const items = (Array.isArray(b.items) ? b.items : []).filter((it) => it.title);
      if (!items.length) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="link-list">${items.map((it) => {
          const href = safeActionHref(it.url) || '#';
          const isExt = href !== '#' && !href.startsWith('#');
          const img = safeUrl(it.image);
          return `<a class="link-card" href="${esc(href)}" ${isExt ? 'target="_blank" rel="noopener"' : ''}>
            ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}
            <div class="link-info"><b>${esc(it.title)}</b>${it.subtitle ? `<small>${esc(it.subtitle)}</small>` : ''}</div>
            <span class="link-arr">→</span>
          </a>`;
        }).join('')}</div>
      </section>`;
    }
    case 'testimonials': {
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="test-grid">${items.map((it) => `<article class="test-card">
          <div class="stars">${'★'.repeat(Math.min(5, Math.max(1, Number(it.rating) || 5)))}</div>
          <p>“${esc(it.text || '')}”</p>
          <div class="test-auth"><b>${esc(it.author || '')}</b>${it.role ? `<small>${esc(it.role)}</small>` : ''}</div>
        </article>`).join('')}</div>
      </section>`;
    }
    case 'faq': {
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="faq-list">${items.map((it) => `<details class="faq-item"><summary>${esc(it.q || '')}</summary><p>${esc(it.a || '')}</p></details>`).join('')}</div>
      </section>`;
    }
    case 'gallery': {
      const items = (Array.isArray(b.items) ? b.items : []).filter((it) => safeUrl(it.url));
      if (!items.length) return '';
      const lay = ['grid', 'masonry', 'carousel'].includes(b.layout) ? b.layout : 'grid';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="gal-wrap gal-${lay}">${items.map((it) => `<figure class="gal-item"><img src="${esc(safeUrl(it.url))}" alt="${esc(it.caption || '')}" loading="lazy">${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</figure>`).join('')}</div>
      </section>`;
    }
    case 'hours': {
      const days = Array.isArray(b.days) ? b.days : [];
      if (!days.length) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="hours-card">${days.map((dy) => `<div class="hours-row"><b>${esc(dy.day)}</b><span class="${dy.closed ? 'muted' : ''}">${dy.closed ? 'Cerrado' : esc(dy.hours || '—')}</span></div>`).join('')}
        ${b.note ? `<p class="muted" style="margin:10px 0 0">${esc(b.note)}</p>` : ''}</div>
      </section>`;
    }
    case 'footer': {
      const links = (Array.isArray(b.links) ? b.links : []).filter((l) => l.label);
      return `<footer id="${id}" class="block-footer">
        ${b.description ? `<p class="bf-desc">${esc(b.description)}</p>` : ''}
        ${(b.phone || b.email || b.address) ? `<div class="bf-contact">
          ${b.phone ? `<span class="ic-inline">${UI_IC.phone}${esc(b.phone)}</span>` : ''}
          ${b.email ? `<span class="ic-inline">${UI_IC.mail}${esc(b.email)}</span>` : ''}
          ${b.address ? `<span class="ic-inline">${UI_IC.pin}${esc(b.address)}</span>` : ''}
        </div>` : ''}
        ${links.length ? `<nav class="bf-links">${links.map((l) => {
          const href = safeActionHref(l.url) || '#';
          return `<a href="${esc(href)}" ${!href.startsWith('#') ? 'target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`;
        }).join('')}</nav>` : ''}
        <div class="bf-copy">${esc(b.copyright || `© ${new Date().getFullYear()} ${state.cfg.store.name}`)}</div>
      </footer>`;
    }
    case 'spacer':
    case 'divider': {
      const sz = ['sm', 'md', 'lg'].includes(b.size) ? b.size : 'md';
      const showLine = b.type === 'divider' ? true : b.line !== false;
      return `<div id="${id}" class="block-spacer sp-${sz}">${showLine ? '<hr>' : ''}</div>`;
    }
    case 'bento': {
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="bento-grid">${items.map((it) => {
          const ic = BENTO_ICONS[it.icon]?.svg;
          return `<div class="bento-card">
          ${ic ? `<div class="bento-ic">${ic}</div>` : it.icon ? `<div class="bento-ic">${esc(it.icon)}</div>` : ''}
          <b>${esc(it.title || '')}</b>
          ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
        </div>`;
        }).join('')}</div>
      </section>`;
    }
    case 'stats': {
      const items = Array.isArray(b.items) ? b.items : [];
      if (!items.length) return '';
      return `<section id="${id}" class="block-sec">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        <div class="stats-strip">${items.map((it) => `<div class="stat-box"><b>${esc(it.value || '')}</b><span>${esc(it.label || '')}</span></div>`).join('')}</div>
      </section>`;
    }
    case 'pricing': {
      const plans = Array.isArray(b.plans) ? b.plans : [];
      if (!plans.length) return '';
      return `<section id="${id}" class="block-sec" data-pricing-block="${esc(b.id)}">
        ${b.title ? `<h2 class="sec-title">${esc(b.title)}</h2>` : ''}
        ${b.showToggle !== false ? `<div class="price-toggle"><button type="button" class="active" data-bill="monthly">Mensual</button><button type="button" data-bill="yearly">Anual</button></div>` : ''}
        <div class="pricing-grid">${plans.map((pl) => {
          const feats = String(pl.features || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          const href = safeActionHref(pl.ctaUrl);
          return `<div class="plan-card ${pl.featured ? 'featured' : ''}">
            <h3>${esc(pl.name || '')}</h3>
            <div class="plan-price" data-m="${esc(pl.monthly || '')}" data-y="${esc(pl.yearly || pl.monthly || '')}">${esc(pl.monthly || '')}</div>
            ${pl.desc ? `<p class="muted">${esc(pl.desc)}</p>` : ''}
            ${feats.length ? `<ul>${feats.map((f) => `<li>✓ ${esc(f)}</li>`).join('')}</ul>` : ''}
            ${pl.ctaText ? (href ? `<a class="btn block" href="${esc(href)}" ${!href.startsWith('#') ? 'target="_blank" rel="noopener"' : ''}>${esc(pl.ctaText)}</a>` : `<button type="button" class="btn block">${esc(pl.ctaText)}</button>`) : ''}
          </div>`;
        }).join('')}</div>
      </section>`;
    }
    case 'popup': {
      if (b.trigger === 'button') {
        return `<section id="${id}" class="block-sec" style="text-align:center"><button type="button" class="btn" data-open-popup="${esc(b.id)}">${esc(b.buttonLabel || 'Ver promoción')}</button></section>`;
      }
      return '';
    }
    case 'whatsapp': {
      const num = state.cfg.store.whatsapp;
      if (!num) return '';
      return `<section id="${id}" class="block-wa"><a class="btn wa" href="${esc(waLink(num, b.message || 'Hola! Tengo una consulta'))}" target="_blank" rel="noopener">${ICON.wa} ${esc(b.label || 'Escríbenos por WhatsApp')}</a></section>`;
    }
    default: return '';
  }
}

function getCartBlock() {
  return (state.cfg.design.blocks || []).find((b) => b.type === 'cart' && b.visible !== false) || null;
}

function cartFabHtml() {
  const cb = getCartBlock();
  if (!cb || cartCount() === 0) return '';
  const pos = ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'middle-right', 'middle-left'].includes(cb.position) ? cb.position : 'bottom-right';
  const sz = ['sm', 'md', 'lg'].includes(cb.size) ? cb.size : 'md';
  const anim = ['none', 'pulse', 'bounce', 'scale'].includes(cb.animation) ? cb.animation : 'none';
  const showTotal = cb.showTotal !== false;
  const showCount = cb.showCount !== false;
  let style = '';
  if (cb.customColors) {
    if (/^#[0-9a-f]{6}$/i.test(cb.bgColor || '')) style += `background:${cb.bgColor};`;
    if (/^#[0-9a-f]{6}$/i.test(cb.iconColor || '')) style += `--fab-ic:${cb.iconColor};`;
    if (/^#[0-9a-f]{6}$/i.test(cb.labelColor || '')) style += `color:${cb.labelColor};`;
  }
  return `<button class="cart-fab pos-${pos} sz-${sz} anim-${anim} ${showTotal ? 'with-total' : ''}" style="${style}" data-act="cart" aria-label="Ver carrito">
    <span class="fab-ic">${ICON.cart}</span>
    ${showTotal ? `<span class="fab-total">${money(cartSubtotal(), cur())}</span>` : ''}
    ${showCount ? `<span class="count">${cartCount()}</span>` : ''}
  </button>`;
}

function renderFabs() {
  const fabs = (state.cfg.design.blocks || []).filter((b) => b.type === 'fab' && b.visible !== false);
  return fabs.map((b) => {
    const ch = b.channel || 'whatsapp';
    const val = b.value || (ch === 'whatsapp' ? state.cfg.store.whatsapp : '');
    let href = '';
    let ic = ICON.wa;
    if (ch === 'whatsapp' && val) { href = waLink(val, b.message || 'Hola!'); ic = ICON.wa; }
    else if (ch === 'phone' && val) { href = `tel:${val.replace(/[^+\d]/g, '')}`; ic = UI_IC.phone; }
    else if (ch === 'email' && val) { href = `mailto:${val}`; ic = UI_IC.mail; }
    else if (ch === 'url') { href = safeLink(val); ic = UI_IC.link; }
    if (!href) return '';
    const pos = ['bottom-left', 'bottom-right', 'top-left', 'top-right'].includes(b.position) ? b.position : 'bottom-left';
    const bg = /^#[0-9a-f]{6}$/i.test(b.color || '') ? `background:${b.color};` : '';
    return `<a class="contact-fab pos-${pos} ${b.label ? 'has-lbl' : ''}" style="${bg}" href="${esc(href)}" target="_blank" rel="noopener" aria-label="${esc(b.label || ch)}">${ic}${b.label ? `<span>${esc(b.label)}</span>` : ''}</a>`;
  }).join('');
}

const INTRO_KINDS = new Set(['logo-fade', 'logo-zoom', 'curtain', 'split', 'circle', 'shimmer', 'ripple', 'brand-wipe']);
const ENTRANCE_KINDS = new Set(['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'zoom-out', 'blur', 'flip', 'bounce']);
const PROD_ANIM_KINDS = new Set(['cascade', 'img-zoom', 'shine', 'tilt', 'badge-pulse']);
const HOVER_KINDS = new Set(['lift', 'scale', 'glow', 'border', 'btn-shine', 'pop']);
const HERO_MOTION_KINDS = new Set(['ken-burns', 'float', 'gradient-flow', 'cta-pulse', 'hero-stagger']);
const AMBIENT_KINDS = new Set(['particles', 'bubbles', 'sparkles', 'petals', 'aurora']);

let introPlayed = false;
function playIntro(force = false) {
  const anim = state.cfg.design.animations || {};
  const kind = INTRO_KINDS.has(anim.intro) ? anim.intro : 'none';
  if (kind === 'none') return;
  if (!force && (introPlayed || PREVIEW)) return;
  introPlayed = true;
  $('.intro-splash')?.remove();
  const logo = safeUrl(state.cfg.store.logo);
  const speed = ['fast', 'normal', 'slow'].includes(anim.speed) ? anim.speed : 'normal';
  const dur = speed === 'fast' ? 950 : speed === 'slow' ? 1950 : 1400;
  const el = document.createElement('div');
  el.className = `intro-splash intro-${kind} spd-${speed}`;
  el.innerHTML = `
    ${kind === 'split' ? '<div class="intro-door left"></div><div class="intro-door right"></div>' : ''}
    ${kind === 'ripple' ? '<div class="intro-ring r1"></div><div class="intro-ring r2"></div>' : ''}
    <div class="intro-inner">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<span>${esc(state.cfg.store.name)}</span></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), Math.round(dur * 0.62));
  setTimeout(() => el.remove(), dur + 600);
}

function ambientHtml(kind) {
  if (!AMBIENT_KINDS.has(kind)) return '';
  if (kind === 'aurora') return '<div class="ambient-layer amb-aurora" aria-hidden="true"><i></i><i></i></div>';
  const dots = Array.from({ length: 16 }, (_, i) => {
    const left = ((i * 37) % 94) + 3;
    const delay = ((i * 0.7) % 7).toFixed(1);
    const dur = (6 + (i % 5) * 1.8).toFixed(1);
    const sz = 6 + (i % 4) * 5;
    return `<span style="left:${left}%;--d:${delay}s;--t:${dur}s;--s:${sz}px"></span>`;
  }).join('');
  return `<div class="ambient-layer amb-${kind}" aria-hidden="true">${dots}</div>`;
}

let animObs;
let scrollBarHandler;
function setupAnimations(replay = false) {
  animObs?.disconnect();
  if (scrollBarHandler) { window.removeEventListener('scroll', scrollBarHandler); scrollBarHandler = null; }
  const page = $('.page');
  if (!page) return;
  const anim = state.cfg.design.animations || {};

  // Barra de progreso de lectura
  const bar = $('.scroll-progress');
  if (bar) {
    scrollBarHandler = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / max))})`;
    };
    window.addEventListener('scroll', scrollBarHandler, { passive: true });
    scrollBarHandler();
  }

  // Cascada en tarjetas de producto
  if (anim.productAnim === 'cascade') {
    const cards = [...page.querySelectorAll('.products .card')];
    cards.forEach((c, i) => {
      if (replay) c.classList.remove('in-view');
      c.style.setProperty('--c-delay', `${Math.min(i, 10) * 60}ms`);
    });
  }

  const ent = ENTRANCE_KINDS.has(anim.entrance) ? anim.entrance : 'none';
  const watchCards = anim.productAnim === 'cascade';
  if (ent === 'none' && !watchCards) return;

  const targets = [
    ...(ent !== 'none' ? [...page.children] : []),
    ...(watchCards ? [...page.querySelectorAll('.products .card')] : []),
  ];
  if (replay) targets.forEach((el) => el.classList.remove('in-view'));
  animObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        animObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -16px 0px' });
  targets.forEach((el, idx) => {
    if (!el.classList.contains('card')) el.style.setProperty('--stagger', `${Math.min(idx, 6) * 70}ms`);
    animObs.observe(el);
  });
}

function render() {
  const { store, design, checkout } = state.cfg;
  applyTheme(design);
  document.title = store.name || 'Tienda';
  const favUrl = safeUrl(store.favicon || store.logo);
  if (favUrl && !PREVIEW) {
    document.querySelectorAll('link[rel*="icon"]').forEach((l) => l.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = favUrl;
    document.head.appendChild(link);
  }
  const bg = design.background || {};
  const bgImg = bg.type === 'image' ? safeUrl(bg.image) : '';
  const bgVid = bg.type === 'video' ? safeUrl(bg.video) : '';
  document.body.classList.toggle('has-bg-image', !!bgImg || !!bgVid);
  const ovRgb = bg.tint === 'light' ? '255,255,255' : '0,0,0';
  const ovAlpha = (Number(bg.overlay) || 0) / 100;
  document.body.style.backgroundImage = bgImg
    ? `linear-gradient(rgba(${ovRgb},${ovAlpha}),rgba(${ovRgb},${ovAlpha})),url('${bgImg.replace(/'/g, '%27')}')`
    : '';

  const anim = design.animations || {};
  const ent = ENTRANCE_KINDS.has(anim.entrance) ? anim.entrance : 'none';
  const speed = ['fast', 'normal', 'slow'].includes(anim.speed) ? anim.speed : 'normal';
  const hover = HOVER_KINDS.has(anim.hover) ? anim.hover : 'none';
  const heroMotion = HERO_MOTION_KINDS.has(anim.heroMotion) ? anim.heroMotion : 'none';
  const prodAnim = PROD_ANIM_KINDS.has(anim.productAnim) ? anim.productAnim : 'none';
  const amb = AMBIENT_KINDS.has(anim.ambient) ? anim.ambient : 'none';

  const btnStyle = ['solid', 'gradient', 'glass', 'outline', 'glow'].includes(design.buttonStyle) ? design.buttonStyle : 'solid';
  const cardStyle = ['clean', 'elevated', 'glass', 'bordered', 'soft'].includes(design.cardStyle) ? design.cardStyle : 'clean';
  const pageWidth = ['compact', 'standard', 'wide', 'full'].includes(design.width) ? design.width : 'standard';

  const blocks = design.blocks || [];
  const hasCustomFooter = blocks.some((b) => b.type === 'footer' && b.visible !== false);
  const scroll = window.scrollY;
  $('#app').innerHTML = `
    ${anim.scrollBar ? '<div class="scroll-progress" aria-hidden="true"></div>' : ''}
    ${ambientHtml(amb)}
    ${bgVid ? `<div class="bg-video-wrap"><video src="${esc(bgVid)}" autoplay muted loop playsinline></video><div style="background:rgba(${ovRgb},${ovAlpha})"></div></div>` : ''}
    ${PREVIEW ? '<div class="banner-preview">Vista previa · los cambios aún no están publicados</div>' : ''}
    ${checkout.paused ? '<div class="banner-paused">La tienda no está recibiendo pedidos en este momento.</div>' : ''}
    <div class="page" id="top" data-anim="${ent}" data-speed="${speed}" data-hover="${hover}" data-hero-motion="${heroMotion}" data-prod-anim="${prodAnim}" data-btn-style="${btnStyle}" data-card-style="${cardStyle}" data-width="${pageWidth}">
      ${blocks.map(renderBlock).join('')}
      ${hasCustomFooter ? '' : `<footer class="footer">© ${new Date().getFullYear()} ${esc(store.name)}</footer>`}
    </div>
    ${renderFabs()}
    ${cartFabHtml()}`;
  window.scrollTo(0, scroll);
  setupScrollSpy();
  setupPopups();
  setupAnimations();
  playIntro(false);
}

function updateCartFab(bump) {
  $('.cart-fab')?.remove();
  const html = cartFabHtml();
  if (!html) return;
  $('#app').insertAdjacentHTML('beforeend', html);
  const fab = $('.cart-fab');
  if (bump && fab) { fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump'); }
}

// Resalta la categoría visible al hacer scroll
let spy;
function setupScrollSpy() {
  spy?.disconnect();
  const sections = document.querySelectorAll('[data-section]');
  if (!sections.length || state.sort !== 'default' || state.query) return;
  spy = new IntersectionObserver((entries) => {
    const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!vis) return;
    const id = vis.target.dataset.section;
    state.activeCat = id;
    document.querySelectorAll('.chip').forEach((c) => {
      const on = c.dataset.cat === id;
      c.classList.toggle('active', on);
      // Desplaza solo la fila de categorías (scrollIntoView movería también la página y el panel)
      if (on) {
        const bar = c.parentElement;
        bar.scrollTo({ left: c.offsetLeft - bar.clientWidth / 2 + c.offsetWidth / 2, behavior: 'smooth' });
      }
    });
  }, { rootMargin: '-150px 0px -55% 0px' });
  sections.forEach((s) => spy.observe(s));
}

function goToCat(id) {
  const el = document.getElementById(`cat-${id}`);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' });
}

// ---------- Hojas (modales) ----------
function openSheet(html, { onMount, cls = '' } = {}) {
  closeSheet();
  const root = $('#overlay-root');
  root.innerHTML = `<div class="sheet-backdrop" data-close><div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
  const back = root.firstElementChild;
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-x]')) closeSheet(); });
  onMount?.(back.firstElementChild);
  return back.firstElementChild;
}
function closeSheet() {
  $('#overlay-root').innerHTML = '';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

const head = (title) => `<div class="sheet-head"><h2>${esc(title)}</h2><button class="close-btn" data-x aria-label="Cerrar">×</button></div>`;

function openMenu() {
  const root = $('#overlay-root');
  root.innerHTML = `<div class="drawer-backdrop"><nav class="drawer"><h2>Categorías</h2>
    ${state.cats.filter((c) => state.prods.some((p) => p.category_id === c.id)).map((c) => `<button class="link" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('')}
  </nav></div>`;
  document.body.style.overflow = 'hidden';
  root.firstElementChild.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (b || e.target === root.firstElementChild) {
      closeSheet();
      if (b) { clearSearchAndSort(); goToCat(b.dataset.cat); }
    }
  });
}

function clearSearchAndSort() {
  if (state.query || state.sort !== 'default') {
    state.query = ''; state.sort = 'default'; state.searchOpen = false;
    render();
  }
}

function openSort() {
  const opts = [['default', 'Recomendados'], ['asc', 'Precio: menor a mayor'], ['desc', 'Precio: mayor a menor'], ['name', 'Nombre (A-Z)']];
  openSheet(`${head('Ordenar')}<div class="sheet-body radio-list">
    ${opts.map(([v, l]) => `<label><input type="radio" name="sort" value="${v}" ${state.sort === v ? 'checked' : ''}> ${l}</label>`).join('')}
  </div>`, {
    onMount: (s) => s.addEventListener('change', (e) => { state.sort = e.target.value; closeSheet(); render(); }),
  });
}

function openFilter() {
  const f = state.filter;
  openSheet(`${head('Filtrar')}<div class="sheet-body">
      <div class="section-title">Precio</div>
      <div class="range-row">
        <div class="field"><label for="fmin">Mínimo</label><input id="fmin" type="number" min="0" inputmode="decimal" value="${esc(f.min)}"></div>
        <div class="field"><label for="fmax">Máximo</label><input id="fmax" type="number" min="0" inputmode="decimal" value="${esc(f.max)}"></div>
      </div>
      <label class="check"><input type="checkbox" id="foffer" ${f.offer ? 'checked' : ''}> Solo productos en oferta</label>
    </div>
    <div class="sheet-foot foot-row">
      <button class="btn ghost" data-clear>Limpiar</button>
      <button class="btn" data-apply>Aplicar</button>
    </div>`, {
    onMount: (s) => {
      s.querySelector('[data-apply]').onclick = () => {
        state.filter = { min: s.querySelector('#fmin').value, max: s.querySelector('#fmax').value, offer: s.querySelector('#foffer').checked };
        closeSheet(); render();
      };
      s.querySelector('[data-clear]').onclick = () => { state.filter = { min: '', max: '', offer: false }; closeSheet(); render(); };
    },
  });
}

// ----- Detalle de producto -----
function openProduct(id) {
  const p = prodById(id);
  if (!p) return;
  const imgs = [p.img, ...(p.imgs || [])].map(safeUrl).filter(Boolean);
  const options = Array.isArray(p.options) ? p.options : [];
  const canBuy = p.cart && p.stock !== 0 && !state.cfg.checkout.paused;
  let qty = 1;

  const html = `${head(p.title)}
    <div class="sheet-body">
      ${imgs.length ? `<div class="gallery ${imgs.length === 1 ? 'single' : ''}">${imgs.map((s) => `<img src="${esc(s)}" alt="">`).join('')}</div>` : ''}
      <h3 class="p-title">${esc(p.title)}</h3>
      <div class="price" style="margin-bottom:10px">${priceHtml(p)}</div>
      ${p.description ? `<p class="p-desc">${esc(p.description)}</p>` : ''}
      ${p.stock === 0 ? '<p><span class="badge gray">Agotado</span></p>' : p.stock < 99999 && p.stock <= 5 ? `<p class="muted">¡Quedan ${p.stock}!</p>` : ''}
      ${canBuy ? options.map((g, gi) => `
        <div class="opt-group" data-group="${gi}">
          <h4>${esc(g.title || 'Opciones')} <small class="${g.required ? 'req' : ''}">${g.required ? 'Obligatorio' : 'Opcional'}${g.multi ? ' · varias' : ''}</small></h4>
          ${(g.items || []).map((it, ii) => {
            const off = it.available === false;
            return `<label class="opt ${off ? 'disabled' : ''}">
              <input type="${g.multi ? 'checkbox' : 'radio'}" name="g${gi}" value="${ii}" ${off ? 'disabled' : ''}>
              <span>${esc(it.title)}</span>
              ${Number(it.price) > 0 ? `<small>+${money(it.price, cur())}</small>` : ''}
            </label>`;
          }).join('')}
        </div>`).join('') : ''}
      ${canBuy ? `<div class="field"><label for="pnote">Nota para este producto (opcional)</label><textarea id="pnote" rows="2" maxlength="300" placeholder="Ej: talle, color, aclaraciones…"></textarea></div>` : ''}
      <div class="error-box" hidden></div>
    </div>
    ${canBuy ? `<div class="sheet-foot foot-row">
      <div class="qty"><button data-q="-1" aria-label="Menos">−</button><span>1</span><button data-q="1" aria-label="Más">+</button></div>
      <button class="btn" data-add>Agregar · <span data-total></span></button>
    </div>` : ''}`;

  const sideCls = getCartBlock()?.sidePanel ? 'side-panel' : '';
  openSheet(html, {
    cls: sideCls,
    onMount: (s) => {
      if (!canBuy) return;
      const selection = () => {
        const sel = [];
        s.querySelectorAll('[data-group]').forEach((g) => {
          g.querySelectorAll('input:checked').forEach((i) => sel.push([Number(g.dataset.group), Number(i.value)]));
        });
        return sel;
      };
      const update = () => {
        s.querySelector('.qty span').textContent = qty;
        const unit = lineUnit({ id: p.id, sel: selection() });
        s.querySelector('[data-total]').textContent = money(unit * qty, cur());
      };
      s.addEventListener('change', update);
      s.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => {
        const max = p.stock < 99999 ? p.stock : 999;
        qty = Math.min(Math.max(1, qty + Number(b.dataset.q)), max);
        update();
      }));
      s.querySelector('[data-add]').onclick = () => {
        const sel = selection();
        const missing = options.find((g, gi) => g.required && (g.items || []).some((i) => i.available !== false) && !sel.some(([x]) => x === gi));
        const err = s.querySelector('.error-box');
        if (missing) { err.textContent = `Elige una opción en "${missing.title || 'Opciones'}".`; err.hidden = false; return; }
        const note = s.querySelector('#pnote').value.trim();
        const key = JSON.stringify([p.id, sel, note]);
        const existing = state.cart.find((l) => JSON.stringify([l.id, l.sel, l.note || '']) === key);
        if (existing) existing.q = Math.min(existing.q + qty, 999);
        else state.cart.push({ id: p.id, q: qty, sel, note });
        saveCart();
        closeSheet();
        updateCartFab(true);
        toast('Agregado al carrito');
      };
      update();
    },
  });
}

// ----- Carrito -----
function openCart() {
  if (!state.cart.length) { toast('Tu carrito está vacío'); return; }
  const lines = state.cart.map((l, idx) => {
    const p = prodById(l.id);
    const opts = lineOpts(l);
    return `<div class="line">
      ${thumbHtml(p)}
      <div class="line-info">
        <b>${esc(p?.title)}</b>
        ${opts.length ? `<small>${esc(opts.join(', '))}</small>` : ''}
        ${l.note ? `<small>Nota: ${esc(l.note)}</small>` : ''}
        <small>${money(lineUnit(l), cur())} c/u</small>
      </div>
      <div class="line-side">
        <b>${money(lineUnit(l) * l.q, cur())}</b>
        <div class="qty"><button data-line="${idx}" data-d="-1" aria-label="Menos">−</button><span>${l.q}</span><button data-line="${idx}" data-d="1" aria-label="Más">+</button></div>
      </div>
    </div>`;
  }).join('');
  const sideCls = getCartBlock()?.sidePanel ? 'side-panel' : '';
  openSheet(`${head('Tu pedido')}
    <div class="sheet-body">${lines}
      <div class="totals"><div class="grand"><span>Subtotal</span><span>${money(cartSubtotal(), cur())}</span></div></div>
      <p class="muted">El envío, los impuestos y los descuentos se calculan al confirmar.</p>
    </div>
    <div class="sheet-foot"><button class="btn block" data-checkout ${state.cfg.checkout.paused ? 'disabled' : ''}>Continuar</button></div>`, {
    cls: sideCls,
    onMount: (s) => {
      s.querySelectorAll('[data-line]').forEach((b) => (b.onclick = () => {
        const l = state.cart[Number(b.dataset.line)];
        const p = prodById(l.id);
        const max = p && p.stock < 99999 ? p.stock : 999;
        l.q = Math.min(l.q + Number(b.dataset.d), max);
        if (l.q <= 0) state.cart.splice(Number(b.dataset.line), 1);
        saveCart(); updateCartFab();
        if (state.cart.length) openCart(); else closeSheet();
      }));
      s.querySelector('[data-checkout]').onclick = openCheckout;
    },
  });
}

function openCheckout() {
  const ck = state.cfg.checkout;
  const pm = state.cfg.payments;
  const types = ORDER_TYPES.filter((t) => ck[t.key]);
  const pays = [
    pm.cash && 'Efectivo',
    pm.transfer && 'Transferencia',
    pm.custom && (pm.customName || 'Otro'),
  ].filter(Boolean);
  const addr = ck.addr || {};
  const questions = ck.questionsOn && Array.isArray(ck.questions) ? ck.questions : [];
  const saved = JSON.parse(localStorage.getItem('fm-customer') || '{}');

  const html = `${head('Finalizar pedido')}
  <form class="sheet-body" id="ckform" novalidate>
    ${types.length ? `<div class="section-title">¿Cómo lo recibes?</div>
      <div class="seg">${types.map((t, i) => `<label><input type="radio" name="type" value="${esc(t.label)}" ${i === 0 ? 'checked' : ''}> ${esc(t.label)}${t.key === 'delivery' && Number(ck.deliveryPrice) > 0 ? ` (+${money(ck.deliveryPrice, cur())})` : ''}</label>`).join('')}</div>` : ''}
    <div id="addr-box">
      ${ADDRESS_FIELDS.filter((f) => addr[f.key]?.[0]).map((f) => `
        <div class="field"><label for="a-${f.key}">${esc(f.label)}${addr[f.key][1] ? ' *' : ''}</label>
        <input id="a-${f.key}" name="a-${f.key}" maxlength="150" value="${esc(saved.address?.[f.key] || '')}"></div>`).join('')}
    </div>
    <div id="table-box" hidden><div class="field"><label for="a-text">Número de mesa *</label><input id="a-text" name="a-text" maxlength="20"></div></div>
    <div class="section-title">Tus datos</div>
    ${ck.askName !== false ? `<div class="field"><label for="c-name">Nombre *</label><input id="c-name" maxlength="120" autocomplete="name" value="${esc(saved.name || '')}"></div>` : ''}
    ${ck.askPhone !== false ? `<div class="field"><label for="c-phone">Teléfono *</label><input id="c-phone" type="tel" maxlength="25" autocomplete="tel" value="${esc(saved.phone || '')}"></div>` : ''}
    ${ck.askEmail ? `<div class="field"><label for="c-email">Correo *</label><input id="c-email" type="email" maxlength="160" autocomplete="email" value="${esc(saved.email || '')}"></div>` : ''}
    ${questions.map((q, i) => `<div class="field"><label for="q-${i}">${esc(q.text)}${q.required ? ' *' : ''}</label><input id="q-${i}" maxlength="300"></div>`).join('')}
    ${pays.length ? `<div class="section-title">Método de pago</div>
      <div class="seg">${pays.map((p, i) => `<label><input type="radio" name="pay" value="${esc(p)}" ${i === 0 ? 'checked' : ''}> ${esc(p)}</label>`).join('')}</div>` : ''}
    <div class="field"><label for="promo">Código de descuento</label><input id="promo" maxlength="40" autocomplete="off" placeholder="Opcional"></div>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(cartSubtotal(), cur())}</span></div>
      <div id="ship-row" hidden><span>Envío</span><span>${money(ck.deliveryPrice, cur())}</span></div>
    </div>
    <div class="error-box" hidden style="margin-top:12px"></div>
  </form>
  <div class="sheet-foot"><button class="btn block" data-send>${PREVIEW ? 'Vista previa: pedidos desactivados' : 'Confirmar pedido'}</button></div>`;

  const sideCls = getCartBlock()?.sidePanel ? 'side-panel' : '';
  openSheet(html, {
    cls: sideCls,
    onMount: (s) => {
      const form = s.querySelector('#ckform');
      const syncType = () => {
        const t = form.querySelector('input[name=type]:checked')?.value;
        s.querySelector('#addr-box').hidden = t !== 'Entrega a domicilio';
        s.querySelector('#table-box').hidden = t !== 'Pedido en mesa';
        s.querySelector('#ship-row').hidden = !(t === 'Entrega a domicilio' && Number(ck.deliveryPrice) > 0);
      };
      form.addEventListener('change', syncType);
      syncType();
      const btn = s.querySelector('[data-send]');
      btn.disabled = PREVIEW;
      btn.onclick = async () => {
        const err = s.querySelector('.error-box');
        err.hidden = true;
        const val = (id) => form.querySelector(`#${id}`)?.value.trim() || '';
        const type = form.querySelector('input[name=type]:checked')?.value || '';
        const address = { text: type === 'Pedido en mesa' ? `Mesa ${val('a-text')}` : '' };
        if (type === 'Pedido en mesa' && !val('a-text')) { err.textContent = 'Escribe el número de mesa.'; err.hidden = false; return; }
        if (type === 'Entrega a domicilio') for (const f of ADDRESS_FIELDS) if (addr[f.key]?.[0]) address[f.key] = val(`a-${f.key}`);
        const customer = { name: val('c-name'), phone: val('c-phone'), email: val('c-email') };
        const payload = {
          items: state.cart.map((l) => ({ id: l.id, q: l.q, sel: l.sel || [], note: l.note || '' })),
          type,
          pay: form.querySelector('input[name=pay]:checked')?.value || '',
          promo: val('promo'),
          customer,
          address,
          answers: questions.map((_, i) => val(`q-${i}`)),
        };
        btn.disabled = true;
        btn.textContent = 'Enviando…';
        const { data, error } = await sb.rpc('place_order', { payload });
        // Un cupón inválido vuelve como {error} (sin excepción) para que el intento quede registrado en el servidor.
        const failure = error || (data?.error ? { message: String(data.error) } : null);
        if (failure || !data?.num) {
          err.textContent = orderErrorMessage(failure || 'pedido_invalido');
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Confirmar pedido';
          err.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        localStorage.setItem('fm-customer', JSON.stringify({ ...customer, address }));
        state.cart = [];
        saveCart();
        updateCartFab();
        showDone(data, customer, address);
      };
    },
  });
}

function orderMessage(o, customer, address) {
  const c = cur();
  const lines = [
    `*Nuevo pedido #${o.num}* — ${state.cfg.store.name}`,
    '',
    ...o.items.map((i) => `• ${i.q} x ${i.title}${i.opts?.length ? ` (${i.opts.join(', ')})` : ''}${i.note ? ` — ${i.note}` : ''}: ${moneyText(i.price * i.q, c)}`),
    '',
    `Subtotal: ${moneyText(o.subtotal, c)}`,
    Number(o.discount) > 0 ? `Descuento: -${moneyText(o.discount, c)}` : '',
    Number(o.tax) > 0 ? `Impuestos: ${moneyText(o.tax, c)}` : '',
    Number(o.shipping) > 0 ? `Envío: ${moneyText(o.shipping, c)}` : '',
    `*Total: ${moneyText(o.total, c)}*`,
    '',
    o.type ? `Entrega: ${o.type}` : '',
    o.type === 'Entrega a domicilio' ? `Dirección: ${ADDRESS_FIELDS.map((f) => address[f.key]).filter(Boolean).join(', ')}` : '',
    o.type === 'Pedido en mesa' ? address.text : '',
    o.pay ? `Pago: ${o.pay}` : '',
    customer.name ? `Nombre: ${customer.name}` : '',
    customer.phone ? `Teléfono: ${customer.phone}` : '',
  ];
  return lines.filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n');
}

function showDone(o, customer, address) {
  const num = state.cfg.store.whatsapp;
  const link = num ? waLink(num, orderMessage(o, customer, address)) : '';
  const pm = state.cfg.payments;
  openSheet(`${head('¡Pedido recibido!')}
    <div class="sheet-body done">
      <div class="big">🎉</div>
      <h3>Pedido #${esc(o.num)}</h3>
      <p class="muted">Total: <b>${money(o.total, cur())}</b></p>
      ${o.pay === 'Transferencia' && pm.transferInfo ? `<div class="transfer-box"><b>Datos para transferir</b>\n${esc(pm.transferInfo)}</div>` : ''}
      ${link ? '<p>Envía el pedido por WhatsApp para confirmarlo con la tienda.</p>' : '<p>La tienda se comunicará contigo para confirmarlo.</p>'}
    </div>
    <div class="sheet-foot">
      ${link ? `<a class="btn wa block" href="${esc(link)}" target="_blank" rel="noopener">${ICON.wa} Enviar por WhatsApp</a>` : '<button class="btn block" data-x>Listo</button>'}
    </div>`);
  if (link) window.open(link, '_blank', 'noopener');
}

// ---------- Acciones rápidas, Popups y Formularios ----------
function quickAdd(id) {
  const p = prodById(id);
  if (!p || !p.cart || p.stock === 0 || state.cfg.checkout.paused) return;
  const opts = Array.isArray(p.options) ? p.options : [];
  if (opts.some((g) => g.required && (g.items || []).some((i) => i.available !== false))) {
    openProduct(id);
    return;
  }
  const key = JSON.stringify([p.id, [], '']);
  const existing = state.cart.find((l) => JSON.stringify([l.id, l.sel, l.note || '']) === key);
  const max = p.stock < 99999 ? p.stock : 999;
  if (existing) existing.q = Math.min(existing.q + 1, max);
  else state.cart.push({ id: p.id, q: 1, sel: [], note: '' });
  saveCart();
  updateCartFab(true);
  toast('Agregado al carrito');
}

const popupsShown = new Set();
let popupCleanups = [];
function openPopupBlock(id) {
  const b = (state.cfg.design.blocks || []).find((x) => x.id === id && x.type === 'popup');
  if (!b) return;
  const img = safeUrl(b.image);
  const href = safeActionHref(b.ctaUrl);
  const isExt = href && !href.startsWith('#');
  openSheet(`${head(b.title || 'Aviso')}
    <div class="sheet-body" style="text-align:center">
      ${img ? `<img src="${esc(img)}" alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:var(--radius);margin-bottom:14px">` : ''}
      ${b.text ? `<p style="white-space:pre-line;line-height:1.5">${esc(b.text)}</p>` : ''}
    </div>
    ${b.ctaText && href ? `<div class="sheet-foot"><a class="btn block" href="${esc(href)}" ${isExt ? 'target="_blank" rel="noopener"' : 'data-x'}>${esc(b.ctaText)}</a></div>` : ''}`);
}

function setupPopups() {
  popupCleanups.forEach((fn) => fn());
  popupCleanups = [];
  if (PREVIEW) return;
  const popups = (state.cfg.design.blocks || []).filter((b) => b.type === 'popup' && b.visible !== false);
  for (const b of popups) {
    if (popupsShown.has(b.id) || b.trigger === 'button') continue;
    const fire = () => { if (popupsShown.has(b.id)) return; popupsShown.add(b.id); openPopupBlock(b.id); };
    if (!b.trigger || b.trigger === 'load') {
      const t = setTimeout(fire, Math.max(0, Number(b.delay) || 3) * 1000);
      popupCleanups.push(() => clearTimeout(t));
    } else if (b.trigger === 'scroll') {
      const onScroll = () => {
        if ((window.scrollY + window.innerHeight) / Math.max(1, document.body.scrollHeight) >= 0.5) {
          window.removeEventListener('scroll', onScroll);
          fire();
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      popupCleanups.push(() => window.removeEventListener('scroll', onScroll));
    } else if (b.trigger === 'exit') {
      const onLeave = (e) => {
        if (e.clientY <= 0) { document.removeEventListener('mouseleave', onLeave); fire(); }
      };
      document.addEventListener('mouseleave', onLeave);
      popupCleanups.push(() => document.removeEventListener('mouseleave', onLeave));
    }
  }
}

// ---------- Eventos ----------
document.addEventListener('click', (e) => {
  if (e.target.closest('#overlay-root')) return;
  const qa = e.target.closest('[data-quick-add]');
  if (qa) { e.stopPropagation(); return quickAdd(qa.dataset.quickAdd); }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    navigator.clipboard?.writeText(cp.dataset.copy).catch(() => {});
    toast(`Código "${cp.dataset.copy}" copiado`);
    return;
  }
  const bill = e.target.closest('[data-bill]');
  if (bill) {
    const sec = bill.closest('[data-pricing-block]');
    const mode = bill.dataset.bill;
    sec.querySelectorAll('[data-bill]').forEach((x) => x.classList.toggle('active', x === bill));
    sec.querySelectorAll('.plan-price').forEach((el) => (el.textContent = mode === 'yearly' ? el.dataset.y : el.dataset.m));
    return;
  }
  const pop = e.target.closest('[data-open-popup]');
  if (pop) return openPopupBlock(pop.dataset.openPopup);

  const t = e.target.closest('[data-act],[data-cat],[data-product]');
  if (!t) return;
  if (t.dataset.product) return openProduct(t.dataset.product);
  if (t.dataset.cat) { clearSearchAndSort(); return goToCat(t.dataset.cat); }
  switch (t.dataset.act) {
    case 'menu': return openMenu();
    case 'search':
      state.searchOpen = !state.searchOpen;
      $('.searchbox')?.classList.toggle('open', state.searchOpen);
      if (state.searchOpen) $('#q')?.focus();
      return;
    case 'sort': return openSort();
    case 'filter': return openFilter();
    case 'cart': return openCart();
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-blk-form]');
  if (!form) return;
  e.preventDefault();
  const b = (state.cfg.design.blocks || []).find((x) => x.id === form.dataset.blkForm);
  if (!b) return;
  const lines = [`*${b.title || 'Consulta'}* — ${state.cfg.store.name}`, ''];
  (b.fields || []).forEach((f, fi) => {
    const val = form.querySelector(`[name="f${fi}"]`)?.value.trim() || '';
    if (val) lines.push(`${f.label || `Campo ${fi + 1}`}: ${val}`);
  });
  const num = state.cfg.store.whatsapp;
  if (num && !PREVIEW) window.open(waLink(num, lines.join('\n')), '_blank', 'noopener');
  else toast('¡Formulario enviado!');
  form.reset();
});

let qTimer;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    state.query = e.target.value;
    render();
    const q = $('#q');
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  }, 200);
});

// ---------- Vista previa desde el panel ----------
if (PREVIEW) {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'fm-replay-anim') {
      playIntro(true);
      setupAnimations(true);
      return;
    }
    if (e.data?.type !== 'fm-preview') return;
    const d = e.data;
    if (d.config) state.cfg = withDefaults({ ...state.cfg, ...d.config });
    if (d.categories) state.cats = d.categories;
    if (d.products) state.prods = d.products.filter((p) => !p.hidden);
    render();
  });
}

// ---------- Inicio ----------
async function start() {
  try {
    await loadAll();
    render();
  } catch (err) {
    console.error(err);
    $('#app').innerHTML = '<p class="empty">No pudimos cargar la tienda. Revisa tu conexión y vuelve a intentarlo.</p>';
    return;
  }
  if (PREVIEW) {
    window.parent?.postMessage({ type: 'fm-preview-ready' }, location.origin);
    return;
  }
  if (!sessionStorage.getItem('fm-visit')) {
    sessionStorage.setItem('fm-visit', '1');
    sb.rpc('register_visit').then(() => {}, () => {});
  }
  // Cambios en vivo desde el panel
  let t;
  const reload = () => { clearTimeout(t); t = setTimeout(() => loadAll().then(render).catch(() => {}), 400); };
  sb.channel('store')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_config' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, reload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, reload)
    .subscribe();
}
start();
