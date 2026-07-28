#!/usr/bin/env python3
"""Build data/transparency.json: who can find out what food costs before they shop.

    python3 scripts/build_transparency.py

The question is not what groceries cost. It is whether the price is knowable at
all without physically walking into the store.

Method, and its one big assumption:

  A store can only publish prices online if it has the infrastructure to do so,
  and in practice that means belonging to a chain. A single-location bodega does
  not run a shoppable catalog. So chain membership is used as a PROXY for the
  possibility of price transparency. It is an upper bound, not a measurement:
  plenty of chains publish nothing useful either (see docs/price-transparency.md).

Sources, both public, no API key:
  NY State Ag & Markets retail food store registry (data.ny.gov 9a8c-vfzj)
  NYC DOHMH ZCTA indicators, published with the 2019 food pricing survey
"""
import collections, csv, io, json, os, re, statistics, urllib.request
from datetime import date

STORES = ("https://data.ny.gov/resource/9a8c-vfzj.json"
          "?$where=county%20in('NEW%20YORK','KINGS','QUEENS','BRONX','RICHMOND')&$limit=15000")
INDICATORS = ("https://raw.githubusercontent.com/nychealth/food-pricing-survey-nyc-2019/"
              "main/Neighborhood%20indicators_final.csv")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "transparency.json")

CHAIN_MIN = 3      # a name at 3+ NYC locations counts as a chain
MIN_STORES = 10    # ZIPs with fewer stores are too noisy to rank


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "the-basket/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def normalise(name):
    """Collapse store-name variants so 'C-Town #45' and 'C TOWN' are one chain."""
    n = (name or "").upper()
    n = re.sub(r"[^A-Z0-9 &]", " ", n)
    n = re.sub(r"\b(INC|LLC|CORP|LTD)\b", " ", n)
    n = re.sub(r"\s*#?\s*\d{2,}\s*$", "", n)
    return re.sub(r"\s+", " ", n).strip()


def pearson(a, b):
    ma, mb = statistics.mean(a), statistics.mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = (sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b)) ** .5
    return round(num / den, 4) if den else 0.0


def main():
    stores = json.loads(fetch(STORES))
    counts = collections.Counter(normalise(s.get("dba_name")) for s in stores)

    zips = collections.defaultdict(lambda: {"stores": 0, "chain": 0})
    for s in stores:
        z = (s.get("zip_code") or "").strip()[:5]
        if not z.isdigit():
            continue
        row = zips[z]
        row["stores"] += 1
        if counts[normalise(s.get("dba_name"))] >= CHAIN_MIN:
            row["chain"] += 1

    rows = list(csv.DictReader(io.StringIO(fetch(INDICATORS).decode("utf-8-sig"))))
    ind = {}
    for r in rows:
        z = (r.get("zip_code_tabulation_area") or "").strip()
        try:
            ind[z] = {"rent_burdened": float(r["percent_rentburdened"]),
                      "snap": float(r["percent_snap"]),
                      "home_value": float(r["HH_value"]),
                      "owner": float(r["percent_owner"])}
        except (KeyError, TypeError, ValueError):
            continue

    areas = []
    for z, r in sorted(zips.items()):
        if z not in ind or r["stores"] < MIN_STORES:
            continue
        areas.append({"zip": z, "stores": r["stores"], "chain_stores": r["chain"],
                      "chain_share": round(r["chain"] / r["stores"], 4), **ind[z]})

    cs = [a["chain_share"] for a in areas]
    total, chained = sum(r["stores"] for r in zips.values()), sum(r["chain"] for r in zips.values())
    single = sum(1 for n, k in counts.items() if k == 1)

    # Robustness: a correlation that only survives at one arbitrary cut-off is
    # not a finding. Report it across floors so a reader can see it move.
    sensitivity = []
    for floor in (10, 20, 30, 50):
        sub = [a for a in areas if a["stores"] >= floor]
        if len(sub) > 20:
            sensitivity.append({"min_stores": floor, "n_zips": len(sub),
                                "corr_rent_burdened": pearson([a["chain_share"] for a in sub],
                                                              [a["rent_burdened"] for a in sub])})

    doc = {
        "generated": date.today().isoformat(),
        "sensitivity": sensitivity,
        "method": "chain membership (3+ NYC locations) as an upper bound on the "
                  "possibility of online price transparency",
        "citywide": {
            "retailers": total,
            "chain_retailers": chained,
            "chain_share": round(chained / total, 4),
            "distinct_names": len(counts),
            "single_location_names": single,
            "single_location_share_of_stores": round(single / total, 4),
        },
        "correlations": {
            "chain_share_vs_rent_burdened": pearson(cs, [a["rent_burdened"] for a in areas]),
            "chain_share_vs_snap": pearson(cs, [a["snap"] for a in areas]),
            "chain_share_vs_home_value": pearson(cs, [a["home_value"] for a in areas]),
            "n_zips": len(areas),
        },
        "areas": areas,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(doc, open(OUT, "w"), separators=(",", ":"))

    c = doc["citywide"]
    print(f"wrote {OUT}")
    print(f"  {c['retailers']} retailers, {c['chain_share']*100:.1f}% belong to a chain of {CHAIN_MIN}+")
    print(f"  {c['single_location_share_of_stores']*100:.1f}% carry a name used at exactly one location")
    print(f"  {len(areas)} ZIPs analysed")
    for k, v in doc["correlations"].items():
        if k != "n_zips":
            print(f"  {k:34s} {v:+.3f}")
    print("  robustness across floors:", ", ".join(
        f"{x['min_stores']}+:{x['corr_rent_burdened']:+.2f}(n={x['n_zips']})" for x in sensitivity))


if __name__ == "__main__":
    main()
