"""Project Meridian: measures an orthographic character turnaround (front | side | back on a dark ground) into body profiles for Blender.

For each pixel row it records, from the front view: the torso's run, each leg's, the arm hanging at the figure's right (screen left); and from the
side view (the figure facing screen left): the front and back of the body, skin only (hair excluded), and of the head with its hair. The
image itself isn't kept in the repository; only these numbers are (tools/blender/reference.json).

  python3 tools/measure-reference.py path/to/turnaround.jpg
"""
import json, sys, os
import numpy as np
from PIL import Image

src = sys.argv[1]
im = np.asarray(Image.open(src).convert('RGB')).astype(int)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
fg = (R + G + B) > 150
hair = fg & (B < 0.72 * G) & (R > 150)
skin = fg & ~hair
H, W = fg.shape

def runs(mask_row, x0, x1, minw=3):
    out, s = [], None
    for x in range(x0, x1):
        if mask_row[x] and s is None: s = x
        if not mask_row[x] and s is not None:
            if x - s >= minw: out.append([s, x])
            s = None
    if s is not None and x1 - s >= minw: out.append([s, x1])
    return out

# the three views, by the columns they occupy
cols = fg.sum(0); views, s = [], None
for x in range(W):
    if cols[x] > 3 and s is None: s = x
    if cols[x] <= 3 and s is not None:
        if x - s > 20: views.append((s, x))
        s = None
front, side = views[0], views[1]
rows = np.where(fg[:, front[0]:front[1]].sum(1) > 0)[0]
top, sole = int(rows.min()), int(rows.max())
# the front view's centre line: the middle of the head at the eyes' height and of the ankles, averaged
fx_runs = lambda y, m=skin: runs(m[y], front[0], front[1])
mid_head = np.mean([(r[0][0] + r[-1][1]) / 2 for y in range(top + 80, top + 110) for r in [fx_runs(y, fg)] if r])
cx = float(mid_head)

out = {'source': os.path.basename(src), 'size': [W, H], 'views': {'front': front, 'side': side}, 'top': top, 'sole': sole, 'cx': cx, 'rows': []}
for y in range(top, sole + 1, 2):
    fr = fx_runs(y); fa = runs(fg[y], front[0], front[1]); sd = runs(skin[y], side[0], side[1]); sa = runs(fg[y], side[0], side[1])
    row = {'y': y, 'front': fr, 'frontAll': fa, 'side': sd, 'sideAll': sa}
    out['rows'].append(row)
dst = os.path.join(os.path.dirname(__file__), 'blender', 'reference.json')
json.dump(out, open(dst, 'w'))
print('views', front, side, 'top', top, 'sole', sole, 'centre', round(cx, 1), '->', dst)
