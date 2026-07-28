/* Field sheet. Records the same ten items the 2019 DOHMH survey priced, using
   the survey's own wording, so a submission is comparable to the baseline.
   Everything is kept in localStorage: no account, no network, no data leaves
   the phone until you export it. That also means a dropped signal in a
   basement supermarket costs you nothing. */
'use strict';

// Wording taken from the survey's raw data dictionary, so a contributor is
// answering the same question a DOHMH surveyor answered.
const ITEMS = [
  { key: 'beef',         spec: '1 lb prepackaged 90% lean ground beef',
    ask: 'Is prepackaged 90% lean ground beef sold by the pound here?' },
  { key: 'bread',        spec: '1 loaf of whole wheat bread',
    ask: 'Is whole wheat bread sold by the loaf here?' },
  { key: 'milk',         spec: '1/2 gallon of 1% fat milk',
    ask: 'Is 1% fat milk available in a half gallon?' },
  { key: 'eggs',         spec: '1 dozen large eggs',
    ask: 'Are large eggs sold by the dozen here?' },
  { key: 'potato',       spec: '1 lb of russet potatoes',
    ask: 'Are russet potatoes sold by the pound here?' },
  { key: 'lettuce',      spec: '1 head of romaine lettuce',
    ask: 'Is one head of romaine lettuce available?' },
  { key: 'strawberries', spec: '1 lb container of strawberries',
    ask: 'Are strawberries sold in a 1 lb container here?' },
  { key: 'tomato',       spec: '1 lb of vine tomatoes',
    ask: 'Are vine tomatoes sold by the pound here?' },
  { key: 'orange',       spec: '1 lb of navel oranges',
    ask: 'Are navel oranges available and priced by the pound?' },
  { key: 'banana',       spec: '1 lb of bananas',
    ask: 'Are bananas sold by the pound here?' },
];

const KEY = 'thebasket.fieldsheet.v1';
const $ = (s) => document.querySelector(s);
const blank = () => ({ store: '', addr: '', zip: '', date: new Date().toISOString().slice(0, 10), items: {} });

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.items) return raw;
  } catch (e) { /* corrupt or absent, start clean */ }
  return blank();
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  $('#saved').textContent = 'saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  render();
}

/** An item counts as answered once its status is set, and if priced, has a price. */
function answered(k) {
  const v = state.items[k];
  if (!v || !v.status) return false;
  return v.status === 'not_sold' ? true : Number(v.price) > 0;
}

function renderItems() {
  $('#items').innerHTML = ITEMS.map((it, n) => {
    const v = state.items[it.key] || {};
    const priced = v.status === 'exact' || v.status === 'alt';
    return `
    <div class="item ${answered(it.key) ? 'done' : ''}" id="card-${it.key}">
      <h3><span class="num">${String(n + 1).padStart(2, '0')}</span> ${it.key}</h3>
      <div class="spec">${it.spec}</div>
      <div class="ask">${it.ask}</div>
      <div class="opts" data-k="${it.key}">
        <button type="button" data-s="exact"    aria-pressed="${v.status === 'exact'}">Found it, exactly</button>
        <button type="button" data-s="alt"      aria-pressed="${v.status === 'alt'}">Only a substitute</button>
        <button type="button" data-s="not_sold" aria-pressed="${v.status === 'not_sold'}">Not sold here</button>
      </div>
      <div class="${priced ? '' : 'hidden'}">
        <div class="priceline">
          <span class="dollar">$</span>
          <input type="text" inputmode="decimal" placeholder="0.00" data-price="${it.key}" value="${v.price || ''}">
        </div>
        <div class="alt ${v.status === 'alt' ? '' : 'hidden'}">
          <input type="text" placeholder="What was it instead? brand, size, type" data-alt="${it.key}" value="${v.alt || ''}">
        </div>
        <div class="opts" style="margin-top:9px" data-sale="${it.key}">
          <button type="button" data-v="1" aria-pressed="${v.sale === true}">On sale</button>
          <button type="button" data-v="0" aria-pressed="${v.sale === false}">Regular price</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderOut() {
  const done = ITEMS.filter((i) => answered(i.key)).length;
  $('#prog').textContent = `${done} of ${ITEMS.length}`;
  const payload = {
    schema: 'the-basket/field-sheet/1',
    store: state.store, address: state.addr, zip: state.zip,
    observed_on: state.date,
    protocol: 'NYC DOHMH 2019 food pricing survey, same ten items and wording',
    complete: done === ITEMS.length,
    items: ITEMS.map((it) => {
      const v = state.items[it.key] || {};
      return { key: it.key, spec: it.spec, status: v.status || null,
               price: v.price ? Number(v.price) : null,
               substitute: v.alt || null,
               on_sale: v.sale === undefined ? null : v.sale };
    }),
  };
  $('#json').value = JSON.stringify(payload, null, 2);
  return payload;
}

function render() { renderItems(); renderOut(); }

// ---- events, delegated so re-rendering never loses a handler
document.addEventListener('click', (e) => {
  const opt = e.target.closest('.opts[data-k] button');
  if (opt) {
    const k = opt.parentElement.dataset.k;
    state.items[k] = Object.assign({}, state.items[k], { status: opt.dataset.s });
    if (opt.dataset.s === 'not_sold') { delete state.items[k].price; delete state.items[k].alt; }
    return save();
  }
  const sale = e.target.closest('.opts[data-sale] button');
  if (sale) {
    const k = sale.parentElement.dataset.sale;
    state.items[k] = Object.assign({}, state.items[k], { sale: sale.dataset.v === '1' });
    return save();
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.price !== undefined) {
    // Keep the raw string in state so a half-typed "3." is not destroyed, and
    // never re-render this field while it has focus.
    state.items[t.dataset.price] = Object.assign({}, state.items[t.dataset.price], { price: t.value.replace(/[^0-9.]/g, '') });
    localStorage.setItem(KEY, JSON.stringify(state)); renderOut(); return;
  }
  if (t.dataset.alt !== undefined) {
    state.items[t.dataset.alt] = Object.assign({}, state.items[t.dataset.alt], { alt: t.value });
    localStorage.setItem(KEY, JSON.stringify(state)); renderOut(); return;
  }
  if (['store', 'addr', 'zip', 'date'].includes(t.id)) {
    state[t.id === 'addr' ? 'addr' : t.id] = t.value;
    localStorage.setItem(KEY, JSON.stringify(state)); renderOut();
  }
});

$('#jump').addEventListener('click', () => {
  const next = ITEMS.find((i) => !answered(i.key));
  const el = document.getElementById('card-' + (next ? next.key : ITEMS[ITEMS.length - 1].key));
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#json').value); $('#copy').textContent = 'Copied'; }
  catch (e) { $('#json').select(); $('#copy').textContent = 'Select and copy'; }
  setTimeout(() => { $('#copy').textContent = 'Copy JSON'; }, 1800);
});

$('#dl').addEventListener('click', () => {
  const p = renderOut();
  const name = (p.store || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + p.observed_on + '.json';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([$('#json').value], { type: 'application/json' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
});

$('#reset').addEventListener('click', () => {
  const done = ITEMS.filter((i) => answered(i.key)).length;
  if (done && !confirm(`Clear ${done} recorded item${done > 1 ? 's' : ''} and start a new store?`)) return;
  state = blank(); save(); scrollTo({ top: 0, behavior: 'smooth' });
});

// restore the header fields, then draw
['store', 'addr', 'zip', 'date'].forEach((k) => { $('#' + k).value = state[k] || ''; });
render();
