/* The Basket. Store-level NYC grocery basket prices, 2019 measured and 2026 projected. */
'use strict';

const RAMP = ['--r1', '--r2', '--r3', '--r4', '--r5'];
const WALK_M = 1200;                    // ~15 minutes at a normal pace
const PRESETS = [
  ["Hell's Kitchen", 40.7601, -73.9897], ['Sunset Park', 40.6480, -74.0100],
  ['Bed-Stuy', 40.6800, -73.9500],       ['Jackson Heights', 40.7557, -73.8831],
  ['South Bronx', 40.8140, -73.9230],    ['Upper East Side', 40.7790, -73.9550],
];

const $ = (s) => document.querySelector(s);
const money = (v) => '$' + v.toFixed(2);
const isDark = () => (document.documentElement.dataset.theme || '')
  ? document.documentElement.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;

let DATA, map, view = 'b26', here = null;

/** Great-circle distance in metres. */
function dist(aLat, aLon, bLat, bLon) {
  const R = 6371000, p = Math.PI / 180;
  const dLat = (bLat - aLat) * p, dLon = (bLon - aLon) * p;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const valueOf = (s) => view === 'diff' ? +(s.b26 - s.b19).toFixed(2) : s[view];

function ramp() {
  const cs = getComputedStyle(document.documentElement);
  return RAMP.map((v) => cs.getPropertyValue(v).trim());
}

function paint() {
  const vals = DATA.stores.map(valueOf);
  const lo = Math.min(...vals), hi = Math.max(...vals), cols = ramp();
  // Five equal-width bins across the range, matching the legend swatches.
  const stops = [];
  for (let i = 0; i < 5; i++) stops.push(lo + (hi - lo) * (i / 5), cols[i]);

  map.setPaintProperty('stores', 'circle-color',
    ['step', ['get', view === 'diff' ? 'd' : view], cols[0], ...stops.slice(2)]);
  map.setPaintProperty('stores', 'circle-radius',
    ['interpolate', ['linear'], ['zoom'], 9, 4, 13, 8, 16, 13]);

  $('#lo').textContent = money(lo);
  $('#hi').textContent = money(hi);
  $('#cap').textContent = view === 'b19' ? 'basket price, 2019 measured'
    : view === 'diff' ? 'increase per shop, 2019 to 2026'
    : 'basket price, 2026 projected';
}

/** Cheapest single store vs cheapest split, among stores within walking distance. */
function optimise(lat, lon) {
  const near = DATA.stores
    .map((s) => ({ s, m: dist(lat, lon, s.lat, s.lon) }))
    .filter((o) => o.m <= WALK_M)
    .sort((a, b) => a.m - b.m);
  if (!near.length) return { near };

  const key = view === 'b19' ? 'p19' : 'p26';
  const tot = (o) => (view === 'b19' ? o.s.b19 : o.s.b26);
  const best = near.reduce((a, b) => (tot(b) < tot(a) ? b : a));
  const bestTotal = tot(best);

  // For each item take the cheapest nearby store, then count how many distinct
  // stores that plan actually requires.
  const picks = {};
  DATA.items.forEach(({ key: item }) => {
    let win = null;
    near.forEach((o) => {
      const p = o.s[key][item];
      if (p != null && (win === null || p < win.p)) win = { p, store: o.s };
    });
    if (win) picks[item] = win;
  });
  const splitTotal = Object.values(picks).reduce((t, w) => t + w.p, 0);
  const stops = new Set(Object.values(picks).map((w) => w.store.id));
  return { near, best: best.s, bestTotal, splitTotal, stops: stops.size, picks };
}

function renderNear() {
  const box = $('#near');
  if (!here) return;
  const r = optimise(here.lat, here.lon);
  if (!r.near.length) {
    box.innerHTML = '<div class="empty">No surveyed store within a 15 minute walk of that point. '
      + 'The survey covers 163 of the city\'s 11,472 licensed food retailers, so most places have no dot.</div>';
    return;
  }
  const rows = r.near.slice(0, 6).map(({ s, m }) => `
    <div class="row"><span class="k">${s.name}<br><span class="csub">${s.zip} &middot; ${Math.round(m)} m</span></span>
    <span class="v mono">${money(view === 'b19' ? s.b19 : s.b26)}</span></div>`).join('');

  const save = r.bestTotal - r.splitTotal;
  const band = r.stops > 1 && save > 0.25
    ? `<div class="big"><div class="n mono">${money(save)} a shop</div>
       <div class="c">Splitting the list across ${r.stops} stores beats the cheapest single store
       (${r.best.name}, ${money(r.bestTotal)}). That is ${money(save * 52)} a year, for ${r.stops - 1} extra stop${r.stops > 2 ? 's' : ''}.</div></div>`
    : `<div class="big"><div class="n mono">${money(r.bestTotal)}</div>
       <div class="c">${r.best.name} is the cheapest nearby, and splitting the list would not meaningfully beat it.</div></div>`;

  box.innerHTML = `<div class="csub" style="padding:0 15px 6px">${r.near.length} surveyed store${r.near.length > 1 ? 's' : ''} within a 15 minute walk</div>${rows}${band}`;
}

function renderStats() {
  const k = view === 'b19' ? 'b19' : 'b26';
  const v = DATA.stores.map((s) => s[k]).sort((a, b) => a - b);
  const med = v[Math.floor(v.length / 2)];
  const spread = v[v.length - 1] - v[0];
  $('#stats').innerHTML = `
    <div class="row"><span class="k">Cheapest</span><span class="v mono">${money(v[0])}</span></div>
    <div class="row"><span class="k">Median</span><span class="v mono">${money(med)}</span></div>
    <div class="row"><span class="k">Priciest</span><span class="v mono">${money(v[v.length - 1])}</span></div>
    <div class="row"><span class="k">Cheapest to priciest</span><span class="v mono">${money(spread)}</span></div>
    <div class="big"><div class="n mono">${money(spread * 52)}</div>
      <div class="c">A year's difference between shopping at the cheapest and the priciest store in the sample, at one basket a week.</div></div>`;
}

function renderItems() {
  $('#items').innerHTML = `<thead><tr><th>Item</th><th>As priced</th><th class="n">Change</th></tr></thead><tbody>`
    + DATA.items.map((i) => `<tr><td>${i.key}${i.spec_match ? '' : ' *'}</td><td>${i.spec}</td>
      <td class="n mono">+${((i.factor - 1) * 100).toFixed(1)}%</td></tr>`).join('')
    + `</tbody>`;
}

function setHere(lat, lon, label) {
  here = { lat, lon };
  const src = map.getSource('here');
  src.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
                properties: { label: label || '' } });
  renderNear();
}

function init(data) {
  DATA = data;
  $('#gen').textContent = `Data rebuilt ${data.generated}. BLS series current to ${data.items[0].latest_period}.`;

  // Everything below this point works without the map, so render it first.
  // A basemap that fails to load should cost you the map, not the whole page.
  renderStats(); renderItems();

  // An inline raster style, deliberately. The hosted vector styles pull a
  // sprite sheet and a glyph server, and if either stalls the map never fires
  // 'load' and every layer silently goes missing. Raster tiles have no such
  // dependencies.
  const basemap = isDark() ? 'dark_all' : 'light_all';
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: { base: {
        type: 'raster',
        tiles: ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/${basemap}/{z}/{x}/{y}{ratio}.png`.replace('{ratio}', devicePixelRatio > 1 ? '@2x' : '')),
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      } },
      layers: [{ id: 'base', type: 'raster', source: 'base' }],
    },
    center: [-73.94, 40.72], zoom: 10.1, attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  // A map that fails should say so. Without this the container is just a white
  // rectangle and there is no way to tell a stalled basemap from a code error.
  let painted = false;
  map.on('idle', () => { painted = true; });
  setTimeout(() => {
    if (painted) return;
    const why = document.hidden
      ? 'This tab was in the background while the page loaded, so the browser paused rendering. Reload with the tab in front.'
      : 'The basemap tiles did not finish loading. The store data below is unaffected.';
    const el = document.getElementById('map');
    if (el && !el.dataset.warned) {
      el.dataset.warned = '1';
      el.insertAdjacentHTML('afterbegin',
        `<div style="position:absolute;inset:12px;z-index:2;background:var(--panel);border:1px solid var(--rule);
          border-radius:5px;padding:16px;font-size:13.5px;color:var(--ink-2);max-width:420px;height:max-content">
          <b style="color:var(--ink)">The map did not draw.</b><br>${why}</div>`);
    }
  }, 9000);

  map.on('error', (e) => {
    const msg = (e && e.error && e.error.message) || 'unknown map error';
    const bar = document.querySelector('.legend');
    if (bar && !bar.dataset.err) { bar.dataset.err = '1'; bar.insertAdjacentHTML('beforeend', `<span style="color:var(--s26)">map: ${msg}</span>`); }
  });

  // 'style.load', not 'load'. The 'load' event waits for a completed render
  // pass, and browsers suspend requestAnimationFrame in background tabs, so a
  // page opened in a background tab would reach the foreground with a basemap
  // and no store data on it. 'style.load' only needs the style parsed.
  map.on('style.load', () => {
    map.addSource('stores', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: DATA.stores.map((s) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { id: s.id, name: s.name, zip: s.zip, boro: s.boro,
                      b19: s.b19, b26: s.b26, d: +(s.b26 - s.b19).toFixed(2) },
      })) },
    });
    map.addSource('here', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({ id: 'stores', type: 'circle', source: 'stores',
      paint: { 'circle-stroke-width': 1.2, 'circle-stroke-color': isDark() ? '#181C22' : '#fff', 'circle-opacity': .92 } });
    map.addLayer({ id: 'here-ring', type: 'circle', source: 'here',
      paint: { 'circle-radius': 9, 'circle-color': 'transparent',
               'circle-stroke-width': 2.5, 'circle-stroke-color': isDark() ? '#EDEFF2' : '#15181C' } });

    paint();

    const pop = new maplibregl.Popup({ closeButton: false, offset: 12 });
    map.on('mouseenter', 'stores', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const p = e.features[0].properties;
      pop.setLngLat(e.features[0].geometry.coordinates).setHTML(
        `<div class="pop"><b>${p.name}</b><span class="z">${p.boro} ${p.zip}</span>
         <div class="pr"><span>2019 measured</span><b class="mono">${money(+p.b19)}</b></div>
         <div class="pr"><span>2026 projected</span><b class="mono">${money(+p.b26)}</b></div></div>`
      ).addTo(map);
    });
    map.on('mouseleave', 'stores', () => { map.getCanvas().style.cursor = ''; pop.remove(); });
    map.on('click', (e) => { if (!map.queryRenderedFeatures(e.point, { layers: ['stores'] }).length) setHere(e.lngLat.lat, e.lngLat.lng); });
  });

  $('#presets').innerHTML = PRESETS.map(([n], i) => `<button type="button" data-i="${i}">${n}</button>`).join('');
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const [n, lat, lon] = PRESETS[+b.dataset.i];
    map.easeTo({ center: [lon, lat], zoom: 13.4 }); setHere(lat, lon, n);
  });
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); view = b.dataset.v;
    paint(); renderStats(); renderNear();
  }));
}

fetch('data/basket.json')
  .then((r) => { if (!r.ok) throw new Error(`basket.json returned ${r.status}`); return r.json(); })
  .then(init)
  .catch((err) => {
    document.getElementById('map').innerHTML =
      `<div class="empty" style="padding:40px">Could not load the price data: ${err.message}</div>`;
  });
