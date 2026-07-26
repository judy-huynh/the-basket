# The Basket

**What the same ten groceries cost across New York City, store by store.**

Live: https://judy-huynh.github.io/the-basket/

In 2019 the NYC Department of Health and Mental Hygiene sent staff into 163
supermarkets and wrote down the price of ten ordinary items. This maps that
survey at store level, projects each item forward using the matching federal
price series, and answers a question New Yorkers already solve by hand: is
splitting your shop between nearby stores actually worth the walk?

The answer turns out to depend on where you are. Around Jackson Heights,
splitting a list across five nearby supermarkets saves about $205 a year over
the cheapest single store. In Hell's Kitchen it saves nothing, because one store
is cheaper on almost everything.

## The one thing to understand before reading any number

**2019 prices are measured. 2026 prices are not.**

Nobody has re-surveyed these stores. The 2026 figures are each 2019 item price
multiplied by the national change in that item's BLS average price series. They
describe a price *geography*, not a shelf price. The site says this in the
header, the legend and the limitations section, and so does this README, because
it is the single easiest thing to get wrong when citing this.

## Why the series matching matters

The survey did not price "beef" and "bread". It priced **1 lb of 90% lean
prepackaged ground beef** and **a loaf of whole wheat bread**. Those have
different inflation rates from the generic series:

| Item | Generic series | Spec-matched series |
|---|---|---|
| Ground beef | +80.0% (all ground beef) | **+60.7%** (lean and extra lean) |
| Bread | +41.9% (white) | **+44.9%** (whole wheat) |
| Lettuce | +30.6% (proxy) | **+71.1%** (romaine) |
| Strawberries | +30.6% (proxy) | **+14.9%** (dry pint) |

Using the generic series put the projected median 3 percentage points too high.
Every item here is matched to the surveyed product spec, and the one that cannot
be matched is flagged in the interface.

## Findings

Across the 163 surveyed stores, for the same ten items:

| | 2019 measured | 2026 projected |
|---|---|---|
| Cheapest store | $16.20 | $23.19 |
| Median | $22.82 | $32.45 |
| Priciest store | $35.11 | $49.74 |

The distance between the cheapest and priciest store widened from $18.91 to
$26.54. At one basket a week that is **$984 a year in 2019 and $1,380 now**.

## What this cannot tell you

- It is not a current price. No store here has been visited since 2019.
- **The sample is purposive, not representative.** DOHMH selected stores by
  public transport accessibility and deliberately oversampled gentrifying
  neighbourhoods. Borough figures describe the sample, not the borough.
- 163 stores out of 11,472 licensed food retailers in the city.
- Bodegas and delis are excluded entirely.
- The projection assumes every store raised prices at the national rate for each
  item, which is certainly false store by store.
- 5.4% of item prices are imputed by DOHMH via multiple imputation, and 33% of
  stores have at least one imputed item.
- Three items mix products across stores. Where the preferred item was
  unavailable the surveyor recorded an alternative: 94% of orange records, 23%
  of lettuce, 18% of tomato. Per-item comparison for those three is unreliable.

## Rebuild it

No API key, no dependencies beyond the Python standard library.

```sh
python3 scripts/build_data.py
```

That refetches the survey and the current BLS series, recomputes every factor
from the March-August 2019 survey window to the latest published month, and
rewrites `data/basket.json`. Serve the folder with any static server.

## Sources

- **Prices.** [nychealth/food-pricing-survey-nyc-2019](https://github.com/nychealth/food-pricing-survey-nyc-2019).
  Crossa A, Cooperman E, James B, Ma S, Baquero M. *Data on location and retail
  price of a standard food basket in supermarkets across New York City.* Data in
  Brief, 2023.
- **Price change.** [US Bureau of Labor Statistics](https://www.bls.gov/cpi/)
  average price series, public API.
- **Prior work.** The [FEED-NYC dashboard](https://sites.google.com/view/feed-nyc/food-affordability)
  from the CUNY Urban Food Policy Institute maps the same survey by community
  district. This project adds store-level projection and the split-shop
  calculation.

## Licence

Code and derived data: MIT. Source data belongs to NYC DOHMH and the US BLS.
