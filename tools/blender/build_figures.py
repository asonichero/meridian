"""Project Meridian: builds the figures in Blender: the base bodies (female from the reference turnaround's measurements, male derived from it),
their shape keys, the skeleton js/figure.js poses, the skin weights, and the clothing layers, and exports a GLB per sex to models/.

  blender -b --python tools/blender/build_figures.py            (reads tools/blender/reference.json: python3 tools/measure-reference.py first)

Coordinates here are the game's: metres, y up, z forward (the figure faces +z), x to the figure's left. They're turned into Blender's (z up,
facing -y) only where Blender needs them, and the glTF exporter turns them back.

The body: a skeleton graph (spine, legs, arms, hands with fingers, feet) given a continuous quad skin by the Skin modifier and subdivided; then
every point of the trunk and limbs is pushed along its normal onto the union of surfaces fitted to the reference (each row of the front view's
width and the side view's depth, with the bust and the seat as paired forms), and the joins (hips, crotch, armpits, shoulders) smoothed into
soft folds. Hands and feet keep the Skin modifier's own forms. The same graph built at other proportions gives the shape keys.
"""
import bpy, json, math, os, sys, time
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
REF = json.load(open(os.path.join(HERE, 'reference.json')))
OUT = os.path.join(REPO, 'models')
os.makedirs(OUT, exist_ok=True)

def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def gauss(d, s): return np.exp(-(d * d) / (2 * s * s))
def angdiff(a, b): return (a - b + np.pi) % (2 * np.pi) - np.pi
def toB(p): return Vector((p[0], -p[2], p[1]))          # ours → Blender
def fromB(v): return (v[0], v[2], -v[1])                # Blender → ours

# ── Reading the turnaround ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
HEIGHT_F = 1.70
rows = REF['rows']; top, sole, cx = REF['top'], REF['sole'], REF['cx']
S = HEIGHT_F / (sole - top)
ym = lambda py: (sole - py) * S
byp = {r['y']: r for r in rows}
def row(py): py = int(py) - (int(py) - top) % 2; return byp.get(py) or byp[min(byp, key=lambda k: abs(k - py))]
def front_runs(py): return row(py)['front']
def side_ext(py, allfg=False):
    """The body's front and back in the side view: its longest run of skin, joined with any neighbour within a few pixels (not stray
    highlights in the hair taken for skin)."""
    rr = sorted(row(py)['sideAll' if allfg else 'side'])
    if not rr: return None
    i = max(range(len(rr)), key=lambda k: rr[k][1] - rr[k][0]); a, b = rr[i]
    for r in rr[i + 1:]:
        if r[0] - b <= 5: b = max(b, r[1])
    for r in reversed(rr[:i]):
        if a - r[1] <= 5: a = min(a, r[0])
    return (a, b)
def centre_run(runs, x):
    if not runs: return None
    inside = [r for r in runs if r[0] <= x <= r[1]]
    return inside[0] if inside else min(runs, key=lambda r: min(abs(r[0] - x), abs(r[1] - x)))
PYS = list(range(top, sole + 1, 2))

# landmarks, from the front view's widths
def torso_w(py): r = centre_run(front_runs(py), cx); return (r[1] - r[0]) if r else 0
# (the chin's tip is the narrowest the face gets; the neck is just below it, where the width steps out again)
_tip = min(range(top + 130, top + 200, 2), key=torso_w)
chin_py = _tip + 8
neck_py = next(py for py in range(_tip, _tip + 40, 2) if torso_w(py) > torso_w(_tip) * 1.25) + 6
shoulder_py = next(py for py in range(neck_py, neck_py + 80, 2) if torso_w(py) > 2.0 * torso_w(neck_py))
armpit_py = next(py for py in range(shoulder_py, shoulder_py + 200, 2) if len(front_runs(py)) >= 3)
crotch_py = next(py for py in range(armpit_py + 150, sole, 2) if len([r for r in front_runs(py) if r[1] > cx - 150 and r[0] < cx + 150]) >= 2 and all(not (r[0] < cx < r[1]) for r in front_runs(py)))
def leg_run(py):
    rr = [r for r in front_runs(py) if (r[0] + r[1]) / 2 > cx and r[0] < cx + 140]
    return min(rr, key=lambda r: r[0]) if rr else None
def leg_w(py): r = leg_run(py); return (r[1] - r[0]) if r else 999
knee_py = min(range(crotch_py + 140, crotch_py + 230, 2), key=leg_w)
ankle_py = min(range(knee_py + 150, sole - 50, 2), key=leg_w)
# the side view's centre line: the middle of the pelvis
cz = np.mean([sum(side_ext(py)) / 2 for py in range(crotch_py - 70, crotch_py - 40, 2)])
zm = lambda px: (cz - px) * S
xm = lambda px: (px - cx) * S
print('landmarks py: chin', chin_py, 'neck', neck_py, 'shoulder', shoulder_py, 'armpit', armpit_py, 'crotch', crotch_py, 'knee', knee_py, 'ankle', ankle_py, 'scale', round(S, 6))
# Real proportions rather than the reference's stylised long legs: the crotch lowered (the legs shortened above the ankle), the trunk lengthened to
# match, the shoulders and head where they were. (The reference has the crotch at about half the height; people have it nearer 46–47%.)
CROTCH_DROP = 0.05
SEAT_K = 1.08      # (the seat a little fuller than the reference's)
_ym0 = ym; _c0 = _ym0(crotch_py); _n0 = _ym0(neck_py); _f0 = 0.14
def ym(py):
    y = _ym0(py)
    if y <= _f0 or y >= _n0: return y
    c1 = _c0 - CROTCH_DROP
    return _f0 + (y - _f0) * (c1 - _f0) / (_c0 - _f0) if y <= _c0 else c1 + (y - _c0) * (_n0 - c1) / (_n0 - _c0)

# ── Profiles ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
# A profile is rows up its axis: { y (or z, along the axis), cx, cz (the centre), rx (half width), zF / zB (front, back), p (squareness),
# lobes: list of (angle, width, amount) }. Its surface's distance from the centre at a polar angle is the superellipse's, plus the lobes.
def ring(y, c, rx, zF, zB, p=2.2, lobes=()):
    return dict(y=y, cx=c[0], cz=c[1], rx=rx, zF=zF, zB=zB, p=p, lobes=list(lobes))

def smooth_rows(P, sigma=3.0, keys=('cx', 'cz', 'rx', 'zF', 'zB')):
    """A profile's rows evened out along its length (the measurements are a pixel apart and noisy): a gaussian over neighbouring rows, the
    lobes' amounts too."""
    n = len(P); w = np.exp(-0.5 * (np.arange(-int(3 * sigma), int(3 * sigma) + 1) / sigma) ** 2)
    def sm(v):
        v = np.asarray(v, float); pad = len(w) // 2; vp = np.pad(v, pad, mode='edge'); return np.convolve(vp, w / w.sum(), mode='valid')
    out = [dict(r) for r in P]
    for k in keys:
        v = sm([r[k] for r in P])
        for r, x in zip(out, v): r[k] = float(x)
    # the lobes: each row's list in the same order where they exist (bust, seat, groove); smoothed as amounts, missing taken as nothing
    tags = {}
    for i, r in enumerate(P):
        for j, (a, wd, m) in enumerate(r['lobes']): tags.setdefault((round(a, 3), round(wd, 3)), np.zeros(n))[i] = m
    sm_tags = {k: sm(v) for k, v in tags.items()}
    for i, r in enumerate(out): r['lobes'] = [(a, wd, float(v[i])) for (a, wd), v in sm_tags.items() if abs(v[i]) > 1e-5]
    return out

def round_seat(rows, sigma=8.0, keep=0.97):
    """The seat's forms (and the cleft between them) spread further up and down the rows, their fullest kept: a rounder curve from the small
    of the back over the seat, without a flat face behind it."""
    is_seat = lambda a, w: a < 0 and abs(abs(a + np.pi / 2) - 0.56) < 0.03 and abs(w - 0.53) < 0.02
    is_cleft = lambda a, w: abs(a + np.pi / 2) < 0.01 and abs(w - 0.11) < 0.01
    amt = np.array([max([m for a, w, m in r['lobes'] if is_seat(a, w)] or [0.0]) for r in rows])
    cl = np.array([min([m for a, w, m in r['lobes'] if is_cleft(a, w)] or [0.0]) for r in rows])
    if amt.max() <= 0: return rows
    i = np.arange(len(rows)); K = np.exp(-0.5 * ((i[:, None] - i[None, :]) / sigma) ** 2); K /= K.sum(1, keepdims=True)
    sm = K @ amt; sm *= amt.max() * keep / max(sm.max(), 1e-9); cs = K @ cl; cs *= (cl.min() * keep / cs.min()) if cs.min() < 0 else 0
    out = []
    for r, m, c in zip(rows, sm, cs):
        lob = [l for l in r['lobes'] if not is_seat(l[0], l[1]) and not is_cleft(l[0], l[1])]
        if m > 1e-5: lob += [(-np.pi / 2 + 0.56, 0.53, float(m)), (-np.pi / 2 - 0.56, 0.53, float(m)), (-np.pi / 2, 0.11, float(c))]
        out.append(dict(r, lobes=lob))
    return out

def torso_profile():
    out = []
    ys_ = [py for py in PYS if neck_py <= py <= crotch_py + 40]
    hw_neck = torso_w(neck_py) / 2; hw_pit = torso_w(armpit_py + 4) / 2
    sh_x = SH_X / S      # (the shoulder joint, in pixels from the centre)
    # the front and back as measured; the chest's and the lower back's base lines (without the bust or the seat) drawn straight across them
    fr = {py: side_ext(py)[0] for py in ys_}; bk = {py: side_ext(py)[1] for py in ys_}
    bust_a, bust_b = armpit_py - 30, armpit_py + 60
    seat_a, seat_b = crotch_py - 110, crotch_py + 6
    for py in ys_:
        w = torso_w(py) / 2 * (1 + 0.012 * gauss(py - (crotch_py - 25), 40))      # (a touch wider at the seat's fullest)
        if py >= crotch_py:           # (below the crotch the front view shows the two thighs: the trunk keeps the hips' width, outer edge to edge)
            rr = [r for r in front_runs(py) if r[1] > cx - 150 and r[0] < cx + 150]; w = max(cx - min(r[0] for r in rr), max(r[1] for r in rr) - cx)
        if py < armpit_py:            # above the armpits the front view shows the shoulders and arms too: the trunk itself narrows up to the neck
            # (the trapezius sloping out from the neck to the shoulder, then the chest's own width down to the armpit)
            t = ss(neck_py + 2, shoulder_py + 24, py); w = hw_neck + (max(hw_pit, sh_x * 1.12) - hw_neck) * t ** 0.7
            w = w if py < shoulder_py + 24 else w + (hw_pit - w) * ss(shoulder_py + 24, armpit_py, py)
            w = min(w, torso_w(py) / 2)
        f, b = fr[py], bk[py]
        # the bust: two forms on the chest, standing out of a base line drawn from above to below it
        base_f = np.interp(py, [bust_a, bust_b], [fr[min(ys_, key=lambda k: abs(k - bust_a))], fr[min(ys_, key=lambda k: abs(k - bust_b))]])
        bust = max(0.0, base_f - f) if bust_a < py < bust_b else 0.0
        base_b = np.interp(py, [seat_a, seat_b], [bk[min(ys_, key=lambda k: abs(k - seat_a))], bk[min(ys_, key=lambda k: abs(k - seat_a))] - 4])
        seat = max(0.0, b - base_b) if seat_a < py < seat_b else 0.0
        zf = zm(base_f if bust else f); zb = -zm(b - seat if seat else b)
        lobes = []
        if bust: lobes += [(np.pi / 2 - 0.55, 0.3, bust * S * 1.1), (np.pi / 2 + 0.55, 0.3, bust * S * 1.1)]
        if seat: lobes += [(-np.pi / 2 + 0.56, 0.53, seat * S * SEAT_K), (-np.pi / 2 - 0.56, 0.53, seat * S * SEAT_K), (-np.pi / 2, 0.11, -seat * S * 0.6 * SEAT_K)]
        if armpit_py < py < crotch_py - 100: lobes += [(-np.pi / 2, 0.2, -0.0025)]      # the spine's groove, soft
        # (squareness: rounder at the chest, fuller at the hips' sides, where the thighs' tops come into them)
        pq = 2.0 + 0.15 * ss(armpit_py - 30, armpit_py + 30, py) + 0.55 * ss(crotch_py - 150, crotch_py, py)
        out.append(ring(ym(py), (0.0, (zf - zb) / 2), w * S, (zf + zb) / 2, (zf + zb) / 2, pq, lobes))
    out.reverse()        # (from the bottom up)
    out = smooth_rows(out, 3.5)
    out = round_seat(out)
    # (below the crotch the trunk carries on at the hips' width; body_field hands it over to the two thighs there in a blend, which shapes
    # the crotch)
    t = out[-1]
    for dy in (0.03, 0.06, 0.09): out.append(dict(t, y=t['y'] + dy, lobes=[]))      # (the neck, up inside the head)
    return out

def leg_profile():
    out = []
    # the thigh's back, under the seat: the side view's back there is the buttocks' underside, hanging behind the thigh down to the fold.
    # The thigh's own back line is carried up straight from below the fold, and what's behind it is a form on the back's inner side.
    ref = [p for p in PYS if crotch_py + 60 <= p <= crotch_py + 100]; kb = np.polyfit(ref, [side_ext(p)[1] for p in ref], 1)
    for py in [p for p in PYS if crotch_py + 2 <= p <= sole]:
        if py > ankle_py + 18: break
        r = leg_run(py); f, b = side_ext(py)
        bl = min(b, np.polyval(kb, py)) if py < crotch_py + 60 else b
        bl = min(bl, f + (r[1] - r[0]) * 1.15)         # (and a thigh no deeper than it is wide, near enough)
        hang = (b - bl) * S
        c = xm((r[0] + r[1]) / 2); hw = (r[1] - r[0]) / 2 * S
        lobes = [(-np.pi / 2 - 0.35, 0.58, hang * 1.1 * SEAT_K)] if hang > 0 else []
        out.append(ring(ym(py), (c, (zm(f) + zm(bl)) / 2), hw, (zm(f) - zm(bl)) / 2, (zm(f) - zm(bl)) / 2, 2.05, lobes))
    out.reverse()
    # down past the ankle into the foot, the ankle's row carried on; up only a little past the crotch, rounding into the trunk
    b = out[0]
    for dy in (0.03, 0.06, 0.09): out.insert(0, dict(b, y=b['y'] - dy))
    out = smooth_rows(out, 3.0)
    # up into the trunk to the hip: the thigh's width carried on (the hip's outline is the thigh's), its depth flattened so it stays inside the
    # trunk's front and back, tapering as it goes
    # up past the crotch, the thigh's top row carried on (the blend into the trunk, in body_field, takes it from there)
    t = out[-1]
    for dy in (0.02, 0.04, 0.06): out.append(dict(t, y=t['y'] + dy))
    return out

def arm_profile():
    """The arm hangs in an A-pose in the turnaround; here it hangs straight down. Its thickness is taken along its own length (each row's width
    across the arm, foreshortened by its slope) and laid out down from the shoulder joint."""
    pts = []
    for py in [p for p in PYS if armpit_py <= p <= sole]:
        rr = [r for r in front_runs(py) if r[1] < cx - 60]
        if not rr: break
        r = max(rr, key=lambda r: r[1]); pts.append((py, (r[0] + r[1]) / 2, r[1] - r[0]))
    pts = np.array(pts, float)
    k = 9; cxs = np.convolve(np.pad(pts[:, 1], k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='valid')
    slope = np.gradient(cxs, pts[:, 0]); cosA = 1 / np.sqrt(1 + slope ** 2)
    thick = pts[:, 2] * cosA
    seg = np.sqrt(np.diff(pts[:, 0]) ** 2 + np.diff(cxs) ** 2); arc = np.concatenate([[0], np.cumsum(seg)])
    # the elbow and the wrist: the narrowest points where they fall along the whole (an arm is about 55% elbow, 74% wrist, of shoulder to fingertip)
    L = arc[-1]; band = lambda a, b: np.where((arc >= a * L) & (arc <= b * L))[0]
    e = band(0.3, 0.5); i_el = int(e[np.argmin(thick[e])])
    w = band(0.62, 0.8); i_wr = int(w[np.argmin(thick[w])])
    # (from the shoulder joint, along the arm, to the first row where the arm stands clear of the trunk)
    jx, jy = cx - SH_X / S, shoulder_py + 22
    lead = math.hypot(cxs[0] - jx, pts[0, 0] - jy) * S
    out = []
    for i in range(0, i_wr + 1, 1):
        a = arc[i] * S + lead; r = thick[i] / 2 * S
        depth = 0.95 + 0.35 * ss(arc[i_el], arc[i_wr], arc[i])        # (round above, wider front to back toward the wrist: the palms face in)
        out.append(ring(a, (0.004, -0.008), r, r * depth, r * depth, 2.0))
    # the shoulder: from the first clear row up to the joint, the deltoid a little fuller, then rounding over the top of the joint
    top_r = out[0]
    for a, k in [(lead * 0.66, 1.05), (lead * 0.33, 1.0), (0.03, 0.9), (0.018, 0.72), (0.01, 0.45)]:
        out.insert(0, ring(a, (0.004, -0.01), top_r['rx'] * k, top_r['zF'] * k, top_r['zB'] * k, 2.0))
    # past the wrist a little, into the hand
    e = out[-1]
    for da in (0.01, 0.02): out.append(dict(e, y=e['y'] + da, rx=e['rx'] * 0.98, zF=e['zF'] * 1.02, zB=e['zB'] * 1.02))
    return smooth_rows(out, 2.5), (arc[i_wr] * S + lead), (arc[-1] - arc[i_wr]) * S

# the shoulder joint: the trunk's measured shoulder line, in from the deltoid's outer edge
SH_Y = ym(shoulder_py + 22)
SH_X = 0.135
SH_XS = {'f': 0.135, 'm': 0.152}
ABD = math.radians(13)       # (the arms hang a little out from the sides, clear of the hips, as at rest they do)
def arm_axis(sx):
    J = np.array([sx * SH_X, SH_Y, -0.01]); d = np.array([sx * math.sin(ABD), -math.cos(ABD), 0.0]); e1 = np.array([sx * math.cos(ABD), math.sin(ABD), 0.0])
    return J, d, e1
def arm_at(sx, a): J, d, e1 = arm_axis(sx); return J + d * a
TORSO = torso_profile(); LEG = leg_profile(); ARM, ARM_LEN, HAND_LEN = arm_profile()
HIP_Y = ym(crotch_py) + 0.075; CROTCH_Y = ym(crotch_py); KNEE_Y = ym(knee_py); ANKLE_Y = 0.075; WRIST_Y = SH_Y - ARM_LEN * math.cos(ABD)
ELBOW_Y = SH_Y - ARM_LEN * 0.53 * math.cos(ABD)
_toe, _heel = side_ext(sole - 8)
FOOT_LEN = zm(_toe) + 0.055
HAND_K = {'f': 1.0, 'm': 1.1}
DELT_R = {'f': 0.038, 'm': 0.04}
print('hip', round(HIP_Y, 3), 'knee', round(KNEE_Y, 3), 'shoulder', round(SH_Y, 3), 'elbow', round(ELBOW_Y, 3), 'wrist', round(WRIST_Y, 3), 'foot', round(FOOT_LEN, 3))
print('arm length', round(ARM_LEN, 3), 'hand', round(HAND_LEN, 3), 'rows', len(TORSO), len(LEG), len(ARM))

# ── The male, derived ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def scaled(P, f):
    """A copy of a profile with each row's widths scaled by f(row) → (kx, kf, kb, lobe scale)."""
    out = []
    for r in P:
        kx, kf, kb, kl = f(r)
        out.append(dict(r, rx=r['rx'] * kx, zF=r['zF'] * kf, zB=r['zB'] * kb, lobes=[(a, w, m * (kl(a) if callable(kl) else kl)) for a, w, m in r['lobes']]))
    return out
def male(P, part):
    if part == 'torso':
        def f(r):
            y = r['y']; t_sh = ss(ym(armpit_py) - 0.1, ym(shoulder_py), y); t_w = gauss(y - ym(crotch_py - 150), 0.1); t_h = gauss(y - ym(crotch_py - 40), 0.07)
            kx = 1.0 + 0.2 * t_sh + 0.2 * t_w - 0.12 * t_h + 0.16 * ss(ym(neck_py + 36), ym(neck_py), y)
            # (the bust's forms dropped; the seat's kept, smaller)
            return kx, 1.03 + 0.05 * t_sh - 0.05 * t_h, 1.02 + 0.05 * t_sh, lambda a: 0.0 if a > 0 else 0.66
        out = scaled(P, f)
        # a man's chest: the pecs, broad and flat, high on it
        for r in out:
            pc = 0.006 * gauss(r['y'] - (ym(armpit_py) + 0.02), 0.035)
            if pc > 1e-5: r["lobes"] = r["lobes"] + [(np.pi / 2 - 0.55, 0.6, pc), (np.pi / 2 + 0.55, 0.6, pc)]
        return out
    # (the thighs' tops flatter behind, as the seat is)
    if part == 'leg': return scaled(P, lambda r: (0.97 - 0.05 * ss(ym(knee_py), ym(crotch_py), r['y']), 0.98, 0.95 - 0.07 * ss(ym(crotch_py + 80), ym(crotch_py), r['y']), 0.66))
    if part == 'arm': return scaled(P, lambda r: (1.16, 1.16, 1.16, 1))
def bust_variant(P, k, spread=0.0, drop=0.0, widen=1.0, apart=0.55, round_=1.0):
    """The torso with the bust's pair of forms k times the size: spread `spread` (m) further up and down, sitting `drop` lower, `widen` times
    wider round the chest, set `apart` (radians from the middle), and fuller in profile (round_ > 1: rounder, less peaked, still easing out to
    nothing at its edges, so no crease is left under it)."""
    rows = sorted(P, key=lambda r: r['y']); ys = np.array([r['y'] for r in rows])
    isb = lambda a, w: a > 0 and abs(abs(a - np.pi / 2) - 0.55) < 0.06 and abs(w - 0.3) < 0.02
    amt = np.array([max([m for a, w, m in r['lobes'] if isb(a, w)] or [0.0]) for r in rows])
    if spread > 0:
        A = np.array([[gauss(yi - yj, spread) for yj in ys] for yi in ys]); sm = A @ amt / np.maximum(A.sum(1), 1e-9)
        amt = sm * (amt.max() / max(sm.max(), 1e-9))
    if round_ != 1.0: pk = max(amt.max(), 1e-9); amt = pk * (1 - (1 - amt / pk) ** round_)
    amt = np.interp(ys + drop, ys, amt, left=0, right=0) * k
    out = []
    for r, m in zip(rows, amt):
        lob = [l for l in r['lobes'] if not isb(l[0], l[1])]
        if m > 1e-5: lob += [(np.pi / 2 - apart, 0.3 * widen, float(m)), (np.pi / 2 + apart, 0.3 * widen, float(m))]
        out.append(dict(r, lobes=lob))
    return out

VARIANTS = {
    # (each a further scaling of the base, for a shape key: the extremes the game blends toward)
    'muscle': {'torso': lambda r: (1.05 + 0.05 * ss(ym(armpit_py) - 0.1, ym(shoulder_py), r['y']), 1.05, 1.06, 1.1), 'leg': lambda r: (1.1, 1.1, 1.12, 1), 'arm': lambda r: (1.16, 1.16, 1.16, 1)},
    'slight': {'torso': lambda r: (0.93, 0.93, 0.93, 0.85), 'leg': lambda r: (0.9, 0.9, 0.9, 1), 'arm': lambda r: (0.88, 0.88, 0.88, 1)},
    'soft': {'torso': lambda r: (1.0 + 0.16 * gauss(r['y'] - ym(crotch_py - 130), 0.12), 1.0 + 0.22 * gauss(r['y'] - ym(crotch_py - 110), 0.1), 1.05, 1.2), 'leg': lambda r: (1.0 + 0.1 * ss(ym(knee_py), ym(crotch_py), r['y']), 1.08, 1.08, 1), 'arm': lambda r: (1.08, 1.08, 1.08, 1)},
    'firm': {'torso': lambda r: (1.0 - 0.07 * gauss(r['y'] - ym(crotch_py - 150), 0.1), 0.95, 0.97, 0.95), 'leg': lambda r: (0.97, 0.97, 0.97, 1), 'arm': lambda r: (0.96, 0.96, 0.96, 1)},
    'bust': {'torsoP': lambda P: bust_variant(P, 3.4, spread=0.036, drop=0.032, widen=1.65, apart=0.62, round_=2.0), 'leg': lambda r: (1, 1, 1, 1), 'arm': lambda r: (1, 1, 1, 1)},
    'bustSmall': {'torsoP': lambda P: bust_variant(P, 0.4), 'leg': lambda r: (1, 1, 1, 1), 'arm': lambda r: (1, 1, 1, 1)},
    'sexLarge': {'sex': (1.35, 1.45, 1.15), 'torso': lambda r: (1, 1, 1, 1), 'leg': lambda r: (1, 1, 1, 1), 'arm': lambda r: (1, 1, 1, 1)},
    'sexSmall': {'sex': (0.86, 0.82, 0.94), 'torso': lambda r: (1, 1, 1, 1), 'leg': lambda r: (1, 1, 1, 1), 'arm': lambda r: (1, 1, 1, 1)},
    # the body's response, at its fullest (the game rises toward it): his fuller and longer (and lifted by its own bone), the scrotum drawn in;
    # hers, the outer forms fuller and parting a little
    'sexSwell': {'sex': {'m': (1.22, 1.25, 0.9), 'f': (1.25, 1.25, 1.0)}, 'torso': lambda r: (1, 1, 1, 1), 'leg': lambda r: (1, 1, 1, 1), 'arm': lambda r: (1, 1, 1, 1)},
}


# ── Surfaces: each profile as a table of distances (rows × angles), for the fitting ────────────────────────────────────────────────────────
NA = 256
ANG = np.linspace(-np.pi, np.pi, NA, endpoint=False)
class Surface:
    """frame: (origin, axis, side): the profile's rows are distances along the axis from the origin, its x along `side`, its z forward."""
    def __init__(self, P, mirror=1, frame=None):
        P = sorted(P, key=lambda r: r['y'])
        self.mirror = mirror; self.frame = frame
        self.y = np.array([r['y'] for r in P]); self.cx = np.array([r['cx'] for r in P]); self.cz = np.array([r['cz'] for r in P])
        T = np.zeros((len(P), NA))
        for i, r in enumerate(P):
            c, s_ = np.cos(ANG), np.sin(ANG); b = np.where(s_ > 0, r['zF'], r['zB']); p = r['p']
            rad = (np.abs(c / r['rx']) ** p + np.abs(s_ / b) ** p) ** (-1 / p)
            for a, w, m in r['lobes']: rad = rad + m * gauss(angdiff(ANG, a), w)
            T[i] = rad
        self.T = T
    def local(self, X):
        X = X * np.array([self.mirror, 1, 1])
        if self.frame is None: return X
        O, d, e1 = self.frame; R = X - O
        return np.stack([R @ e1, R @ d, R[:, 2]], 1)
    def world(self, Lc):
        if self.frame is not None: O, d, e1 = self.frame; Lc = O + Lc[:, 0:1] * e1 + Lc[:, 1:2] * d + Lc[:, 2:3] * np.array([0, 0, 1.0])
        return Lc * np.array([self.mirror, 1, 1])
    def f(self, X):
        """How far inside (+) or outside (−) the surface each point is (−1 outside its rows)."""
        Lc = self.local(X); x, y, z = Lc[:, 0], Lc[:, 1], Lc[:, 2]
        ok = (y >= self.y[0]) & (y <= self.y[-1])
        yc = np.clip(y, self.y[0], self.y[-1])
        i = np.clip(np.searchsorted(self.y, yc) - 1, 0, len(self.y) - 2); u = (yc - self.y[i]) / np.maximum(1e-9, self.y[i + 1] - self.y[i])
        cxv = self.cx[i] + (self.cx[i + 1] - self.cx[i]) * u; czv = self.cz[i] + (self.cz[i + 1] - self.cz[i]) * u
        dx, dz = x - cxv, z - czv; d = np.hypot(dx, dz); phi = np.arctan2(dz, dx)
        k = (phi + np.pi) / (2 * np.pi) * NA; k0 = np.floor(k).astype(int) % NA; k1 = (k0 + 1) % NA; v = k - np.floor(k)
        r0 = self.T[i, k0] * (1 - v) + self.T[i, k1] * v; r1 = self.T[i + 1, k0] * (1 - v) + self.T[i + 1, k1] * v
        r = r0 * (1 - u) + r1 * u
        return np.where(ok, r - d, -1.0)

# ── The skeleton graph and its skin ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def at(P, y, key):
    P = sorted(P, key=lambda r: r['y']); return float(np.interp(y, [r['y'] for r in P], [r[key] for r in P]))
def graph(torso, leg, arm, sex):
    """Nodes (position, radii (side, front-back), part) and edges: the spine, the legs and feet, the arms and hands."""
    N, E = [], []
    def node(p, r, part): N.append((p, r, part)); return len(N) - 1
    def link(a, b): E.append((a, b))
    y0, y1 = ym(crotch_py) - 0.02, ym(chin_py) + 0.035
    spine = []
    for y in np.arange(y0, y1, 0.06):
        rx, zf, zb, czv = at(torso, y, 'rx'), at(torso, y, 'zF'), at(torso, y, 'zB'), at(torso, y, 'cz')
        spine.append(node((0, y, czv), (rx * 0.85, (zf + zb) / 2 * 0.85), 'torso'))
        if len(spine) > 1: link(spine[-2], spine[-1])
    # (the legs leave the trunk at its lowest node, at the crotch, as they do the pelvis: not from higher up, inside it)
    yh = ym(crotch_py) - 0.03
    hipn = spine[0]
    shn = min(spine, key=lambda i: abs(N[i][0][1] - (SH_Y - 0.04)))
    hk = HAND_K[sex]
    for sx in (1, -1):
        # the leg, from the hip down to the ankle; the foot: heel, arch, ball, toes
        prev = hipn
        for y in np.arange(yh, ANKLE_Y - 0.001, -0.075):
            c, rx, zf = at(leg, y, 'cx'), at(leg, y, 'rx'), at(leg, y, 'zF')
            n = node((sx * c, y, at(leg, y, 'cz')), (rx * 0.85, zf * 0.85), 'leg'); link(prev, n); prev = n
        ax = sx * at(leg, ANKLE_Y, 'cx'); ank = node((ax, ANKLE_Y, -0.005), (0.032, 0.036), 'foot'); link(prev, ank)
        heel = node((ax, 0.035, -0.045), (0.029, 0.03), 'foot'); link(ank, heel)
        arch = node((ax + sx * 0.004, 0.042, 0.04), (0.036, 0.032), 'foot'); link(ank, arch)
        ball = node((ax + sx * 0.008, 0.024, FOOT_LEN - 0.105), (0.044, 0.02), 'foot'); link(arch, ball)
        toe = node((ax + sx * 0.012, 0.018, FOOT_LEN - 0.065), (0.04, 0.014), 'foot'); link(ball, toe)
        # the arm: in from the trunk to the shoulder, down to the wrist
        prev = shn      # (the arm grows straight from the chest, as it does: no separate branch across the shoulder to double the skin there)
        for a in list(np.arange(0.0, ARM_LEN - 0.001, 0.07)) + [ARM_LEN]:
            n = node(tuple(arm_at(sx, a) + np.array([0, 0, at(arm, a, 'cz')])), (at(arm, a, 'rx') * 0.85, at(arm, a, 'zF') * 0.85), 'arm'); link(prev, n); prev = n
        # the hand: palm, knuckles, two segments a finger, the thumb from the heel of the palm; along the arm's line
        H = hand_nodes(sx, hk); ids = {}
        for key, (pos, rad, parent) in H.items():
            ids[key] = node(pos, rad, 'hand'); link(prev if parent == 'wrist' else ids[parent], ids[key])
    return N, E

def hand_nodes(sx, hk):
    """The hand laid along the arm's line from the wrist: palm, knuckles, two segments a finger, the thumb from the heel of the palm."""
    J, d, e1 = arm_axis(sx); W = arm_at(sx, ARM_LEN)
    P = lambda along, z, out=0.0: tuple(W + d * along * hk + np.array([0, 0, z * hk]) + e1 * out * hk)
    H = {'palm': (P(0.05, 0.002, 0.002), (0.017 * hk, 0.04 * hk), 'wrist')}
    # (the fingers together, as a hand at rest holds them, curling a little toward the palm toward their tips)
    for f, fz, fl, fr in [('index', 0.027, 0.074, 0.0088), ('middle', 0.0085, 0.082, 0.0092), ('ring', -0.0095, 0.077, 0.0088), ('pinky', -0.026, 0.061, 0.0078)]:
        H[f + '1'] = (P(0.094, fz, 0.002), (fr * hk * 1.1, fr * hk * 1.05), 'palm')
        H[f + '2'] = (P(0.094 + fl * 0.5, fz * 0.97, -0.004), (fr * hk * 0.95, fr * hk * 0.95), f + '1')
        H[f + 'T'] = (P(0.094 + fl * 0.95, fz * 0.94, -0.012), (fr * hk * 0.82, fr * hk * 0.82), f + '2')
    H['thumb1'] = (P(0.03, 0.026, -0.006), (0.011 * hk, 0.012 * hk), 'palm')
    H['thumb2'] = (P(0.06, 0.045, -0.01), (0.0095 * hk, 0.0095 * hk), 'thumb1')
    H['thumbT'] = (P(0.085, 0.055, -0.012), (0.008 * hk, 0.0085 * hk), 'thumb2')
    return H

def skin_mesh(name, N, E, levels=3, decimate=0.5):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.from_pydata([toB(p) for p, r, part in N], E, [])
    ob.modifiers.new('skin', 'SKIN')
    sv = ob.data.skin_vertices[0].data
    for i, (p, r, part) in enumerate(N): sv[i].radius = (max(0.004, r[0]), max(0.004, r[1]))
    sv[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = levels; sub.render_levels = levels
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='skin'); bpy.ops.object.modifier_apply(modifier='sub')
    if decimate < 1:
        d = ob.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = decimate; d.use_collapse_triangulate = False
        bpy.ops.object.modifier_apply(modifier='dec')
    ob.select_set(False)
    return ob

def mesh_arrays(ob):
    me = ob.data; n = len(me.vertices)
    co = np.zeros(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    X = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)            # → ours
    ed = np.zeros(len(me.edges) * 2, int); me.edges.foreach_get('vertices', ed); ed = ed.reshape(-1, 2)
    return X, ed
def normals(ob):
    me = ob.data; n = len(me.vertices); no = np.zeros(n * 3)
    me.update(); me.vertices.foreach_get('normal', no); no = no.reshape(-1, 3)
    return np.stack([no[:, 0], no[:, 2], -no[:, 1]], 1)

def fit(X, Nrm, label, surfaces, ed):
    """Fits the skin to the union of the surfaces. Each point of the trunk and limbs is given a part once (of those it could be on, the one whose
    surface it's nearest, for its size, and whose outward direction agrees with its normal), then: put on that part's surface along the ray out
    from its axis (and on out to the union's first edge where that lands inside another part), and relaxed: smoothed and put back, ten times
    over, which spreads the points evenly over the true shape and takes out folds where neighbours were given different parts. Last, the joins
    (hips, crotch, armpits, shoulders) and the wrists and ankles (into the hands and feet, which keep the skin's own forms) are smoothed freely
    into soft folds."""
    move = np.isin(label, ['torso', 'leg', 'arm'])
    F = lambda P: np.max(np.stack([s_.f(P) for s_ in surfaces]), 0)
    def radial(srf, P):
        Lc = srf.local(P); y = np.clip(Lc[:, 1], srf.y[0], srf.y[-1])
        cxv = np.interp(y, srf.y, srf.cx); czv = np.interp(y, srf.y, srf.cz)
        d = np.stack([Lc[:, 0] - cxv, np.zeros(len(P)), Lc[:, 2] - czv], 1); L = np.linalg.norm(d, axis=1); d /= np.maximum(L, 1e-9)[:, None]
        C = np.stack([cxv, y, czv], 1)
        dw = srf.world(C + d) - srf.world(C)
        return C, d, L, dw
    score = np.full((len(surfaces), len(X)), 9.0)
    for k, srf in enumerate(surfaces):
        C, d, L, dw = radial(srf, X)
        r = L + srf.f(X)
        Lc = srf.local(X); inrows = (Lc[:, 1] >= srf.y[0] + 0.002) & (Lc[:, 1] <= srf.y[-1] - 0.002)
        sc_ = np.abs(L / np.maximum(r, 1e-4) - 1) + 0.6 * (1 - (dw * Nrm).sum(1))
        side_ok = (X[:, 0] * srf.mirror >= -0.02) if k > 0 else np.ones(len(X), bool)
        score[k] = np.where(inrows & side_ok, sc_, 9.0)
    # which parts each point may be on, by what it grew from: an arm's point is the arm's (the trunk's too, at the shoulder); a leg's is the
    # leg's below the crotch and the trunk's above it (the pelvis is the trunk's); the trunk's is the trunk's (a leg's under the crotch, an
    # arm's or the trunk's at the shoulder)
    yc, ya = ym(crotch_py) + 0.01, ym(armpit_py)
    allow = np.zeros_like(score, bool)
    lab = label; y_ = X[:, 1]
    allow[0] = ((lab == 'torso') & (y_ >= yc - 0.03)) | ((lab == 'leg') & (y_ >= yc)) | ((lab == 'arm') & (y_ > ya))
    for k in (1, 2): allow[k] = ((lab == 'leg') & (y_ < yc + 0.02)) | ((lab == 'torso') & (y_ < yc))
    for k in (3, 4): allow[k] = (lab == 'arm') | ((lab == 'torso') & (y_ > ya))
    score = np.where(allow, score, 9.0)
    own = np.argmin(score, 0); fitted = move & (score[own, np.arange(len(X))] < 9)
    def project(Y):
        Y = Y.copy()
        for k, srf in enumerate(surfaces):
            sel = fitted & (own == k)
            if not sel.any(): continue
            P = Y[sel]; C, d, L, dw = radial(srf, P)
            to = lambda t: srf.world(C + d * t[:, None])
            lo = np.zeros(len(P)); hi = np.full(len(P), 0.3)
            for _ in range(24):
                m = (lo + hi) / 2; inside = srf.f(to(m)) > 0; lo = np.where(inside, m, lo); hi = np.where(inside, hi, m)
            t0 = (lo + hi) / 2
            cov = F(to(t0)) > 1e-4
            last_in = t0.copy(); first_out = np.full(len(P), np.nan)
            for step in np.arange(0.004, 0.1, 0.004):
                tt = t0 + step; out_ = ~(F(to(tt)) > 0) & np.isnan(first_out) & cov
                first_out[out_] = tt[out_]; still = cov & np.isnan(first_out); last_in[still] = tt[still]
            lo, hi = last_in, np.where(np.isnan(first_out), last_in, first_out)
            for _ in range(10):
                m = (lo + hi) / 2; inside = F(to(m)) > 0; lo = np.where(cov & inside, m, lo); hi = np.where(cov & ~inside, m, hi)
            Y[np.where(sel)[0]] = to(np.where(cov, (lo + hi) / 2, t0))
        return Y
    deg = np.bincount(ed.ravel(), minlength=len(X)).astype(float)
    def avg(Y):
        acc = np.zeros_like(Y); np.add.at(acc, ed[:, 0], Y[ed[:, 1]]); np.add.at(acc, ed[:, 1], Y[ed[:, 0]])
        return np.where(deg[:, None] > 0, acc / np.maximum(deg, 1)[:, None], Y)
    Y = project(X)
    for _ in range(10):
        Y = Y + (avg(Y) - Y) * (0.6 * fitted)[:, None]
        Y = project(Y)
    # the free smoothing: where two surfaces meet, and where the fitted limbs meet the hands and feet
    fs = np.stack([s_.f(Y) for s_ in surfaces]); fs.sort(0); w = ((fs[-2] > -0.015) & fitted).astype(float)
    trans = np.isin(label, ['hand', 'foot']) & np.zeros(len(X), bool)
    near_fit = np.zeros(len(X)); near_fit[fitted] = 1.0
    for _ in range(4): near_fit = np.maximum(near_fit, avg(near_fit[:, None])[:, 0] * 0.999)
    edge = (~fitted) & (near_fit > 0.05)       # (the hands' and feet's first rows, next to fitted skin)
    w = np.maximum(w, edge * 1.0)
    w = np.maximum(w, (move & ~fitted) * 1.0)   # (and any point of the trunk or limbs left over at a junction: the shoulders' spikes)
    for _ in range(4): w = np.maximum(w, avg(w[:, None])[:, 0] * 0.8)
    for _ in range(12): Y = Y + (avg(Y) - Y) * (0.5 * w)[:, None]
    ends = np.isin(label, ['hand', 'foot']).astype(float)
    for _ in range(4): Y = Y + (avg(Y) - Y) * (0.35 * ends)[:, None]
    return Y, int(fitted.sum()), int((w > 0.5).sum())


# ── The skeleton: js/figure.js's bones, placed on this body ────────────────────────────────────────────────────────────────────────────────
def joints(sex, torso, leg, arm, N):
    m = sex == 'm'
    waist_y = min(np.arange(ym(crotch_py) + 0.1, ym(armpit_py), 0.005), key=lambda y: at(torso, y, 'rx'))
    J = {}
    J['hips'] = ('', (0, HIP_Y + 0.055, 0))
    J['spine'] = ('hips', (0, waist_y + 0.01, 0))
    J['chest'] = ('spine', (0, (waist_y + SH_Y) / 2 + 0.02, 0))
    J['neck'] = ('chest', (0, ym(neck_py + 16), -0.01))
    J['head'] = ('neck', (0, ym(chin_py) + 0.012, 0.0))
    hk = HAND_K[sex]
    for sx, s in ((1, 'L'), (-1, 'R')):
        J['clav' + s] = ('chest', (sx * 0.03, SH_Y + 0.005, 0))
        J['upperArm' + s] = ('clav' + s, tuple(arm_at(sx, 0.0)))
        J['foreArm' + s] = ('upperArm' + s, tuple(arm_at(sx, ARM_LEN * 0.53) + np.array([0, 0, 0.004])))
        J['hand' + s] = ('foreArm' + s, tuple(arm_at(sx, ARM_LEN) + np.array([0, 0, 0.008])))
        H = hand_nodes(sx, hk)
        for f in ('index', 'middle', 'ring', 'pinky', 'thumb'):
            J[f + '1' + s] = ('hand' + s, H[f + '1'][0]); J[f + '2' + s] = (f + '1' + s, H[f + '2'][0])
        hx = sx * at(leg, HIP_Y - 0.06, 'cx')
        J['thigh' + s] = ('hips', (hx, HIP_Y, 0)); J['shin' + s] = ('thigh' + s, (sx * at(leg, KNEE_Y, 'cx'), KNEE_Y, 0.006))
        ax = sx * at(leg, ANKLE_Y + 0.02, 'cx')
        J['foot' + s] = ('shin' + s, (ax, ANKLE_Y, -0.008)); J['toe' + s] = ('foot' + s, (ax + sx * 0.008, 0.024, FOOT_LEN - 0.105))
        J['glute' + s] = ('hips', (sx * 0.072, ym(crotch_py - 45), -at(torso, ym(crotch_py - 45), 'zB') * 0.55 + at(torso, ym(crotch_py - 45), 'cz')))
    if m: J['sex'] = ('hips', tuple(float(v) for v in his_root(torso, leg)[0]))       # (his: the lift's pivot, where it leaves the body)
    return J

def armature(name, J):
    arm = bpy.data.armatures.new(name); ob = bpy.data.objects.new(name, arm); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
    kids = {}
    for n, (par, p) in J.items(): kids.setdefault(par, []).append(n)
    eb = {}
    for n, (par, p) in J.items():
        b = arm.edit_bones.new(n); b.head = toB(p)
        ch = [k for k in kids.get(n, []) if not k.startswith('glute') and not k.startswith('clav') and k != 'sex']
        if n == 'chest': ch = ['neck']
        if n.startswith('hand'): ch = ['middle1' + n[-1]]
        if len(ch) == 1 and (Vector(toB(J[ch[0]][1])) - b.head).length > 0.01: b.tail = toB(J[ch[0]][1])
        else:
            down = {'head': (0, 0.12, 0), 'neck': (0, 0.06, 0)}.get(n, (0, -0.03, 0)) if not (n[:-1].endswith('2') and n[:-2] in ('index', 'middle', 'ring', 'pinky', 'thumb')) else (0, -0.025, 0)
            if n.startswith('toe'): down = (0, 0, 0.04)
            if n.startswith('glute'): down = (0, -0.04, 0)
            b.tail = toB((p[0] + down[0], p[1] + down[1], p[2] + down[2]))
        eb[n] = b
    for n, (par, p) in J.items():
        if par: eb[n].parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT'); ob.select_set(False)
    return ob

def set_positions(ob, Y):
    co = np.stack([Y[:, 0], -Y[:, 2], Y[:, 1]], 1).ravel(); ob.data.vertices.foreach_set('co', co); ob.data.update()

# ── The body as a field: the measured surfaces, hands and feet, smoothly united; its surface drawn by marching cubes ──────────────────────
def smax(a, b, k):
    """A smooth union (positive inside): where two forms meet within k of each other, a soft fillet rather than a crease."""
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.maximum(a, b) + h * h * k * 0.25
def capsule(P, A, B, ra, rb):
    AB = B - A; t = np.clip(((P - A) @ AB) / max(1e-12, AB @ AB), 0, 1)
    return ra + (rb - ra) * t - np.linalg.norm(P - (A + t[:, None] * AB), axis=1)
def rbox(P, O, axes, half, rad):
    L = (P - O) @ axes.T; q = np.abs(L) - half
    return rad - (np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0))

def hand_parts(sx, hk):
    """The hand along the arm's line from the wrist: a rounded palm, four fingers of two segments (a little apart, curling a touch toward the
    palm), the thumb from the heel of the palm. Each part: a function of points → inside (+) / outside (−), and its reach (a box)."""
    J, d, e1 = arm_axis(sx); z = np.array([0, 0, 1.0]); W = arm_at(sx, ARM_LEN) + np.array([0, 0, 0.004])
    palm_side = -e1          # (the palm faces the body)
    parts = []
    O = W + d * 0.042 * hk; axes = np.stack([e1, d, z])
    parts.append(('palm', lambda P, O=O, axes=axes: rbox(P, O, axes, np.array([0.0105, 0.046, 0.033]) * hk, 0.0075 * hk)))
    fingers = []
    for f, fz, fl, fr in [('index', 0.0315, 0.074, 0.0086), ('middle', 0.0105, 0.082, 0.009), ('ring', -0.0105, 0.077, 0.0086), ('pinky', -0.0305, 0.061, 0.0076)]:
        K = W + d * 0.086 * hk + z * fz * hk; M = K + d * fl * 0.5 * hk + palm_side * 0.003; T = K + d * fl * 0.94 * hk + palm_side * 0.01
        fingers.append(lambda P, K=K, M=M, T=T, fr=fr: np.maximum(capsule(P, K, M, fr * hk, fr * hk * 0.93), capsule(P, M, T, fr * hk * 0.93, fr * hk * 0.8)))
    B0 = W + d * 0.022 * hk + z * 0.024 * hk + palm_side * 0.004; B1 = B0 + d * 0.03 * hk + z * 0.016 * hk + palm_side * 0.006; T = B1 + d * 0.027 * hk + z * 0.006 * hk + palm_side * 0.004
    thumb = lambda P: np.maximum(capsule(P, B0, B1, 0.0115 * hk, 0.0098 * hk), capsule(P, B1, T, 0.0098 * hk, 0.0084 * hk))
    def hand(P):
        h = parts[0][1](P)
        for fn in fingers: h = smax(h, fn(P), 0.004)
        return smax(h, thumb(P), 0.006)
    lo = np.minimum(W, W + d * 0.2) - 0.06; hi = np.maximum(W, W + d * 0.2) + 0.06
    return hand, (lo, hi)

def foot_part(sx, leg):
    ax = sx * at(leg, ANKLE_Y + 0.02, 'cx')
    A = np.array([ax, ANKLE_Y + 0.01, -0.006]); H = np.array([ax, 0.035, -0.048]); Bl = np.array([ax + sx * 0.007, 0.024, FOOT_LEN - 0.1]); T = np.array([ax + sx * 0.012, 0.018, FOOT_LEN - 0.03])
    def foot(P):
        Q = P.copy(); Q[:, 0] = ax + (P[:, 0] - ax) * 0.8; Q[:, 1] = P[:, 1] * 1.3         # (flatter than round, wider than deep)
        f = smax(capsule(P, A, H, 0.031, 0.03), capsule(Q, H * np.array([1, 1.3, 1]), Bl * np.array([1, 1.3, 1]), 0.032, 0.034), 0.012)
        f = smax(f, capsule(Q, Bl * np.array([1, 1.3, 1]), T * np.array([1, 1.3, 1]), 0.034, 0.022), 0.008)
        return np.minimum(f, P[:, 1] - 0.002)       # (the sole flat on the deck)
    return foot, (np.array([ax - 0.08, -0.01, -0.1]), np.array([ax + 0.08, ANKLE_Y + 0.06, FOOT_LEN + 0.02]))

def front_z(Sf, y, x=0.0):
    lo, hi = -0.05, 0.3
    for _ in range(30):
        m = (lo + hi) / 2
        if Sf.f(np.array([[x, y, m]]))[0] > 0: lo = m
        else: hi = m
    return lo
def his_axis(T):
    """His parts' frame: the scrotum's centre and radii, the penis's root (well up in the body) and tip."""
    zp = front_z(T, CROTCH_Y + 0.025)
    return (np.array([0.0, CROTCH_Y - 0.02, zp - 0.03]), np.array([0.026, 0.031, 0.023]), np.array([0.0, CROTCH_Y + 0.05, zp - 0.026]),
            np.array([0.0, CROTCH_Y - 0.05, zp + 0.024]))      # (forward enough to hang clear of the scrotum's front, not lying on it)
def his_root(torso, leg):
    """Where his penis leaves the body (along its line, the first point outside the trunk and thighs), and its line: the lift's pivot."""
    St, Sl = Surface(torso), [Surface(leg, 1), Surface(leg, -1)]
    S0, R0, A, tip = his_axis(St); u = (tip - A) / np.linalg.norm(tip - A)
    P = A[None, :] + np.arange(0, 0.12, 0.001)[:, None] * u[None, :]
    s = ss(CROTCH_Y - 0.012, CROTCH_Y + 0.04, P[:, 1]); t = s * St.f(P) + (1 - s) * np.maximum(Sl[0].f(P), Sl[1].f(P))
    i = int(np.argmax(t < 0)); return P[i], u

# her outer forms: either side of the middle at the front of the crotch, hanging a little below it between the thighs (centre, radii)
LAB_C, LAB_R = np.array([0.0078, 0.001, 0.028]), np.array([0.0125, 0.024, 0.021])
def sex_parts(sex, T, k=(1.0, 1.0, 1.0)):
    """Hers: the two outer forms at the bottom of the mons, rounded, hanging a little below the crotch between the thighs (meeting them at a
    crease), the slit between them where they meet. His: the scrotum and penis, hanging, their roots well up
    in the body so they join it without a crease; k: (girth, length, scrotum) for the shape keys toward smaller or larger. Returns the forms
    to join to the body, a field to cut from it, and how softly they're joined. Simple, soft forms, as the rest is."""
    if sex == 'f':
        # (k: fuller and parting, with her response: fuller forward and down, hardly at all sideways into the thighs, parting a millimetre)
        C = LAB_C + np.array([(k[1] - 1) * 0.004, CROTCH_Y, 0.0]); R_ = LAB_R * np.array([1 + (k[0] - 1) * 0.3, k[0], k[0]])
        def parts(P):
            # (each its own rounded form, the two meeting in the middle in a narrow V: the slit between them is where they meet)
            fl = [(1 - np.linalg.norm((P - C * np.array([sx, 1, 1])) / R_, axis=1)) * R_.min() for sx in (1, -1)]
            return smax(fl[0], fl[1], 0.002)
        return parts, None, 0.007

    kg, kl, ks = k
    S0, R0, A, tip = his_axis(T); R0 = R0 * ks
    B = A + (tip - A) * kl
    def parts(P):
        q = np.linalg.norm((P - S0) / R0, axis=1); scrotum = (1 - q) * R0.min()
        return smax(scrotum, capsule(P, A, B, 0.016 * kg, 0.0148 * kg), 0.004)      # (only a tight join: lifting, it comes away clean)
    return parts, None, 0.026

def body_field(torso, leg, arm, sex, sexk=(1.0, 1.0, 1.0)):
    """The body's parts as fields, and how they're joined: the trunk, the legs and arms (the measured surfaces), the hands and feet, the sex."""
    hk = HAND_K[sex]
    _ty = np.array([r['y'] for r in sorted(torso, key=lambda r: r['y'])]); _tc = np.array([r['cz'] for r in sorted(torso, key=lambda r: r['y'])])
    at_cz = lambda y: np.interp(y, _ty, _tc)
    S_ = {'torso': Surface(torso), 'legL': Surface(leg, 1), 'legR': Surface(leg, -1), 'armL': Surface(arm, 1, arm_axis(1)), 'armR': Surface(arm, -1, arm_axis(1))}
    H = {'handL': hand_parts(1, hk), 'handR': hand_parts(-1, hk)}; Ft = {'footL': foot_part(1, leg), 'footR': foot_part(-1, leg)}
    comps = {k: v.f for k, v in S_.items()}; comps.update({k: v[0] for k, v in H.items()}); comps.update({k: v[0] for k, v in Ft.items()})
    add, cut, ksex = sex_parts(sex, S_['torso'], sexk)
    if add: comps['sex'] = add
    dr = DELT_R[sex] * float(np.interp(0.06, [r['y'] for r in arm], [r['rx'] for r in arm])) / 0.0397
    for sx, s_ in ((1, 'L'), (-1, 'R')):
        C = arm_at(sx, 0.008) + np.array([sx * 0.004, 0, 0.0])
        comps['delt' + s_] = lambda P, C=C, dr=dr: dr - np.linalg.norm(P - C, axis=1)
    # (hers: the inner thighs eased back a little at their tops, so a small gap opens below her forms rather than the thighs closing over them)
    gap = (lambda P: 0.008 * np.exp(-(P[:, 0] / 0.02) ** 2) * ss(CROTCH_Y - 0.11, CROTCH_Y - 0.05, P[:, 1]) * ss(CROTCH_Y + 0.015, CROTCH_Y - 0.005, P[:, 1])
           * ss(-0.075, -0.035, P[:, 2])) if sex == 'f' else (lambda P: 0.0)
    def trunk(P, ct=None, legs=None):
        if ct is None: ct = comps['torso'](P); legs = np.maximum(comps['legL'](P), comps['legR'](P)) - gap(P)
        s = ss(CROTCH_Y - 0.012, CROTCH_Y + 0.04, P[:, 1])
        return s * ct + (1 - s) * legs
    def F(P):
        c = {k: fn(P) for k, fn in comps.items()}
        legs = np.maximum(c['legL'], c['legR']) - gap(P)
        # the trunk hands over to the thighs across the crotch: above it the trunk alone (the hips one form), below it the two thighs, and
        # between, the one form drawn in to the two (the crotch, front and back, rounding as it closes)
        f = trunk(P, c['torso'], legs)
        # (behind, where the seat's underside meets the thighs, the two forms' blend evened out up and down: a gaussian over heights, so the
        # seat rounds under into the fold without a dent where one hands over to the other)
        m = ss(CROTCH_Y - 0.035, CROTCH_Y - 0.012, P[:, 1]) * ss(CROTCH_Y + 0.085, CROTCH_Y + 0.055, P[:, 1]) * ss(-0.004, -0.024, P[:, 2] - at_cz(P[:, 1])) * ss(0.2, 0.16, np.abs(P[:, 0]))
        i = np.where(m > 1e-3)[0]
        if len(i):
            Q = P[i]; acc = np.zeros(len(i)); ws = 0.0
            for dy in (-0.03, -0.015, 0.0, 0.015, 0.03):
                w = math.exp(-0.5 * (dy / 0.016) ** 2); ws += w; acc += w * trunk(Q + np.array([0.0, dy, 0.0]))
            f[i] = f[i] + m[i] * (acc / ws - f[i])
        # each arm: the measured arm, the hand, and over the top of the joint the deltoid's cap, a round form the trunk's slope runs onto
        for sx, s_ in ((1, 'L'), (-1, 'R')):
            a = smax(smax(c['arm' + s_], c['hand' + s_], 0.008), c['delt' + s_], 0.02)
            f = smax(f, a, 0.022)
        f = smax(f, c['footL'], 0.014); f = smax(f, c['footR'], 0.014)
        if add: f = smax(f, c['sex'], ksex)      # (his a soft join, no crease where it meets the body; hers closer, a crease against the thighs)
        if cut: f = f - cut(P)
        return f, c
    return F

def march(F, h=0.003, lo=(-0.33, -0.004, -0.18), hi=(0.33, 1.62, 0.27)):
    """The field sampled on a grid (h apart) and its surface drawn by marching cubes."""
    from skimage import measure
    t0 = time.time()
    xs = np.arange(lo[0], hi[0], h); ys = np.arange(lo[1], hi[1], h); zs = np.arange(lo[2], hi[2], h)
    vol = np.empty((len(xs), len(ys), len(zs)), np.float32)
    X_, Z_ = np.meshgrid(xs, zs, indexing='ij')
    for j, y in enumerate(ys):
        P = np.stack([X_.ravel(), np.full(X_.size, y), Z_.ravel()], 1)
        vol[:, j, :] = F(P)[0].reshape(X_.shape)
    v, faces, nrm, _ = measure.marching_cubes(vol, level=0.0, spacing=(h, h, h))
    v = v + np.array(lo)
    print('field', vol.shape, 'sampled in', round(time.time() - t0, 1), 's; surface', len(v), 'points')
    return v, faces

def remesh(ob, voxel=0.0025, smooth=4, faces=38000):
    """The fitted skin made one clean surface: a voxel remesh takes the union of everything inside it (no doubled layers where the skin's
    branches overlapped, no folds), then a light smoothing and a decimation back to a working density."""
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    r = ob.modifiers.new('rm', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel; r.adaptivity = 0.0; r.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier='rm')
    if smooth:
        sm = ob.modifiers.new('sm', 'LAPLACIANSMOOTH'); sm.iterations = smooth; sm.lambda_factor = 0.6; sm.use_volume_preserve = True
        bpy.ops.object.modifier_apply(modifier='sm')
    d = ob.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = min(1.0, faces / max(1, len(ob.data.polygons)))
    bpy.ops.object.modifier_apply(modifier='dec')
    ob.select_set(False)

def build(sex):
    global SH_X
    SH_X = SH_XS[sex]          # (a man's shoulders broader: his arms hang further out)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    torso, leg, arm = (TORSO, LEG, ARM) if sex == 'f' else (male(TORSO, 'torso'), male(LEG, 'leg'), male(ARM, 'arm'))
    F = body_field(torso, leg, arm, sex)
    V, Fc = march(F)
    me = bpy.data.meshes.new('Body'); body = bpy.data.objects.new('Body', me); bpy.context.scene.collection.objects.link(body)
    me.from_pydata([toB(p) for p in V], [], [tuple(f[::-1]) for f in Fc]); me.update()
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    sm = body.modifiers.new('sm', 'LAPLACIANSMOOTH'); sm.iterations = 2; sm.lambda_factor = 0.5; sm.use_volume_preserve = True; bpy.ops.object.modifier_apply(modifier='sm')
    d = body.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = min(1.0, 44000 / max(1, len(me.polygons))); bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    body.select_set(False)
    X, ed = mesh_arrays(body); Nrm = normals(body)
    _, comp = F(X); names = list(comp); label = np.array(names)[np.argmax(np.stack([comp[k] for k in names]), 0)]
    if sex == 'f' and 'sex' in comp: label[comp['sex'] > -0.002] = 'sex'      # (her forms lie within the trunk's own field below the crotch: by nearness)
    print(sex, 'verts', len(X), {k: int((label == k).sum()) for k in names})
    # shape keys: each point of the trunk and limbs moved along its normal to where the variant's field crosses zero
    def along(Fn, P, n):
        """How far along its normal each point's surface lies in the field Fn: the crossing (inside to outside, going out) nearest the point
        itself, refined (not just any crossing in reach, which under an arm can be the body's other surface across the gap)."""
        ts = np.arange(-0.04, 0.1501, 0.005)
        inside = np.stack([Fn(P + t * n)[0] > 0 for t in ts], 1)
        cross = inside[:, :-1] & ~inside[:, 1:]
        cost = np.where(cross, np.abs((ts[:-1] + ts[1:]) / 2)[None, :], np.inf)
        k = np.argmin(cost, 1); ok = np.isfinite(cost[np.arange(len(P)), k])
        lo = ts[k].copy(); hi = ts[k + 1].copy()
        for _ in range(14):
            m = (lo + hi) / 2; ins = Fn(P + m[:, None] * n)[0] > 0; lo = np.where(ins, m, lo); hi = np.where(ins, hi, m)
        return np.where(ok, (lo + hi) / 2, np.nan)
    limb = ~np.char.startswith(label.astype(str), 'hand') & ~np.char.startswith(label.astype(str), 'foot')
    t_base = along(F, X, Nrm)
    for pgn in body.data.polygons: pgn.use_smooth = True
    body.shape_key_add(name='Basis')
    for v, fns in VARIANTS.items():
        if (v.startswith('bust') and sex == 'm') or (v in ('sexLarge', 'sexSmall') and sex == 'f'): continue
        sk = fns.get('sex', (1.0, 1.0, 1.0)); sk = sk[sex] if isinstance(sk, dict) else sk
        Fv = body_field(fns['torsoP'](torso) if 'torsoP' in fns else scaled(torso, fns['torso']), scaled(leg, fns['leg']), scaled(arm, fns['arm']), sex, sk)
        t_v = along(Fv, X, Nrm)
        dt = np.where(limb & ~np.isnan(t_v) & ~np.isnan(t_base), t_v - t_base, 0.0)
        if v == 'sexSwell': dt = np.where(label == 'sex', dt, np.clip(dt, -0.003, 0.003))      # (only the sex fills out; the skin by it barely moves)
        # (a fuller build fills the cheeks out, and the cleft between them deepens: its floor and inner walls barely move, rather than being
        # carried back with them into a ridge where the two sides meet)
        clf = (np.abs(X[:, 0]) < 0.035) & (X[:, 2] < -0.02) & (X[:, 1] > CROTCH_Y - 0.07) & (X[:, 1] < CROTCH_Y + 0.22) & (label != 'sex')
        dt = np.where(clf & (dt > 0), dt * (0.12 + 0.88 * ss(0.006, 0.032, np.abs(X[:, 0]))), dt)
        acc = np.zeros(len(X)); cnt = np.zeros(len(X))
        for _ in range(3):
            acc[:] = 0; cnt[:] = 0; np.add.at(acc, ed[:, 0], dt[ed[:, 1]]); np.add.at(acc, ed[:, 1], dt[ed[:, 0]]); np.add.at(cnt, ed.ravel(), 1)
            dt = 0.5 * dt + 0.5 * np.where(cnt > 0, acc / np.maximum(cnt, 1), dt)
        Yv = X + dt[:, None] * Nrm
        # (a fuller seat or thighs close the cleft between them, but never quite shut it: each side kept a few millimetres off the middle, so
        # the two never pass through each other)
        lim = np.minimum(np.abs(X[:, 0]), 0.003); sg = np.where(X[:, 0] >= 0, 1.0, -1.0)
        near = (np.abs(X[:, 0]) < 0.06) & (X[:, 1] > CROTCH_Y - 0.32) & (X[:, 1] < CROTCH_Y + 0.22) & (label != 'sex')
        bad = near & ((Yv[:, 0] * sg) < lim)
        Yv[bad, 0] = sg[bad] * lim[bad]
        if sex == 'f' and v != 'sexSwell':      # (her forms the same whatever the build; round them, the thighs fill out but never in over them)
            Yv[label == 'sex'] = X[label == 'sex']
            ring = (label != 'sex') & (np.abs(X[:, 0]) < 0.045) & (X[:, 1] > CROTCH_Y - 0.06) & (X[:, 1] < CROTCH_Y + 0.02) & (X[:, 2] > -0.015)
            Yv[ring, 0] = sg[ring] * np.maximum(Yv[ring, 0] * sg[ring], np.abs(X[ring, 0]))
        k = body.shape_key_add(name=v, from_mix=False); k.data.foreach_set('co', np.stack([Yv[:, 0], -Yv[:, 2], Yv[:, 1]], 1).ravel())
    ink_weights(body)
    a = body.data.attributes.new('_PART', 'FLOAT', 'POINT'); a.data.foreach_set('value', (label == 'sex').astype(np.float32))
    J = joints(sex, torso, leg, arm, None)
    rig = armature('Rig', J)
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    sex_weights(body, X, label, sex, torso, leg)
    print(sex, 'groups', len(body.vertex_groups))
    return body, rig, J, (torso, leg, arm, label)


def sex_weights(body, X, label, sex, torso, leg):
    """His sex goes with the pelvis (the automatic weighting splits it between the thighs, which tears it as the legs part): on it all hips,
    blending back to the automatic weights over a centimetre and a half round it. Hers goes each side with its own thigh. His penis, from where it leaves the body to the tip, then
    goes onto its own bone for the lift, all of it from where it leaves the body (so it lifts straight)."""
    parts = sex_parts(sex, Surface(torso))[0]
    k = ss(-0.015, -0.002, parts(X))
    w = np.zeros(len(X)); vg = body.vertex_groups; hips = vg['hips'].index; gs = vg.get('sex'); thL = vg['thighL'].index; thR = vg['thighR'].index
    if sex == 'm':
        E, u = his_root(torso, leg); S0, R0, A, tip = his_axis(Surface(torso))
        cap = capsule(X, A, tip, 0.016, 0.0148); scr = (1 - np.linalg.norm((X - S0) / R0, axis=1)) * R0.min()
        # (the whole length rigidly, so it lifts straight: blending only across the centimetre where it leaves the body)
        w = ss(-0.004, 0.003, cap - scr) * ss(-0.006, 0.006, (X - E) @ u) * (label == 'sex')
    for v in body.data.vertices:
        i = v.index; own = gs.index if gs else -1
        if k[i] <= 0 and w[i] <= 0 and not (gs and any(g.group == own for g in v.groups)): continue
        gw = {g.group: g.weight for g in v.groups if g.group != own}
        if gs and any(g.group == own for g in v.groups): gs.remove([i])
        tot = sum(gw.values()); gw = {gi: wt / tot for gi, wt in gw.items()} if tot > 0 else {hips: 1.0}
        gw = {gi: wt * (1 - k[i]) for gi, wt in gw.items()}
        if sex == 'f':
            # (hers: each form with its own thigh, so they go together as the hips roll: mostly the thigh at the bottom, mostly the pelvis where they
            # meet the mons; across the middle shared between the two thighs)
            th = 0.2 + 0.72 * ss(CROTCH_Y + 0.02, CROTCH_Y - 0.015, X[i, 1]); lf = ss(-0.004, 0.004, X[i, 0])
            for gi, wt in ((hips, 1 - th), (thL, th * lf), (thR, th * (1 - lf))): gw[gi] = gw.get(gi, 0.0) + k[i] * wt
        else: gw[hips] = gw.get(hips, 0.0) + k[i]
        member = {g.group for g in v.groups}
        for gi, wt in gw.items():
            if wt * (1 - w[i]) > 1e-5: vg[gi].add([i], float(wt * (1 - w[i])), 'REPLACE')
            elif gi in member: vg[gi].remove([i])
        if w[i] > 1e-4: gs.add([i], float(w[i]), 'REPLACE')
    print(sex, 'sex weights: with the pelvis', int((k > 0.5).sum()), 'points;', ('lift on its bone %d points' % int((w > 0.5).sum())) if sex == 'm' else '')

def ink_weights(ob, reach=0.016):
    """How far each point's outline may stand out: where the skin faces more of itself close across a crease (the cleft, between the thighs,
    under the bust), less, so that two sides' outlines don't reach through each other. Taken from the narrowest the gap gets, as built and
    with each shape key (and the fuller ones together)."""
    import bmesh
    from mathutils.bvhtree import BVHTree
    kb = ob.data.shape_keys.key_blocks; n = len(ob.data.vertices)
    get = lambda k: (lambda a: (k.data.foreach_get('co', a), a.reshape(-1, 3))[1])(np.zeros(n * 3))
    base = get(kb[0]); D = {k.name: get(k) - base for k in kb[1:]}
    full = [k for k in ('muscle', 'soft', 'bust', 'sexLarge') if k in D]
    configs = [base] + [base + d for d in D.values()] + [base + sum(D[k] for k in full)]
    gap = np.full(n, 1.0)
    for co in configs:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        for v, c in zip(bm.verts, co): v.co = Vector(c)
        bm.normal_update(); bvh = BVHTree.FromBMesh(bm)
        for v in bm.verts:
            hit = bvh.ray_cast(v.co + v.normal * 1e-4, v.normal, reach)
            if hit[0] is not None: gap[v.index] = min(gap[v.index], hit[3])
        bm.free()
    ink = np.clip((gap - 0.001) / reach, 0.1, 1.0).astype(np.float32)
    a = ob.data.attributes.new('_INK', 'FLOAT', 'POINT'); a.data.foreach_set('value', ink)
    print('ink: thinned at', int((ink < 0.99).sum()), 'of', n, 'points')


# ── Clothes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
# Each garment is a shell drawn by marching cubes round the body's own surfaces, eased out from them: each row's outline made convex (cloth
# stretched over the body bridges its hollows: between the breasts, the cleft, the spine's groove), and hanging (going down the body, the cloth
# comes in no faster than its slope allows: it falls from the bust and the shoulder blades and the seat rather than following the body in). Cut
# clean at its edges by planes (hem, collar, cuffs, waist, leg openings), weighted from the skin under it, and given the body's shape keys.
def hull_rows(T):
    """Each row's outline (radii round its centre) made convex: its support function, then the radius of the hull along each angle."""
    C = np.cos(ANG[:, None] - ANG[None, :])            # [θ, angle]
    near = np.abs(angdiff(ANG[:, None], ANG[None, :])) < np.pi / 2 - 0.02
    out = np.empty_like(T)
    for i, r in enumerate(T):
        h = (C * r[None, :]).max(1)
        out[i] = np.where(near, h[None, :] / np.maximum(C, 1e-6), np.inf).min(1)
    return out

class Cloth(Surface):
    def __init__(self, P, ease, mirror=1, frame=None, hull=True, slope=0.0, below=9.0):
        super().__init__(P, mirror, frame)
        if hull: self.T = hull_rows(self.T)
        self.T = self.T + np.array([ease(y) for y in self.y])[:, None]
        if slope > 0:
            c, s_ = np.cos(ANG), np.sin(ANG)
            for i in range(len(self.y) - 2, -1, -1):
                if self.y[i] > below: continue
                dy = self.y[i + 1] - self.y[i]
                ci = self.cx[i] * c + self.cz[i] * s_; cu = self.cx[i + 1] * c + self.cz[i + 1] * s_
                self.T[i] = np.maximum(ci + self.T[i], cu + self.T[i + 1] - slope * dy) - ci

def seat_marks(F, x):
    """Down the back of the seat at x: where it's fullest, the fold below (where it's come in 2.2 cm), its top above (5 cm in)."""
    def back(y):
        lo, hi = 0.0, -0.25
        for _ in range(30):
            m = (lo + hi) / 2
            if F(np.array([[x, y, m]]))[0][0] > 0: lo = m
            else: hi = m
        return lo
    ys = np.arange(CROTCH_Y - 0.15, CROTCH_Y + 0.3, 0.004); d = np.array([back(y) for y in ys]); i = int(np.argmin(d))
    fold = next((ys[j] for j in range(i, -1, -1) if d[j] > d[i] + 0.022), ys[0]); top = next((ys[j] for j in range(i, len(ys)) if d[j] > d[i] + 0.05), ys[-1])
    return float(ys[i]), float(fold), float(top)

def landmarks(sex, torso):
    L = {'crotch': CROTCH_Y, 'hip': HIP_Y, 'knee': KNEE_Y, 'ankle': ANKLE_Y, 'shoulder': SH_Y, 'armpit': ym(armpit_py), 'neck': ym(neck_py), 'chin': ym(chin_py),
         'wrist': WRIST_Y, 'elbow': ELBOW_Y, 'height': HEIGHT_F}
    L['waist'] = float(min(np.arange(CROTCH_Y + 0.1, ym(armpit_py), 0.005), key=lambda y: at(torso, y, 'rx')))
    L['hem'] = CROTCH_Y + 0.05; L['hemUp'] = L['waist'] + 0.045
    L['collar'] = L['neck'] + 0.02; L['neckline'] = L['neck'] + 0.004
    L['cuffA'] = ARM_LEN - 0.014; L['rollA'] = ARM_LEN * 0.6
    L['trouserTop'] = L['waist'] - 0.012; L['trouserFoot'] = 0.115
    L['briefTop'] = CROTCH_Y + (0.135 if sex == 'f' else 0.155); L['briefLeg'] = CROTCH_Y - (0.0 if sex == 'f' else 0.075)
    L['briefCut'] = [0.022, CROTCH_Y - 0.03, 0.64]
    if sex == 'm': _, _, A_, t_ = his_axis(Surface(torso)); L['sexRest'] = float(math.atan2(t_[2] - A_[2], A_[1] - t_[1]))      # (how far forward of straight down he hangs)       # (her leg openings: a line from beside the gusset's bottom (x, y) rising at this slope to the hip)
    L['downTop'] = KNEE_Y + 0.085; L['briefDown'] = CROTCH_Y - 0.115
    L['bootTop'] = 0.205; L['hipX'] = float(at(LEG, CROTCH_Y - 0.02, 'cx')); L['shX'] = SH_X; L['abd'] = ABD
    return {k: ([float(a) for a in v] if isinstance(v, list) else float(v)) for k, v in L.items()}

def mesh_from(name, V, Fc, faces):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.from_pydata([toB(p) for p in V], [], [tuple(f[::-1]) for f in Fc]); me.update()
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    sm = ob.modifiers.new('sm', 'LAPLACIANSMOOTH'); sm.iterations = 2; sm.lambda_factor = 0.5; sm.use_volume_preserve = True; bpy.ops.object.modifier_apply(modifier='sm')
    d = ob.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = min(1.0, faces / max(1, len(me.polygons))); bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    ob.select_set(False)
    return ob

def cut(ob, planes):
    """Cut the shell along planes (point, normal, in our coordinates), clearing the side each normal points to; then drop any scraps. A plane
    can be limited to part of the shell: (point, normal, which), `which` choosing points (ours) to cut among."""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for pl in planes:
        P, n = pl[0], pl[1]
        if len(pl) > 2:
            X = np.array([fromB(v.co) for v in bm.verts]); ok = pl[2](X); bm.verts.index_update()
            faces = [f for f in bm.faces if all(ok[v.index] for v in f.verts)]
            geom = list({v for f in faces for v in f.verts}) + list({e for f in faces for e in f.edges}) + faces
        else: geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=toB(P), plane_no=toB(n), clear_outer=True)
    # (only pieces of any size: a plane can leave crumbs)
    seen = set(); parts = []
    for f in bm.faces:
        if f in seen: continue
        stack = [f]; comp = []; seen.add(f)
        while stack:
            g = stack.pop(); comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen: seen.add(h); stack.append(h)
        parts.append(comp)
    big = max(len(c) for c in parts)
    junk = [f for c in parts if len(c) < max(60, big * 0.02) for f in c]
    if junk: bmesh.ops.delete(bm, geom=junk, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    for pg in ob.data.polygons: pg.use_smooth = True

def body_data(body):
    """The body's weights (vertices × groups) and its shape keys' offsets, for passing on to what's worn over it."""
    names = [g.name for g in body.vertex_groups]; n = len(body.data.vertices)
    W = np.zeros((n, len(names)))
    for v in body.data.vertices:
        for g in v.groups: W[v.index, g.group] = g.weight
    co = np.zeros(n * 3); body.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    keys = {}
    if body.data.shape_keys:
        for kb in body.data.shape_keys.key_blocks[1:]:
            k = np.zeros(n * 3); kb.data.foreach_get('co', k); keys[kb.name] = k.reshape(-1, 3) - co
    return names, W, co, keys

def dress_from(ob, body, BD, label, allowed, rig, split=None):
    """A garment's weights and shape keys, from the nearest skin of the parts it covers (inverse-distance over a few neighbours). split:
    (which, allowed2): its points `which` picks (a function of points, ours) take theirs from the parts `allowed2` instead."""
    from mathutils.kdtree import KDTree
    names, W, co, keys = BD
    def tree(allow):
        idx = np.where(np.isin(label, allow))[0]; kd = KDTree(len(idx))
        for j, i in enumerate(idx): kd.insert(co[i], j)
        kd.balance(); return kd, idx
    T1 = tree(allowed); me = ob.data; n = len(me.vertices)
    other = np.zeros(n, bool)
    if split:
        X = np.array([fromB(v.co) for v in me.vertices]); other = split[0](X); T2 = tree(split[1])
    G = np.zeros((n, W.shape[1])); D = {k: np.zeros((n, 3)) for k in keys}
    for v in me.vertices:
        kd, idx = T2 if other[v.index] else T1
        hits = kd.find_n(v.co, 6); w = np.array([1 / (h[2] + 0.004) ** 2 for h in hits]); w /= w.sum(); src = idx[[h[1] for h in hits]]
        G[v.index] = w @ W[src]
        for k in keys: D[k][v.index] = w @ keys[k][src]
    vg = {nm: ob.vertex_groups.new(name=nm) for nm in names}
    for i in range(n):
        top = np.argsort(G[i])[-4:]; tot = G[i, top].sum()
        for g in top:
            if G[i, g] > 1e-4: vg[names[g]].add([i], float(G[i, g] / tot), 'REPLACE')
    if keys:
        ob.shape_key_add(name='Basis')
        bco = np.zeros(n * 3); me.vertices.foreach_get('co', bco); bco = bco.reshape(-1, 3)
        for k in keys:
            kb = ob.shape_key_add(name=k, from_mix=False); kb.data.foreach_set('co', (bco + D[k]).ravel())
    m = ob.modifiers.new('Rig', 'ARMATURE'); m.object = rig; ob.parent = rig

def garments(sex, torso, leg, arm, body, label, rig):
    L = landmarks(sex, torso); BD = body_data(body); out = []
    L['seatPeak'], L['seatFold'], L['seatTop'] = seat_marks(body_field(torso, leg, arm, sex), L['hipX'] * 0.8)
    print(sex, 'seat: fullest', round(L['seatPeak'], 3), 'fold', round(L['seatFold'], 3), 'top', round(L['seatTop'], 3), 'crotch', round(CROTCH_Y, 3))
    hk = HAND_K[sex]; legs_ = lambda Ls: (lambda P: np.maximum(Ls[0].f(P), Ls[1].f(P)))
    lerp_crotch = lambda T, Lf: (lambda P: (lambda s: s * T.f(P) + (1 - s) * Lf(P))(ss(CROTCH_Y - 0.012, CROTCH_Y + 0.04, P[:, 1])))
    dr = DELT_R[sex] * float(np.interp(0.06, [r['y'] for r in arm], [r['rx'] for r in arm])) / 0.0397
    def make(name, fn, lo, hi, faces, planes, allowed, h=0.003, split=None):
        V, Fc = march(lambda P: (fn(P), None), h=h, lo=lo, hi=hi)
        ob = mesh_from(name, V, Fc, faces); cut(ob, planes); dress_from(ob, body, BD, label, allowed, rig, split)
        print(sex, name, len(ob.data.vertices), 'verts'); out.append(ob); return ob
    TORSO_L = ['torso', 'legL', 'legR']; ARMS_L = ['armL', 'armR', 'deltL', 'deltR']; LEGS_L = ['legL', 'legR']; FEET_L = ['footL', 'footR', 'legL', 'legR']
    up_ = (0, 1.0, 0); down_ = (0, -1.0, 0)
    # (the layers, inside out: briefs, trousers over them, a top over those; each kept a few millimetres clear of what's under it, so they never
    # cross as they're drawn)
    Tb = Cloth(torso, lambda y: 0.0045, slope=1.2, below=CROTCH_Y + 0.12)
    Lb = [Cloth(leg, lambda y: 0.0045, sx) for sx in (1, -1)]
    briefs_f = lerp_crotch(Tb, legs_(Lb))
    # (his held in a pouch, close against him: a rounded form in front of the crotch, not the shape of what's in it; its size follows his by
    # the garments' own shape keys)
    pouch = None
    if sex == 'm':
        zp = front_z(Surface(torso), CROTCH_Y + 0.025); PC = np.array([0.0, CROTCH_Y + 0.014, zp - 0.022]); PR = np.array([0.042, 0.056, 0.03])
        pouch = lambda P: (1 - np.linalg.norm((P - PC) / PR, axis=1)) * PR.min()
        briefs_f = (lambda b: lambda P: smax(b(P), pouch(P), 0.03))(briefs_f)
    else:      # (hers: the gusset carried down round her forms, smooth over them)
        GC = np.array([0.0, CROTCH_Y - 0.004, LAB_C[2]]); GR = np.array([0.026, 0.024, 0.026])
        gus = lambda P: (1 - np.linalg.norm((P - GC) / GR, axis=1)) * GR.min()
        briefs_f = (lambda b: lambda P: smax(b(P), gus(P), 0.014))(briefs_f)
    def pouch_keys(ob, base_f, gap):
        """The pouch's size with his: the garment's sexLarge and sexSmall keys, where the pouch is, moved out from its middle (or in)."""
        if pouch is None or not ob.data.shape_keys: return
        kbs = ob.data.shape_keys.key_blocks; n = len(ob.data.vertices)
        b = np.zeros(n * 3); kbs['Basis'].data.foreach_get('co', b); Xb = b.reshape(-1, 3); X = np.stack([Xb[:, 0], Xb[:, 2], -Xb[:, 1]], 1)
        wp = ss(-0.003, 0.004, pouch(X) + gap - base_f(X)) * ss(PC[2] - 0.035, PC[2] - 0.01, X[:, 2])
        d = (X - PC) / PR; d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
        for k, amt in (('sexLarge', 0.007), ('sexSmall', -0.004), ('sexSwell', 0.012)):
            if k not in kbs: continue
            c = np.zeros(n * 3); kbs[k].data.foreach_get('co', c); c = c.reshape(-1, 3)
            mv = d * amt * wp[:, None]; c = c * (1 - wp[:, None]) + (Xb + np.stack([mv[:, 0], -mv[:, 2], mv[:, 1]], 1)) * wp[:, None]
            kbs[k].data.foreach_set('co', c.ravel())
    Tt = Cloth(torso, lambda y: 0.01, slope=0.7, below=CROTCH_Y + 0.13)
    leg_ease = lambda y: 0.009 + 0.011 * ss(0.33, 0.2, y)
    Lt = [Cloth(leg, leg_ease, sx) for sx in (1, -1)]
    over = lambda f_in, gap, top_y: (lambda P: f_in(P) + gap - 0.08 * ss(top_y - 0.004, top_y + 0.016, P[:, 1]))
    trousers_f = (lambda base, inner: lambda P: np.maximum(base(P), inner(P)))(lerp_crotch(Tt, legs_(Lt)), over(briefs_f, 0.008, L['briefTop']))
    under_top = over(trousers_f, 0.01, L['trouserTop'])
    tl = (-0.27, CROTCH_Y - 0.02, -0.2); th = (0.27, L['collar'] + 0.03, 0.24)
    # ── the tops: the uniform's jacket (fitted, a stand collar, long sleeves) and the off-duty shirt (easier, open at the neck, sleeves rolled);
    # each with its hem down over the hips, or raised above the waist and rolled
    for nm, ease0, slope, neck_planes, sleeves in [
            ('Tunic', 0.011, 0.5, [((0, L['collar'], 0), up_)], 'long'),
            ('Shirt', 0.014, 0.32, [((0, L['neckline'], 0.0), (0, math.cos(0.42), math.sin(0.42)))], 'rolled')]:
        # the sleeves: down the arm from over the shoulder's cap to the cuff (or rolled to the forearm)
        a_end = L['cuffA'] if sleeves == 'long' else L['rollA']
        sl_ease = (lambda a: 0.0085 + 0.003 * ss(0.15, ARM_LEN, a)) if sleeves == 'long' else (lambda a, e=a_end: 0.011 + 0.011 * gauss(a - (e - 0.012), 0.012))
        S_ = [Cloth(arm, sl_ease, sx, arm_axis(1)) for sx in (1, -1)]
        C_ = [arm_at(sx, 0.008) + np.array([sx * 0.004, 0, 0.0]) for sx in (1, -1)]
        def sleeve(P, S_=S_):
            f = -np.ones(len(P))
            for S1, C in zip(S_, C_): f = np.maximum(f, smax(S1.f(P), dr + 0.006 - np.linalg.norm(P - C, axis=1), 0.02))
            return f
        cuffs = []
        for sx in (1, -1):
            J, d, e1 = arm_axis(sx); cuffs.append((tuple(arm_at(sx, a_end)), tuple(d)))
        for up in (False, True):
            hem = L['hemUp'] if up else L['hem']
            ease = lambda y, hem=hem, up=up, ease0=ease0: (ease0 - 0.004 * ss(L['neck'] - 0.03, L['neck'] + 0.01, y) + (0.012 * gauss(y - (hem + 0.005), 0.007) if up else 0.004 * ss(hem + 0.08, hem, y)))
            T = Cloth(torso, ease, slope=slope, below=L['armpit'] + 0.04)
            # (joined smoothly over the shoulder and round the armhole; lower down, where the sleeve hangs by the hip, kept apart)
            def top(P, T=T, sleeve=sleeve):
                k = 0.001 + 0.022 * ss(L['armpit'] - 0.07, L['armpit'] + 0.01, P[:, 1])
                a, b = np.maximum(T.f(P), under_top(P)), sleeve(P); h = np.maximum(k - np.abs(a - b), 0) / k
                return np.maximum(a, b) + h * h * k * 0.25
            is_sl = lambda X, T=T, sleeve=sleeve: sleeve(X) > T.f(X)
            planes = [((0, hem, 0), down_, lambda X, f=is_sl: ~f(X))] + [(c[0], c[1], is_sl) for c in cuffs] + neck_planes
            make(nm + ('Up' if up else ''), top, (-0.42, min(hem, WRIST_Y) - 0.04, -0.2), (0.42, L['collar'] + 0.03, 0.24), 11000 if not up else 9000, planes, TORSO_L, split=(is_sl, ARMS_L + ['torso']))
    # ── the trousers: up to the waist, the legs easing out over the boots; or lowered, bunched round the knees with the seat's cloth hanging between
    tr = make('Trousers', trousers_f, (-0.25, 0.09, -0.19), (0.25, L['trouserTop'] + 0.03, 0.2), 8000,
              [((0, L['trouserTop'], 0), up_), ((0, L['trouserFoot'], 0), down_)], TORSO_L)
    pouch_keys(tr, lerp_crotch(Tt, legs_(Lt)), 0.014)
    K = KNEE_Y
    def bunch(y):
        b = ss(K + 0.09, K + 0.03, y) * ss(K - 0.13, K - 0.03, y)
        return 0.008 + b * (0.024 + 0.006 * math.sin(y * 150)) + 0.011 * ss(0.33, 0.2, y) + 0.012 * gauss(y - (L['downTop'] - 0.008), 0.008)
    Ld = [Cloth(leg, bunch, sx) for sx in (1, -1)]
    def sling(y0, b0, drop, ease, th_):
        """What's lowered, between the legs: the garment's seat, crotch and front still one piece, slung between the two legs from the
        waistband stretched across them, front and back, down to the gusset sagging between (a trough: two walls the legs' depth apart, a
        rounded bottom, deepest midway between the legs)."""
        xc = at(leg, y0, 'cx'); zc = at(leg, y0, 'cz'); a = (at(leg, y0, 'zF') + at(leg, y0, 'zB')) / 2 + ease
        def f(P):
            x, y, z = P[:, 0], P[:, 1], P[:, 2]
            b = b0 + drop * np.cos(np.clip(x / xc, -1, 1) * np.pi / 2)
            u = (z - zc) / a; v = np.minimum(y - y0, 0) / b; e = np.sqrt(u * u + v * v)
            g = np.sqrt((u / a) ** 2 + (v / b) ** 2) / np.maximum(e, 1e-6)
            return np.minimum(th_ - np.abs((e - 1) / np.maximum(g, 1e-6)), xc - np.abs(x))
        return f
    sl_t = sling(L['downTop'] - 0.014, 0.02, 0.05, 0.016, 0.0045)
    make('TrousersDown', lambda P: smax(legs_(Ld)(P), sl_t(P), 0.01), (-0.25, 0.09, -0.16), (0.25, L['downTop'] + 0.03, 0.16), 6000,
         [((0, L['downTop'], 0), up_), ((0, L['trouserFoot'], 0), down_)], LEGS_L)
    # ── underwear: briefs (trunks, for the men), close-fitting; or lowered round the thighs
    if sex == 'f':     # (cut high at the sides: up from the crotch to the hip)
        bx, by, bk = L['briefCut']
        legcut = [((sx * bx, by, 0), (sx * bk, -1.0, 0)) for sx in (1, -1)]
    else:
        legcut = [((0, L['briefLeg'], 0), down_)]
    br = make('Briefs', briefs_f, (-0.24, CROTCH_Y - 0.12, -0.18), (0.24, L['briefTop'] + 0.03, 0.18), 3500,
              [((0, L['briefTop'], 0), up_)] + legcut, TORSO_L)
    pouch_keys(br, lerp_crotch(Tb, legs_(Lb)), 0.0)
    yb = L['briefDown']
    Lbd = [Cloth(leg, lambda y: 0.006 + 0.004 * gauss(y - (yb + 0.004), 0.008), sx) for sx in (1, -1)]
    sl_b = sling(yb - 0.002, 0.012, 0.034, 0.008, 0.0038)
    make('BriefsDown', lambda P: smax(legs_(Lbd)(P), sl_b(P), 0.008), (-0.24, yb - 0.1, -0.16), (0.24, yb + 0.03, 0.16), 3200,
         [((0, yb + 0.006, 0), up_), ((0, yb - 0.062, 0), down_)], LEGS_L, h=0.0025)
    # ── boots: round the foot and up the shin, a sole and heel under them, flat on the deck
    Lk = [Cloth(leg, lambda y: 0.0095 + 0.003 * ss(0.12, 0.2, y), sx) for sx in (1, -1)]
    ft = [foot_part(sx, leg)[0] for sx in (1, -1)]
    def boot(P):
        f = -np.ones(len(P))
        for Lk1, fo in zip(Lk, ft):
            fv = fo(P); b = smax(Lk1.f(P), fv + 0.009, 0.02)
            sole = np.minimum(fv + 0.014, 0.018 - P[:, 1])
            f = np.maximum(f, np.maximum(b, sole))
        return np.minimum(f, P[:, 1])
    make('Boots', boot, (-0.25, -0.004, -0.15), (0.25, L['bootTop'] + 0.03, 0.3), 5000, [((0, L['bootTop'], 0), up_)], FEET_L)
    return out, L

def export(sex, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    path = os.path.join(OUT, 'meridian_' + sex + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True, export_morph=True, export_morph_normal=False, export_attributes=True,
                              export_animations=False, export_yup=True, export_apply=False, export_materials='NONE')
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'meridian_' + sex + '.blend'))
    print('exported', path, round(os.path.getsize(path) / 1e6, 2), 'MB')

if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['f', 'm']
    # (how the models sit against the turnaround they were measured from: for model.html's overlay)
    try: prev = json.load(open(os.path.join(OUT, 'meridian_meta.json')))
    except Exception: prev = {}
    prev.update({'pxPerM': 1 / S, 'sole': sole, 'cx': cx, 'cz': float(cz), 'views': REF['views'], 'size': REF['size'], 'height': HEIGHT_F})
    json.dump(prev, open(os.path.join(OUT, 'meridian_meta.json'), 'w'), indent=1)
    meta_path = os.path.join(OUT, 'meridian_meta.json')
    for sex in only:
        body, rig, J, (torso, leg, arm, label) = build(sex)
        clothes, LM = garments(sex, torso, leg, arm, body, label, rig)
        export(sex, [body, rig] + clothes)
        meta = json.load(open(meta_path)); meta[sex] = {'landmarks': LM, 'joints': {n: list(p) for n, (par, p) in J.items()}, 'parents': {n: par for n, (par, p) in J.items()}}
        json.dump(meta, open(meta_path, 'w'), indent=1)
