// ===== FlowyMarket: tienda pública =====
import {
  sb, esc, money, moneyText, safeUrl, safeLink, withDefaults, applyTheme, ORDER_TYPES, ADDRESS_FIELDS,
  orderErrorMessage, waLink, validSelection,
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

function thumbHtml(p) {
  const src = safeUrl(p?.img);
  return `<div class="thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ICON.tag}</div>`;
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

function renderHero() {
  const { store, design } = state.cfg;
  const img = safeUrl(design.hero.image);
  const ov = Math.min(Math.max(Number(design.hero.overlay) || 0, 0), 90) / 100;
  const logo = safeUrl(store.logo);
  return `<header class="hero ${img ? 'has-image' : ''} ${design.hero.tint === 'light' ? 'tint-light' : ''}"
      style="${img ? `background-image:url('${esc(img)}');` : ''}--ov:${img ? ov : 0}">
    ${logo ? `<img class="hero-logo" src="${esc(logo)}" alt="">` : ''}
    <h1>${esc(store.name)}</h1>
    ${store.description ? `<p>${esc(store.description)}</p>` : ''}
  </header>`;
}

function renderCatalog() {
  const layout = state.cfg.design.layout === 'grid' ? 'grid' : 'list';
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
    return `<button class="card ${soldout ? 'soldout' : ''}" data-product="${esc(p.id)}">
      ${thumbHtml(p)}
      <div class="card-body">
        <h3>${esc(p.title)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ''}
        <div class="price">${priceHtml(p)}</div>
      </div>
      ${soldout ? '<span class="badge gray">Agotado</span>' : p.offer != null && Number(p.offer) < Number(p.price) ? '<span class="badge">Oferta</span>' : ''}
    </button>`;
  };

  return `<section class="catalog" id="catalog">
    <div class="catbar">
      <div class="catbar-row">
        <button class="icon-btn" data-act="menu" aria-label="Categorías">${ICON.menu}</button>
        <button class="icon-btn" data-act="search" aria-label="Buscar">${ICON.search}</button>
        <nav class="chips" aria-label="Categorías">
          ${chips.map((c) => `<button class="chip ${c.id === active ? 'active' : ''}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('')}
        </nav>
      </div>
      <div class="searchbox ${state.searchOpen || state.query ? 'open' : ''}">
        <input type="search" id="q" placeholder="Buscar productos…" value="${esc(state.query)}" autocomplete="off">
      </div>
      <div class="tools">
        <button class="pill ${state.sort !== 'default' ? 'on' : ''}" data-act="sort">${ICON.sort} Ordenar</button>
        <button class="pill ${filtersOn ? 'on' : ''}" data-act="filter">${ICON.filter} Filtrar</button>
      </div>
    </div>
    ${groups.length ? groups.map((g) => `
      <div class="cat-section" id="cat-${esc(g.id)}" data-section="${esc(g.id)}">
        ${g.name ? `<h2 class="cat-title">${esc(g.name)}</h2>` : ''}
        <div class="products ${layout}">${g.items.map(card).join('')}</div>
      </div>`).join('') : '<p class="empty">No encontramos productos.</p>'}
  </section>`;
}

function renderBlock(b) {
  if (b.visible === false) return '';
  switch (b.type) {
    case 'hero': return renderHero();
    case 'catalog': return renderCatalog();
    case 'text': return b.content ? `<section class="block-text">${esc(b.content)}</section>` : '';
    case 'image': {
      const src = safeUrl(b.image);
      if (!src) return '';
      const img = `<img src="${esc(src)}" alt="${esc(b.alt || '')}" loading="lazy">`;
      const href = safeLink(b.link);
      return `<section class="block-image">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${img}</a>` : img}</section>`;
    }
    case 'whatsapp': {
      const num = state.cfg.store.whatsapp;
      if (!num) return '';
      return `<section class="block-wa"><a class="btn wa" href="${esc(waLink(num, b.message || 'Hola! Tengo una consulta'))}" target="_blank" rel="noopener">${ICON.wa} ${esc(b.label || 'Escríbenos por WhatsApp')}</a></section>`;
    }
    case 'divider': return '<div class="block-divider"></div>';
    default: return '';
  }
}

function render() {
  const { store, design, checkout } = state.cfg;
  applyTheme(design);
  document.title = store.name || 'Tienda';
  const bgImg = design.background.type === 'image' ? safeUrl(design.background.image) : '';
  document.body.classList.toggle('has-bg-image', !!bgImg);
  document.body.style.backgroundImage = bgImg
    ? `linear-gradient(rgba(${design.background.tint === 'light' ? '255,255,255' : '0,0,0'},${(Number(design.background.overlay) || 0) / 100}),rgba(${design.background.tint === 'light' ? '255,255,255' : '0,0,0'},${(Number(design.background.overlay) || 0) / 100})),url('${bgImg.replace(/'/g, '%27')}')`
    : '';

  const blocks = design.blocks || [];
  const showCart = blocks.some((b) => b.type === 'cart' && b.visible !== false);
  const scroll = window.scrollY;
  $('#app').innerHTML = `
    ${PREVIEW ? '<div class="banner-preview">Vista previa · los cambios aún no están publicados</div>' : ''}
    ${checkout.paused ? '<div class="banner-paused">La tienda no está recibiendo pedidos en este momento.</div>' : ''}
    <div class="page">
      ${blocks.map(renderBlock).join('')}
      <footer class="footer">© ${new Date().getFullYear()} ${esc(store.name)}</footer>
    </div>
    ${showCart && cartCount() > 0 ? `<button class="cart-fab" data-act="cart" aria-label="Ver carrito">${ICON.cart}<span class="count">${cartCount()}</span></button>` : ''}`;
  window.scrollTo(0, scroll);
  setupScrollSpy();
}

function updateCartFab(bump) {
  const blocks = state.cfg.design.blocks || [];
  const showCart = blocks.some((b) => b.type === 'cart' && b.visible !== false);
  let fab = $('.cart-fab');
  if (!showCart || cartCount() === 0) { fab?.remove(); return; }
  if (!fab) {
    $('#app').insertAdjacentHTML('beforeend', `<button class="cart-fab" data-act="cart" aria-label="Ver carrito">${ICON.cart}<span class="count"></span></button>`);
    fab = $('.cart-fab');
  }
  fab.querySelector('.count').textContent = cartCount();
  if (bump) { fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump'); }
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

  openSheet(html, {
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
  openSheet(`${head('Tu pedido')}
    <div class="sheet-body">${lines}
      <div class="totals"><div class="grand"><span>Subtotal</span><span>${money(cartSubtotal(), cur())}</span></div></div>
      <p class="muted">El envío, los impuestos y los descuentos se calculan al confirmar.</p>
    </div>
    <div class="sheet-foot"><button class="btn block" data-checkout ${state.cfg.checkout.paused ? 'disabled' : ''}>Continuar</button></div>`, {
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

  openSheet(html, {
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

// ---------- Eventos ----------
document.addEventListener('click', (e) => {
  if (e.target.closest('#overlay-root')) return;
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
    if (e.origin !== location.origin || e.data?.type !== 'fm-preview') return;
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
