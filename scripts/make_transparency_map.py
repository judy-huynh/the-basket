#!/usr/bin/env python3
"""Render img/transparency.png: the share of food retailers in each ZIP that
belong to a chain, which is an upper bound on who can check a price online."""
import json, os
import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
matplotlib.rcParams["text.usetex"] = False
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "..", "data", "transparency.json")
ZCTA = "https://data.cityofnewyork.us/resource/35j5-n34v.geojson"
OUT = os.path.join(HERE, "..", "img", "transparency.png")

# Single hue, light to dark: this is magnitude, not polarity.
RAMP = ["#F8E3CD", "#EDC29B", "#DE9A67", "#C4562A", "#8E3A16"]
INK, INK2, RULE, PAPER = "#15181C", "#454C56", "#DFDDD8", "#FCFBF9"

d = json.load(open(DATA))
share = {a["zip"]: a["chain_share"] for a in d["areas"]}

g = gpd.read_file(ZCTA).to_crs(4326)
zcol = next((c for c in ("zcta5", "modzcta", "zcta", "postalcode", "zip", "zcta5ce10")
             if c in g.columns), g.columns[0])
g["zip"] = g[zcol].astype(str).str.slice(0, 5)
g["share"] = g["zip"].map(share)
covered = g[g["share"].notna()]
missing = g[g["share"].isna()]

cmap = LinearSegmentedColormap.from_list("t", RAMP)
fig, ax = plt.subplots(figsize=(11, 10.6), dpi=150)
fig.patch.set_facecolor(PAPER); ax.set_facecolor(PAPER)

missing.plot(ax=ax, facecolor="#F0EFEC", edgecolor=RULE, linewidth=.5, zorder=1)
covered.plot(ax=ax, column="share", cmap=cmap, vmin=0, vmax=.7,
             edgecolor="#FFFFFF", linewidth=.55, zorder=2,
             legend=True, legend_kwds={"label": "Share of food retailers belonging to a chain",
                                       "fraction": .028, "pad": .01})

ax.set_xlim(-74.27, -73.68); ax.set_ylim(40.48, 40.93); ax.set_axis_off()
ax.set_title("Who can check a price before they shop", fontsize=18, weight="bold",
             color=INK, loc="left", pad=34)
c = d["citywide"]
ax.text(0, 1.014, f"{c['retailers']:,} licensed food retailers. Only "
        f"{c['chain_share']*100:.0f}% belong to a chain of three or more locations.",
        transform=ax.transAxes, fontsize=10.5, color=INK2)
r = d["correlations"]
ax.text(0, -0.035,
        f"Chain share correlates {r['chain_share_vs_rent_burdened']:+.2f} with rent burden and "
        f"{r['chain_share_vs_snap']:+.2f} with SNAP enrolment across {r['n_zips']} ZIPs.\n"
        "Chain membership is an upper bound on the possibility of online prices, not a measurement of it. "
        "Grey ZIPs have too few retailers to rank.",
        transform=ax.transAxes, fontsize=8.5, color=INK2, va="top")

fig.tight_layout(); fig.savefig(OUT, facecolor=PAPER, bbox_inches="tight")
print(f"wrote {OUT}  ({len(covered)} ZIPs shaded, {len(missing)} unshaded)")
