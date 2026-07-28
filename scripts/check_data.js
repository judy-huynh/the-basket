const D = require('../data/basket.json');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };

// Reconstruct the exact GeoJSON the app builds, and validate it
const feats = D.stores.map(function (s) {
  return { type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    properties: { id: s.id, name: s.name, zip: s.zip, boro: s.boro,
                  b19: s.b19, b26: s.b26, d: Number((s.b26 - s.b19).toFixed(2)) } };
});
const fc = { type: 'FeatureCollection', features: feats };

console.log('GeoJSON the map builds:');
ok(fc.features.length === 163, `163 features (${fc.features.length})`);
ok(fc.features.every(f => f.geometry.coordinates.length === 2), 'every geometry has 2 coordinates');
ok(fc.features.every(f => { const [x, y] = f.geometry.coordinates;
     return x > -74.3 && x < -73.6 && y > 40.4 && y < 40.95; }), 'all coordinates inside NYC bounds');
ok(fc.features.every(f => f.geometry.coordinates.every(Number.isFinite)), 'no NaN coordinates');
ok(!fc.features.some(f => f.geometry.coordinates[0] === 0 && f.geometry.coordinates[1] === 0), 'no null island');
ok(fc.features.every(f => Number.isFinite(f.properties.b19) && f.properties.b19 > 0), 'every b19 positive finite');
ok(fc.features.every(f => f.properties.b26 > f.properties.b19), 'every projected price exceeds its 2019 price');

console.log('\nItem factors:');
ok(D.items.length === 10, `10 items (${D.items.length})`);
ok(D.items.every(i => i.factor > 1 && i.factor < 2.5), 'all factors within a sane 1.0-2.5 range');
// Corrected 2026-07-27 after re-reading the raw survey wording: the survey priced
// VINE tomatoes (BLS tracks field grown) and a 1 LB CONTAINER of strawberries
// (BLS tracks a dry pint). Product mismatches are milk and tomato.
ok(D.items.filter(i => !i.product_match).length === 2, `2 product mismatches, milk and tomato (${D.items.filter(i => !i.product_match).map(i=>i.key).join(', ')})`);
ok(D.items.filter(i => i.unit_note).length === 5, `5 items carry a unit-basis note (${D.items.filter(i=>i.unit_note).length})`);

console.log('\nBasket arithmetic (sum of items must equal the stored total):');
const bad19 = D.stores.filter(s => Math.abs(Object.values(s.p19).reduce((a,b)=>a+b,0) - s.b19) > 0.011);
const bad26 = D.stores.filter(s => Math.abs(Object.values(s.p26).reduce((a,b)=>a+b,0) - s.b26) > 0.011);
ok(bad19.length === 0, `b19 equals sum of its 10 items for all stores (${bad19.length} mismatches)`);
ok(bad26.length === 0, `b26 equals sum of its 10 items for all stores (${bad26.length} mismatches)`);
ok(Object.keys(D.stores[0].p19).length === 10, 'each store carries exactly 10 item prices');

console.log('\nHeadline numbers quoted in the README:');
const v19 = D.stores.map(s=>s.b19).sort((a,b)=>a-b), v26 = D.stores.map(s=>s.b26).sort((a,b)=>a-b);
const med = a => a[Math.floor(a.length/2)];
ok(v19[0] === 16.2, `2019 min $16.20 (${v19[0]})`);
ok(med(v19) === 22.82, `2019 median $22.82 (${med(v19)})`);
ok(v19[v19.length-1] === 35.11, `2019 max $35.11 (${v19[v19.length-1]})`);
ok(Math.abs(med(v26) - 32.45) < 0.02, `2026 median $32.45 (${med(v26).toFixed(2)})`);
const g19 = +(v19[v19.length-1]-v19[0]).toFixed(2), g26 = +(v26[v26.length-1]-v26[0]).toFixed(2);
ok(Math.abs(g19 - 18.91) < 0.02, `2019 spread $18.91 (${g19})`);
ok(Math.abs(g26 - 26.54) < 0.03, `2026 spread $26.54 (${g26})`);
ok(Math.abs(g19*52 - 984) < 2, `annualized 2019 $984 (${Math.round(g19*52)})`);
ok(Math.abs(g26*52 - 1380) < 3, `annualized 2026 $1,380 (${Math.round(g26*52)})`);

console.log(fail === 0 ? '\nALL CHECKS PASS' : `\n${fail} CHECK(S) FAILED`);
process.exit(fail ? 1 : 0);
