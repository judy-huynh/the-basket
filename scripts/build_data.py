#!/usr/bin/env python3
"""Rebuild data/basket.json from the two public sources. No API keys required.

    python3 scripts/build_data.py

Sources
  1. NYC DOHMH food pricing survey, 163 supermarkets, March-August 2019.
     https://github.com/nychealth/food-pricing-survey-nyc-2019
  2. US BLS average price series, for the 2019-to-latest change per item.
     https://api.bls.gov/publicAPI/v2/
"""
import csv, io, json, os, urllib.request, statistics
from datetime import date

SURVEY = ("https://raw.githubusercontent.com/nychealth/"
          "food-pricing-survey-nyc-2019/main/Cleaned_Pricing_data_imputed_final.csv")
BLS = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "basket.json")

# Each surveyed item, paired with the BLS series whose product spec matches it.
# The spec match is the whole point: the survey priced 90% lean ground beef and
# whole wheat bread, not the generic series. Getting this wrong moves the
# projection by several percent.
ITEMS = [
    ("beef",         "beef_price_1lb_imp",         "APU0000703113", "Ground beef, lean and extra lean, per lb", "1 lb, 90% lean, prepackaged", True),
    ("bread",        "bread_price_loaf_imp",       "APU0000702212", "Bread, whole wheat, per lb",               "1 loaf, whole wheat",         True),
    ("milk",         "milk_price_imp",             "APU0000709112", "Milk, whole, per gal",                     "1/2 gallon, 1% fat",          False),
    ("eggs",         "eggs_price_imp",             "APU0000708111", "Eggs, grade A large, per doz",             "1 dozen, large",              True),
    ("potato",       "potato_price_imp",           "APU0000712112", "Potatoes, white, per lb",                  "1 lb, russet",                True),
    ("lettuce",      "lettuce_price_imp",          "APU0000712211", "Lettuce, romaine, per lb",                 "1 head, romaine",             True),
    ("strawberries", "strawberries_price_imp",     "APU0000711415", "Strawberries, dry pint",                   "1 dry pint",                  True),
    ("tomato",       "tomato_price_imp",           "APU0000712311", "Tomatoes, field grown, per lb",            "1 lb",                        True),
    ("orange",       "orange_price_imp",           "APU0000711311", "Oranges, navel, per lb",                   "1 lb, navel",                 True),
    ("banana",       "banana_price_imp",           "APU0000711211", "Bananas, per lb",                          "1 lb",                        True),
]
# Survey ran March-August 2019. The inflation base must be that window, not the
# calendar year, or the factor is measured from the wrong starting point.
BASE_MONTHS = {"M03", "M04", "M05", "M06", "M07", "M08"}


def fetch(url, data=None):
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("User-Agent", "the-basket/1.0 (+https://github.com/judy-huynh/the-basket)")
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def bls_factors():
    ids = [i[2] for i in ITEMS]
    body = json.dumps({"seriesid": ids, "startyear": "2019", "endyear": str(date.today().year)}).encode()
    doc = json.loads(fetch(BLS, body))
    if doc.get("status") != "REQUEST_SUCCEEDED":
        raise SystemExit(f"BLS request failed: {doc.get('status')} {doc.get('message')}")
    def num(r):
        # BLS writes "-" for a suppressed or unpublished month. Parsing that as a
        # number is how a suppressed value becomes a silent zero.
        try:
            return float(r["value"])
        except (ValueError, TypeError):
            return None

    out = {}
    for s in doc["Results"]["series"]:
        rows = [r for r in s["data"] if r["period"].startswith("M") and num(r) is not None]
        base = [num(r) for r in rows
                if r["year"] == "2019" and r["period"] in BASE_MONTHS]
        latest = sorted((r["year"], r["period"], num(r)) for r in rows)
        if not base or not latest:
            raise SystemExit(f"BLS series {s['seriesID']} is missing data; check the series id")
        b = sum(base) / len(base)
        y, p, v = latest[-1]
        out[s["seriesID"]] = {"base_2019": round(b, 4), "latest": round(v, 4),
                              "latest_period": f"{y}-{p}", "factor": round(v / b, 5)}
    return out


def main():
    rows = list(csv.DictReader(io.StringIO(fetch(SURVEY).decode("utf-8-sig"))))
    fac = bls_factors()

    stores, dropped = [], 0
    for r in rows:
        try:
            lat, lon = float(r["latitude"]), float(r["longitude"])
        except (ValueError, KeyError):
            dropped += 1
            continue
        prices, proj = {}, {}
        ok = True
        for key, col, series, _label, _spec, _match in ITEMS:
            try:
                v = float(r[col])
            except (ValueError, KeyError):
                ok = False
                break
            prices[key] = round(v, 2)
            proj[key] = round(v * fac[series]["factor"], 2)
        if not ok:
            dropped += 1
            continue
        stores.append({
            "id": r["StoreID"], "name": r["StoreName"].strip(),
            "addr": r["StoreAddress"].strip(), "boro": r["BoroName"].title(),
            "zip": r["ZIPcode"], "lat": lat, "lon": lon,
            "imputed": int(float(r.get("missingvalues") or 0)),
            "p19": prices, "p26": proj,
            "b19": round(sum(prices.values()), 2), "b26": round(sum(proj.values()), 2),
        })

    b19 = sorted(s["b19"] for s in stores)
    b26 = sorted(s["b26"] for s in stores)
    doc = {
        "generated": date.today().isoformat(),
        "n_stores": len(stores),
        "dropped": dropped,
        "items": [{"key": k, "spec": spec, "series": sid, "series_label": lab,
                   "factor": fac[sid]["factor"], "base_2019": fac[sid]["base_2019"],
                   "latest": fac[sid]["latest"], "latest_period": fac[sid]["latest_period"],
                   "spec_match": match}
                  for k, _c, sid, lab, spec, match in ITEMS],
        "summary": {
            "b19": {"min": b19[0], "median": round(statistics.median(b19), 2), "max": b19[-1]},
            "b26": {"min": b26[0], "median": round(statistics.median(b26), 2), "max": b26[-1]},
        },
        "stores": stores,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(doc, f, separators=(",", ":"))
    print(f"wrote {OUT}")
    print(f"  {len(stores)} stores, {dropped} dropped")
    print(f"  2019   min ${doc['summary']['b19']['min']}  median ${doc['summary']['b19']['median']}  max ${doc['summary']['b19']['max']}")
    print(f"  2026*  min ${doc['summary']['b26']['min']}  median ${doc['summary']['b26']['median']}  max ${doc['summary']['b26']['max']}")
    print(f"  BLS latest period: {doc['items'][0]['latest_period']}")


if __name__ == "__main__":
    main()
