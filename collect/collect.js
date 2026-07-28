/* Field sheet. Ten rows, tap and type. Everything else is an exception hidden
   behind one button, because the common case in an aisle is "found it, this is
   the price" and every extra tap on that path is a tax paid ten times a store.

   No account, no network, no upload. localStorage only, so a locked phone or a
   dead signal in a basement supermarket costs nothing. */
'use strict';

// Short labels for scanning, and the spec the 2019 surveyor was held to.
const ITEMS = [
  { key: 'beef',         name: 'Ground beef',  spec: '1 lb, 90% lean, prepackaged' },
  { key: 'bread',        name: 'Bread',        spec: '1 loaf, whole wheat' },
  { key: 'milk',         name: 'Milk',         spec: '1/2 gallon, 1% fat' },
  { key: 'eggs',         name: 'Eggs',         spec: '1 dozen, large' },
  { key: 'potato',       name: 'Potatoes',     spec: '1 lb, russet' },
  { key: 'lettuce',      name: 'Lettuce',      spec: '1 head, romaine' },
  { key: 'strawberries', name: 'Strawberries', spec: '1 lb container' },
  { key: 'tomato',       name: 'Tomatoes',     spec: '1 lb, vine' },
  { key: 'orange',       name: 'Oranges',      spec: '1 lb, navel' },
  { key: 'banana',       name: 'Bananas',      spec: '1 lb' },
];

const KEY = 'thebasket.fieldsheet.v1';
const $ = (s) => document.querySelector(s);
const blank = () => ({ store: '', zip: '', date: new Date().toISOString().slice(0, 10), items: {} });

let state = load();

function load() {
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.items) return r; } catch (e) {}
  return blank();
}
const persist = () => localStorage.setItem(KEY, JSON.stringify(state));

const get = (k) => (state.items[k] = state.items[k] || {});
const answered = (k) => {
  const v = state.items[k] || {};
  return v.status === 'not_sold' || Number(v.price) > 0;
};

/* Build once. Re-rendering the whole list on every keystroke would steal focus
   from the field being typed into, which on a phone closes the keypad. */
function build() {
  $('#list').innerHTML = ITEMS.map((it, i) => `
    <li id="li-${it.key}">
      <div class="row">
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <span class="lab"><b>${it.name}</b><span>${it.spec}</span></span>
        <span class="price"><input type="text" inputmode="decimal" placeholder="0.00"
          aria-label="${it.name} price" data-price="${it.key}" enterkeyhint="next"></span>
        <button class="more" type="button" data-more="${it.key}"
          aria-expanded="false" aria-label="More options for ${it.name}">&#8943;</button>
      </div>
      <div class="extra" id="x-${it.key}">
        <button type="button" data-flag="sub"      data-k="${it.key}">Substitute</button>
        <button type="button" data-flag="not_sold" data-k="${it.key}">Not sold</button>
        <button type="button" data-flag="sale"     data-k="${it.key}">On sale</button>
        <input type="text" placeholder="What was it instead?" data-alt="${it.key}">
      </div>
    </li>`).join('');

  ITEMS.forEach((it) => {
    const v = state.items[it.key] || {};
    const el = $(`[data-price="${it.key}"]`);
    if (v.price) el.value = v.price;
    const alt = $(`[data-alt="${it.key}"]`);
    if (v.alt) alt.value = v.alt;
    paintRow(it.key);
  });
}

/** Update one row's classes and its exception buttons. Never touches inputs. */
function paintRow(k) {
  const v = state.items[k] || {};
  const li = $(`#li-${k}`);
  li.classList.toggle('filled', Number(v.price) > 0);
  li.classList.toggle('skip', v.status === 'not_sold');
  li.classList.toggle('sub', v.status === 'sub');
  li.classList.toggle('sale', v.sale === true);
  $(`#x-${k}`).querySelectorAll('[data-flag]').forEach((b) => {
    const on = b.dataset.flag === 'sale' ? v.sale === true : v.status === b.dataset.flag;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function tally() {
  const n = ITEMS.filter((i) => answered(i.key)).length;
  $('#count').textContent = `${n}/10`;
  $('#barfill').style.width = (n / ITEMS.length * 100) + '%';
  $('#status').textContent = n === ITEMS.length ? 'All ten recorded' : 'Saves as you go';
  return n;
}

function payload() {
  return {
    schema: 'the-basket/field-sheet/1',
    store: state.store, zip: state.zip, observed_on: state.date,
    protocol: 'NYC DOHMH 2019 food pricing survey, same ten items',
    complete: ITEMS.every((i) => answered(i.key)),
    items: ITEMS.map((it) => {
      const v = state.items[it.key] || {};
      return { key: it.key, spec: it.spec,
               status: v.status || (Number(v.price) > 0 ? 'exact' : null),
               price: Number(v.price) > 0 ? Number(v.price) : null,
               substitute: v.alt || null,
               on_sale: v.sale === undefined ? null : v.sale };
    }),
  };
}

/* ---- events ---- */
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.price !== undefined) {
    get(t.dataset.price).price = t.value.replace(/[^0-9.]/g, '');
    persist(); paintRow(t.dataset.price); tally(); return;
  }
  if (t.dataset.alt !== undefined) { get(t.dataset.alt).alt = t.value; persist(); return; }
  if (t.id === 'store' || t.id === 'zip') { state[t.id] = t.value; persist(); }
});

document.addEventListener('click', (e) => {
  const more = e.target.closest('[data-more]');
  if (more) {
    const x = $(`#x-${more.dataset.more}`);
    const open = x.classList.toggle('open');
    more.setAttribute('aria-expanded', open ? 'true' : 'false');
    return;
  }
  const flag = e.target.closest('[data-flag]');
  if (flag) {
    const k = flag.dataset.k, v = get(k);
    if (flag.dataset.flag === 'sale') v.sale = !v.sale;
    else v.status = v.status === flag.dataset.flag ? undefined : flag.dataset.flag;
    if (v.status === 'not_sold') { v.price = ''; $(`[data-price="${k}"]`).value = ''; }
    persist(); paintRow(k); tally();
  }
});

// Enter moves to the next price field rather than submitting anything.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.dataset.price === undefined) return;
  e.preventDefault();
  const all = [...document.querySelectorAll('[data-price]')];
  const next = all[all.indexOf(e.target) + 1];
  if (next) next.focus(); else e.target.blur();
});

$('#done').addEventListener('click', () => {
  $('#json').value = JSON.stringify(payload(), null, 2);
  $('#out').showModal();
});
$('#close').addEventListener('click', () => $('#out').close());
$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#json').value); $('#copy').textContent = 'Copied'; }
  catch (err) { $('#json').select(); }
  setTimeout(() => { $('#copy').textContent = 'Copy'; }, 1600);
});
$('#dl').addEventListener('click', () => {
  const p = payload();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([$('#json').value], { type: 'application/json' }));
  a.download = ((p.store || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '-' + p.observed_on + '.json';
  a.click(); URL.revokeObjectURL(a.href);
});
$('#new').addEventListener('click', () => {
  const n = ITEMS.filter((i) => answered(i.key)).length;
  if (n && !confirm(`Clear ${n} recorded price${n > 1 ? 's' : ''} and start a new store?`)) return;
  state = blank(); persist();
  $('#store').value = ''; $('#zip').value = '';
  build(); tally(); scrollTo({ top: 0 });
});

$('#store').value = state.store || '';
$('#zip').value = state.zip || '';
build(); tally();
