# Builds the layered ASCII portrait assets (back hair, body, hair, face) from 13 key poses.
# Five are marked by hand; the eight in poses/ are marked by optical flow.
# Run in this folder: python build.py  (needs numpy, scipy, opencv-python)
# python build.py PREFIX writes preview strips instead of assets.
# landmarks.txt columns: centre, left, right, up, down (pixels in a 724 px pose).
import sys
import cv2
import numpy as np
from scipy.interpolate import RBFInterpolator

S = 724
KEYS = ['c', 'l', 'r', 'u', 'd']
# Half turns: every one lies between the hand-marked poses of its sides.
HALF = {'l50': 'l', 'r50': 'r', 'u50': 'u', 'd50': 'd', 'lu': 'lu', 'ru': 'ru', 'ld': 'ld', 'rd': 'rd'}
ALL = KEYS + list(HALF)
L = np.array([[list(map(float, p.split(','))) for p in l.split()] for l in open('landmarks.txt')])
# Face outline, clockwise from the hairline peak; same order in every pose.
F = {
    'c': '357,134 405,118 450,125 468,165 484,215 488,260 489,300 480,350 470,390 450,412 430,428 410,440 385,447 360,449 335,447 305,438 285,425 270,412 258,390 250,365 247,345 237,310 235,275 235,235 262,213 280,196 290,176 291,160 284,145 275,127 315,122',
    'l': '257,137 310,118 358,118 390,168 415,215 430,262 443,295 432,350 420,380 400,400 370,412 335,426 290,440 250,447 230,441 220,428 214,408 207,385 203,365 199,348 192,333 188,315 193,285 194,240 199,218 206,202 213,182 216,160 219,150 225,143 243,130',
    'r': '450,136 475,122 497,127 512,152 528,192 536,225 537,262 546,300 546,330 537,368 529,395 522,425 505,443 475,448 440,442 400,432 365,420 330,400 312,380 303,360 299,345 298,310 301,275 305,235 345,220 370,202 388,185 398,162 392,142 385,126 418,120',
    'u': '360,117 410,108 450,118 468,150 483,200 488,240 492,285 489,345 480,380 468,393 445,399 420,400 390,400 360,400 330,400 300,402 285,402 270,397 258,380 250,350 247,330 242,300 240,270 241,235 258,215 275,195 290,175 295,155 290,140 284,122 320,112',
    'd': '367,208 420,180 450,168 475,200 492,240 498,280 493,330 487,360 478,390 465,420 450,450 430,475 400,497 367,504 340,500 318,485 295,465 278,440 268,420 258,390 250,360 247,340 243,320 245,295 265,290 282,275 298,255 300,235 290,215 283,190 325,180',
}
F = {k: np.array([[float(q) for q in p.split(',')] for p in v.split()]) for k, v in F.items()}
# Neck sides: left x, top y, right x, top y, bottom of the hair on the right.
NECK = {'c': (268, 400, 453, 400, 497), 'l': (268, 430, 453, 386, 497), 'r': (284, 402, 460, 430, 497),
        'u': (272, 385, 463, 385, 503), 'd': (277, 430, 460, 430, 497)}
LASH = {'l': [(189, 265, 9)], 'r': [(543, 258, 9)]}
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)


def remap(im, mx, my):
    return cv2.remap(im, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def bleed(rgb, mask):
    m = mask.astype(np.uint8)
    _, lab = cv2.distanceTransformWithLabels(1 - m, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(m)
    lut = np.zeros((lab.max() + 1, 2), int)
    lut[lab[ys, xs]] = np.c_[ys, xs]
    n = lut[lab]
    return rgb[n[..., 0], n[..., 1]]


def key(i):
    b, g, r = cv2.split(i.astype(np.float32))
    a = np.clip(1 - (g - np.maximum(r, b) - 20) / 90, 0, 1)
    a = cv2.GaussianBlur(cv2.erode(a, np.ones((3, 3))), (0, 0), .7)
    g = np.minimum(g, np.maximum(r, b) * .98)
    _, lab, st, _ = cv2.connectedComponentsWithStats((a > .5).astype(np.uint8))
    a = a * cv2.dilate((lab == 1 + np.argmax(st[1:, 4])).astype(np.float32), np.ones((3, 3)))
    return bleed(cv2.merge([b, g, r]), a > .95), a


def poly(points):
    m = np.zeros((S, S), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(points) * 16).astype(np.int32)], 1, shift=4)
    return m


def curve(p, n=10):  # closed Catmull-Rom
    o = []
    for i in range(len(p)):
        a, b, c, d = p[i - 1], p[i], p[(i + 1) % len(p)], p[(i + 2) % len(p)]
        for t in np.arange(n) / n:
            o.append(.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t ** 3))
    return np.array(o)


def soft(m):
    # Signed distance as alpha: blended poses get one clean moving outline.
    m = (m > 0).astype(np.uint8)
    d = cv2.distanceTransform(m, cv2.DIST_L2, 5) - cv2.distanceTransform(1 - m, cv2.DIST_L2, 5)
    return np.clip(.5 + cv2.GaussianBlur(d, (0, 0), .8) / 60, 0, 1).astype(np.float32)


def solid(a):
    return np.clip((a - .5) * 30 + .5, 0, 1)


def shrink(m, n):
    return cv2.erode(m.astype(np.uint8), np.ones((n, n))) > 0


A = cv2.imread('poses-yaw.png')
B = cv2.imread('poses-pitch.png')
img = {k: key(i) for k, i in {'l': A[:, :724], 'c': A[:, 724:1448], 'r': A[:, 1448:], 'u': B[:, :724], 'd': B[:, 1448:]}.items()}
img.update({k: key(cv2.imread(f'poses/{k}.png')) for k in HALF})

# Natural blue irises: the pupil, the highlight and the lashes stay as painted.
IRIS = {'c': [(297, 254), (421, 250)], 'l': [(210, 265), (303, 246)], 'r': [(397, 252), (505, 256)],
        'u': [(302, 227), (423, 225)], 'd': [(306, 317), (425, 316)]}


def paint(k, eyes):
    rgb = img[k][0]
    lum = rgb @ np.array([.114, .587, .299], np.float32)
    for x, y in eyes:
        w = np.clip(12.5 - np.hypot(xx - x, (yy - y) * 1.05), 0, 1)
        w *= (lum > 34) & (lum < 178) & (rgb[..., 2] - rgb[..., 0] < 34)
        w = cv2.GaussianBlur(w.astype(np.float32), (0, 0), .7)[..., None]
        blue = np.array([208, 160, 104], np.float32) * np.clip(.38 + lum / 165, 0, 1.12)[..., None]
        rgb[:] = rgb * (1 - w) + np.minimum(blue, 255) * w


for k, eyes in IRIS.items():
    paint(k, eyes)

back, face, hair, body, visible, fm = {}, {}, {}, {}, {}, {}


def layers(k):
    rgb, a = img[k]
    f = cv2.dilate(poly(curve(F[k])), cv2.getStructuringElement(2, (5, 5)))
    for x, y, r in LASH.get(k, []):
        c = np.zeros((S, S), np.uint8)
        cv2.circle(c, (x, y), r, 1, -1)
        f |= c & (rgb.max(2) < 95).astype(np.uint8)
    lx, ly, rx, ry, hb = NECK[k]
    n = poly([(lx, ly), (rx, ry), (rx, hb - 2), (724, hb + 8), (724, 724), (0, 724), (0, 484), (200, 485), (225, 495), (lx - 12, 494), (lx, 475)])
    n = n & (1 - f)
    h = (a > .5) & (f == 0) & (n == 0)
    fm[k] = f
    visible[k] = (n > 0) & (a > .95)
    face[k] = (bleed(rgb, shrink(f, 3)), soft(f))
    # Hair colour continues, darkened, under the face; alpha stays open there.
    hc = bleed(rgb, shrink(h, 5))
    hc = np.where(((f > 0) | (n > 0))[..., None], hc * .75, hc)
    hair[k] = (np.where(h[..., None], rgb, hc), soft(h))
    under = h | (f > 0) | ((n > 0) & (yy < 470) & (xx > 240) & (xx < 480))
    dark = cv2.GaussianBlur(hc, (0, 0), 4) * .25 + np.array([66, 40, 78]) * .75
    back[k] = (dark, soft(cv2.erode(under.astype(np.uint8), np.ones((5, 5)))))
    # Body: the visible neck, completed with the shadow of the head.
    own = img[k][0]
    lx, rx = NECK[k][0] + 1, NECK[k][2] - 1
    NECKBOX = poly([(lx, 360), (rx, 360), (rx, 505), (lx, 505)]) > 0
    have = shrink(visible[k] | ~NECKBOX & (yy > 470), 5) & (visible[k] | (yy > 500))
    # What the head hides is always in its shadow.
    fill = np.zeros((S, S, 3), np.float32) + np.array([122, 136, 222], np.float32)
    w = cv2.GaussianBlur(cv2.erode(have.astype(np.uint8), np.ones((5, 5))).astype(np.float32), (0, 0), 2.5)
    w = np.where(yy > 500, 1, w)[..., None]
    out = bleed(own, have) * w + fill * (1 - w)
    al = (NECKBOX & (yy <= 505)) | (visible[k] & (yy > 470)) | ((yy > 500) & (img[k][1] > .5))
    out = np.where(visible[k][..., None] & (w > .98), own, out).astype(np.float32)
    # Lift the hard chin shadow to lit skin; a little of its modelling stays.
    lit = np.array([126, 142, 228], np.float32)
    lum = out @ np.array([.114, .587, .299], np.float32)
    dark = np.clip((168 - lum) / 45, 0, 1)
    zone = poly([(lx + 4, 350), (rx - 4, 350), (rx - 4, 500), (430, 560), (300, 530), (lx + 4, 490)]).astype(np.float32)
    zone = cv2.GaussianBlur(zone, (0, 0), 4)
    skin = np.clip((out[..., 2] - out[..., 0] - 20) / 30, 0, 1)
    t = cv2.GaussianBlur((dark * zone * skin).astype(np.float32), (0, 0), 1.2)[..., None]
    out = out + (lit * (.80 + .2 * np.clip(lum / 165, 0, 1))[..., None] - out) * t * .85
    body[k] = (out, soft(al))


# ---- displacement: every pose maps from the centre, separately for hair and face
OUT = [(245, 490), (195, 470), (150, 455), (117, 395), (95, 350), (83, 310), (100, 258), (93, 230), (148, 172), (172, 100), (200, 85),
       (250, 30), (350, 1), (425, 30), (468, 92), (540, 138), (596, 215), (605, 243), (632, 270), (618, 345), (568, 410), (520, 475), (455, 492)]
ROW = {tuple(l[0]): l for l in L}
IX = {tuple(l[0]): i for i, l in enumerate(L)}
FAR = {'l': {(235, 380): (224, 382), (227, 335): (212, 335)}, 'r': {(491, 372): (512, 380), (505, 320): (526, 325)}}


# Hair landmarks: as L, but the far ear slides behind the cheek.
H = L.copy()
for k, v in FAR.items():
    for q, w in v.items():
        H[IX[q], KEYS.index(k)] = w


def outline(k):
    m = (img[k][1] > .5).astype(np.uint8)
    return max(cv2.findContours(m, 0, 1)[0], key=len)[:, 0].astype(float)


def segment(c, p, q, m=7):
    i = np.argmin(((c - p) ** 2).sum(1))
    j = np.argmin(((c - q) ** 2).sum(1))
    N = len(c)
    fw = np.arange(i, i + (j - i) % N + 1) % N
    bw = np.arange(i, i - (i - j) % N - 1, -1) % N
    s = c[fw if len(fw) < len(bw) else bw]
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(s, axis=0), axis=1))]
    if d[-1] < 1:
        return np.repeat(s[:1], m, 0)
    t = np.linspace(0, d[-1], m)
    return np.c_[np.interp(t, d, s[:, 0]), np.interp(t, d, s[:, 1])]


def silhouettes(n):
    c0, c1 = outline('c'), outline(ALL[n])
    a, b = [], []
    for p, q in zip(OUT[:-1], OUT[1:]):
        a.append(segment(c0, ROW[p][0], ROW[q][0])[:-1])
        b.append(segment(c1, H[IX[p], n], H[IX[q], n])[:-1])
    return np.vstack(a), np.vstack(b)


gs = np.linspace(0, S - 1, 93)
GX, GY = np.meshgrid(gs, gs)
G = np.c_[GX.ravel(), GY.ravel()]


def rbf(s, t, smooth):
    _, u = np.unique(np.round(s), axis=0, return_index=True)
    s, t = s[u], t[u]
    d = RBFInterpolator(s, t - s, kernel='linear', smoothing=smooth)(G).reshape(93, 93, 2).astype(np.float32)
    return cv2.resize(d, (S, S), interpolation=cv2.INTER_CUBIC)


def unfold(d):
    for it in range(80):
        X, Y = xx + d[..., 0], yy + d[..., 1]
        J = np.gradient(X, axis=1) * np.gradient(Y, axis=0) - np.gradient(X, axis=0) * np.gradient(Y, axis=1)
        bad = J < .03
        if not bad.any():
            break
        m = cv2.GaussianBlur(cv2.dilate(bad.astype(np.float32), np.ones((11, 11))), (0, 0), 4)[..., None]
        d = d * (1 - m) + cv2.GaussianBlur(d, (0, 0), 5) * m
    return d, it


def grey(layer):
    m = solid(layer[1])[..., None]
    f = layer[0] * m + 90 * (1 - m)
    return cv2.cvtColor(cv2.GaussianBlur(f, (0, 0), 1.6).astype(np.uint8), cv2.COLOR_BGR2GRAY)


def refine(d, c, p, limit, mask):
    for _ in range(2):
        mx, my = xx + d[..., 0], yy + d[..., 1]
        o = cv2.DISOpticalFlow_create(2)
        o.setFinestScale(2)
        fl = o.calc(grey(c), grey((remap(p[0], mx, my), remap(p[1], mx, my))), None)
        fl *= np.minimum(1, limit / np.maximum(np.linalg.norm(fl, axis=2, keepdims=True), 1e-3))
        d = d + cv2.GaussianBlur(fl * mask[..., None], (0, 0), 8)
    return d


DF, DH = {}, {}
TOP = [0, 1, 2, 3, 4, 23, 24, 25, 26, 27, 28, 29, 30]
NEAR = {'l': [5, 6, 7], 'r': [20, 21, 22], 'u': [5, 6, 7, 20, 21, 22], 'd': [5, 6, 7, 20, 21, 22]}
def displace(n):
    k = ALL[n]
    d = rbf(np.vstack([F['c'], L[:28, 0], curve(F['c'], 4)]), np.vstack([F[k], L[:28, n], curve(F[k], 4)]), .4)
    inside = cv2.GaussianBlur(shrink(fm['c'], 25).astype(np.float32), (0, 0), 4)
    DF[k], i1 = unfold(refine(d, face['c'], face[k], 5, inside))
    brow = {tuple(x) for x in L[:41, 0]}
    rows = [m for m in range(35, len(L)) if tuple(L[m, 0]) not in OUT and tuple(L[m, 0]) not in brow]
    a, b = silhouettes(n)
    i = TOP + NEAR.get(k[0] if k[0] in 'lr' else k[0], NEAR['u'])
    fixed = np.array([(x, y) for y in (530, 600, 723) for x in range(0, 724, 60)] + [(268, 480), (453, 490), (360, 520)], float)
    d = rbf(np.vstack([H[rows, 0], a, F['c'][i], fixed]), np.vstack([H[rows, n], b, F[k][i], fixed]), .6)
    DH[k], i2 = unfold(refine(d, hair['c'], hair[k], 8, np.clip((500 - yy) / 20, 0, 1)))
    print(k, 'unfold', i1, i2)


def ease(t):
    t = np.clip((t - .15) / .7, 0, 1)
    return t * t * (3 - 2 * t)


def predict(x, y):
    ax, ay = abs(x), abs(y)
    kx, ky = 'r' if x > 0 else 'l', 'd' if y > 0 else 'u'
    bx, by = ease(ax), ease(ay)
    W = {'c': (1 - bx) * (1 - by), kx: bx * (1 - by / 2), ky: by * (1 - bx / 2)}
    acc = np.full((S, S, 3), (140, 172, 200), np.float32)
    for lay, D in ((back, DH), (body, None), (hair, DH), (face, DF)):
        mx, my = xx.copy(), yy.copy()
        if D:
            disp = D[kx] * ax + D[ky] * ay
            for _ in range(50):
                q = remap(disp, mx, my)
                mx, my = .5 * mx + .5 * (xx - q[..., 0]), .5 * my + .5 * (yy - q[..., 1])
        o, al, total = 0, 0, 0
        for k, w in W.items():
            q = remap(D[k], mx, my) if D and k != 'c' else np.zeros((S, S, 2), np.float32)
            t = remap(lay[k][1], mx + q[..., 0], my + q[..., 1])
            g = w * (solid(t) + .02)
            total = total + g
            o = o + g[..., None] * remap(lay[k][0].astype(np.float32), mx + q[..., 0], my + q[..., 1])
            al = al + w * t
        m = np.clip((al - .5) * 60 + .5, 0, 1)[..., None]
        acc = acc * (1 - m) + o / total[..., None] * m
    return acc.astype(np.uint8)


def mark(k):
    """Landmarks of a half turn: the midpoint, corrected by flow from its prediction."""
    global L, H
    sides = HALF[k]
    x = {'l': -.5, 'r': .5}.get(sides[0], 0)
    y = {'u': -.5, 'd': .5}.get(sides[-1], 0)
    p = predict(x, y)
    a = img[k][1][..., None]
    q = img[k][0] * a + np.array((140, 172, 200)) * (1 - a)
    g = lambda v: cv2.cvtColor(cv2.GaussianBlur(v.astype(np.float32), (0, 0), 1.5).astype(np.uint8), cv2.COLOR_BGR2GRAY)
    o = cv2.DISOpticalFlow_create(2)
    o.setFinestScale(1)
    fl = o.calc(g(p), g(q), None)
    fl = cv2.GaussianBlur(cv2.medianBlur(fl, 5), (0, 0), 4)
    mid = lambda m: m[:, 0] + sum(.5 * (m[:, KEYS.index(t)] - m[:, 0]) for t in sides)
    move = lambda v: v + np.c_[[remap(fl[..., c], v[:, :1].astype(np.float32), v[:, 1:].astype(np.float32))[:, 0] for c in (0, 1)]].T
    L = np.concatenate([L, move(mid(L))[:, None]], 1)
    H = np.concatenate([H, move(mid(H))[:, None]], 1)
    F[k] = move(F['c'] + sum(.5 * (F[t] - F['c']) for t in sides))
    n = np.array(NECK['c'], float) + sum(.5 * (np.array(NECK[t]) - np.array(NECK['c'])) for t in sides)
    NECK[k] = (268, n[1], 453, n[3], n[4])


def tone(k):
    """Generated half turns drift in colour; bring them to the mean of their neighbours."""
    rgb, a = img[k]
    f = fm[k] > 0
    for part, layer in ((f, face), ((a > .5) & ~f & (yy < 400), hair)):
        goal = np.mean([np.median(layer[t][0][layer[t][1] > .55], 0) for t in ('c', *HALF[k])], 0)
        gain = np.clip(goal / np.maximum(np.median(rgb[part], 0), 1), .85, 1.18)
        layer[k] = (np.clip(layer[k][0] * gain, 0, 255), layer[k][1])


for k in KEYS:
    layers(k)
for n in range(1, 5):
    displace(n)
for k in HALF:
    mark(k)
    paint(k, [L[2, -1], L[9, -1]])
    layers(k)
    tone(k)
for n in range(5, len(ALL)):
    displace(n)


def cell(x, y):
    """Bilinear cell of the 5x5 pose grid: (weight, displacement terms, texture) per corner."""
    X, Y = ('l', 'r')[x > 0], ('u', 'd')[y > 0]
    a, b = abs(x) * 2, abs(y) * 2
    i, j = min(int(a), 1), min(int(b), 1)
    u, v = a - i, b - j
    X1, Y1, XY = X + '50', Y + '50', X + Y
    node = {(0, 0): ((), 'c'), (1, 0): (((1, X1),), X1), (2, 0): (((1, X),), X), (0, 1): (((1, Y1),), Y1), (0, 2): (((1, Y),), Y),
            (1, 1): (((1, XY),), XY), (2, 1): (((1, X), (1, XY), (-1, X1)), X), (1, 2): (((1, Y), (1, XY), (-1, Y1)), Y),
            (2, 2): (((1, X), (1, Y), (1, XY), (-1, X1), (-1, Y1)), XY)}
    eu, ev = ease(u), ease(v)
    return [((1 - u if p == 0 else u) * (1 - v if q == 0 else v), (1 - eu if p == 0 else eu) * (1 - ev if q == 0 else ev),
             *node[i + p, j + q]) for p in (0, 1) for q in (0, 1)]


def compose(x, y):
    corners = cell(x, y)
    acc = np.full((S, S, 3), (140, 172, 200), np.float32)
    for lay, D in ((back, DH), (body, None), (hair, DH), (face, DF)):
        mx, my = xx.copy(), yy.copy()
        if D:
            disp = sum(w * sg * D[t] for w, _, terms, _ in corners for sg, t in terms) + np.zeros((S, S, 2), np.float32)
            disp = disp.astype(np.float32)
            for _ in range(50):
                q = remap(disp, mx, my)
                mx, my = .5 * mx + .5 * (xx - q[..., 0]), .5 * my + .5 * (yy - q[..., 1])
        o, al, total = 0, 0, 0
        for _, w, _, k in corners:
            q = remap(D[k], mx, my) if D and k != 'c' else np.zeros((S, S, 2), np.float32)
            t = remap(lay[k][1], mx + q[..., 0], my + q[..., 1])
            g = w * (solid(t) + .02)
            total = total + g
            o = o + g[..., None] * remap(lay[k][0].astype(np.float32), mx + q[..., 0], my + q[..., 1])
            al = al + w * t
        m = np.clip((al - .5) * 60 + .5, 0, 1)[..., None]
        acc = acc * (1 - m) + o / total[..., None] * m
    return acc.astype(np.uint8)


def strip(poses, name):
    r = [compose(*p)[:600] for p in poses]
    cv2.imwrite(name, np.vstack([np.hstack(r[:3]), np.hstack(r[3:])]))


if len(sys.argv) > 1:
    out = sys.argv[1]
    strip([(-.2, 0), (-.35, 0), (-.5, 0), (-.65, 0), (-.8, 0), (-1, 0)], out + '1.png')
    strip([(.2, 0), (.35, 0), (.5, 0), (.65, 0), (.8, 0), (1, 0)], out + '2.png')
    strip([(0, -.5), (0, -.9), (0, .4), (0, .75), (-.6, -.5), (.6, .5)], out + '3.png')
    strip([(-.3, -.3), (.3, -.3), (-.3, .3), (.3, .3), (-.65, .4), (.65, .5)], out + '5.png')
    view = []
    for k in HALF:
        v = np.clip(img[k][0], 0, 255).astype(np.uint8).copy()
        cv2.polylines(v, [np.round(curve(F[k])).astype(np.int32)], True, (0, 255, 0), 1)
        for q in L[:, ALL.index(k)]:
            cv2.circle(v, (int(q[0]), int(q[1])), 2, (255, 80, 0), -1)
        view.append(v[:540])
    cv2.imwrite(out + '6.png', np.vstack([np.hstack(view[:4]), np.hstack(view[4:])]))
    show = lambda l: np.where(l[1][..., None] > .5, l[0], [0, 160, 0])
    cv2.imwrite(out + '4.png', np.hstack([show(l['l']) for l in (back, body, hair, face)]))
else:
    T = 512
    tile = lambda l: cv2.resize(np.dstack([np.clip(l[0], 0, 255), l[1] * 255]).astype(np.float32), (T, T), interpolation=cv2.INTER_AREA)
    tiles = [tile(l[k]) for l in (back, body, hair, face) for k in ALL]
    tiles += [np.zeros_like(tiles[0])] * (56 - len(tiles))  # 8 columns, 7 rows: fits 4096 px
    atlas = np.vstack([np.hstack(tiles[r * 8:r * 8 + 8]) for r in range(7)])
    cv2.imwrite('../../assets/mascot/marilyn-poses.webp', np.clip(atlas, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 80])
    # 65x65 displacement nodes: 12 poses for hair, then for face; int16, 1/8192 of the side
    q = np.linspace(0, S - 1, 65).astype(np.float32)
    qx, qy = np.meshgrid(q, q)
    out = np.stack([remap(cv2.GaussianBlur(D[k], (0, 0), 2), qx, qy) for D in (DH, DF) for k in ALL[1:]]) / S * 8192
    out.round().astype('<i2').tofile('../../assets/mascot/marilyn-poses.bin')
