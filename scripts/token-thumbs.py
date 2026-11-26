# Small images for the portrait and token window (v2.61.2, user report: on a tablet the window took
# long to load and its images vanished while scrolling). Run after adding portraits or frames:
#   python3 scripts/token-thumbs.py
# - Portraits: public/assets/tokens/**/*.{jpg,webp} → public/assets/tokens/thumbs/**/*.webp (128 px);
#   the class portraits (SVG made by scripts/token-portraits.mjs) use the crew thumbnails.
# - Frames: frame-NN.webp (body) + frame-NN-light.webp (light, «screen» on the map) → one flat image
#   with the light already added (no CSS blend modes in the window): frame-NN-thumb.webp (128 px)
#   and frame-NN-flat.webp (256 px, the preview). Over black it is exact; over the window's dark
#   background, the light is added almost as «screen» does.
import pathlib
from PIL import Image
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'tokens'
THUMBS = ROOT / 'thumbs'

def portraits():
    count = 0
    for src in sorted(ROOT.rglob('*')):
        rel = src.relative_to(ROOT)
        if rel.parts[0] in ('thumbs', 'frames') or src.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        out = (THUMBS / rel).with_suffix('.webp')
        out.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(src).convert('RGB')
        im.thumbnail((128, 128), Image.LANCZOS)
        im.save(out, 'WEBP', quality=80, method=6)
        count += 1
    return count

def flat(body, light):
    b = np.asarray(body.convert('RGBA')).astype(np.float32) / 255
    l = np.asarray(light.convert('RGB')).astype(np.float32) / 255
    a = b[..., 3:4]
    over_black = 1 - (1 - b[..., :3] * a) * (1 - l)
    alpha = np.maximum(a, l.max(axis=2, keepdims=True))
    rgb = np.where(alpha > 0, np.clip(over_black / np.maximum(alpha, 1e-6), 0, 1), 0)
    return Image.fromarray((np.dstack([rgb, alpha]) * 255 + 0.5).astype(np.uint8), 'RGBA')

def frames():
    count = 0
    for body_path in sorted((ROOT / 'frames').glob('frame-[0-9][0-9].webp')):
        light_path = body_path.with_name(body_path.stem + '-light.webp')
        image = flat(Image.open(body_path), Image.open(light_path))
        image.save(body_path.with_name(body_path.stem + '-flat.webp'), 'WEBP', quality=80, alpha_quality=70, method=6)
        image.resize((128, 128), Image.LANCZOS).save(body_path.with_name(body_path.stem + '-thumb.webp'), 'WEBP', quality=72, alpha_quality=60, method=6)
        count += 1
    return count

if __name__ == '__main__':
    print(portraits(), 'portrait thumbnails;', frames(), 'flat frames')
