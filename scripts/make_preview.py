#!/usr/bin/env python3
"""Render a static PNG of the map for the README and for sharing.

    ~/.venvs/geo/bin/python scripts/make_preview.py

Uses the same data and the same colour ramp as the live map, so the image is a
faithful preview rather than a separate illustration.
"""
import json, os
import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
matplotlib.rcParams["text.usetex"] = False
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.lines import Line2D

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "..", "data", "basket.json")
BOROS = "https://data.cityofnewyork.us/resource/gthc-hcne.geojson"
OUT = os.path.join(HERE, "..", "img", "preview.png")

RAMP = ["#F8E3CD", "#EDC29B", "#DE9A67", "#C4562A", "#8E3A16"]
INK, INK2, RULE, PAPER = "#15181C", "#454C56", "#DFDDD8", "#FCFBF9"

d = json.load(open(DATA))
stores = d["stores"]
boros = gpd.read_file(BOROS).to_crs(4326)

vals = [s["b26"] for s in stores]
lo, hi = min(vals), max(vals)
cmap = LinearSegmentedColormap.from_list("basket", RAMP)

fig, ax = plt.subplots(figsize=(11, 10.4), dpi=150)
fig.patch.set_facecolor(PAPER); ax.set_facecolor(PAPER)
boros.plot(ax=ax, facecolor="#FFFFFF", edgecolor=RULE, linewidth=1.1, zorder=1)

xs = [s["lon"] for s in stores]; ys = [s["lat"] for s in stores]
sc = ax.scatter(xs, ys, c=vals, cmap=cmap, vmin=lo, vmax=hi, s=78,
                edgecolor="#FFFFFF", linewidth=1.0, zorder=3)

# Label the extremes only. A label on every point is noise.
lowest = min(stores, key=lambda s: s["b26"]); highest = max(stores, key=lambda s: s["b26"])
for s, dy, ha in ((highest, 0.012, "center"), (lowest, -0.018, "center")):
    ax.annotate(f'{s["name"]}  \\${s["b26"]:.2f}', (s["lon"], s["lat"] + dy),
                ha=ha, fontsize=8.5, color=INK, weight="bold", zorder=4)

ax.set_xlim(-74.27, -73.68); ax.set_ylim(40.48, 40.93)
ax.set_axis_off()
ax.set_title("The same ten groceries, priced store by store",
             fontsize=17, weight="bold", color=INK, loc="left", pad=34)
ax.text(0, 1.014, f"{len(stores)} New York City supermarkets  |  2026 projected basket, "
        f"\\${lo:.2f} to \\${hi:.2f}", transform=ax.transAxes, fontsize=10, color=INK2)

cb = fig.colorbar(sc, ax=ax, fraction=0.028, pad=0.01)
cb.set_label("Projected basket price", fontsize=9, color=INK2)
cb.outline.set_edgecolor(RULE); cb.ax.tick_params(labelsize=8, colors=INK2)

ax.text(0, -0.035, "2019 prices measured by NYC DOHMH, projected with BLS average price series. "
        "Not current shelf prices.", transform=ax.transAxes, fontsize=8.5, color=INK2)

fig.tight_layout()
fig.savefig(OUT, facecolor=PAPER, bbox_inches="tight")
# Maps are flat colour plus text, so a 256-entry adaptive palette is visually
# identical to truecolour and roughly a third the bytes.
from PIL import Image
_im = Image.open(OUT).convert("RGB")
_im.thumbnail((1400, 1400), Image.LANCZOS)
_im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(OUT, optimize=True)

print(f"wrote {OUT}")
