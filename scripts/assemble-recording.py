#!/usr/bin/env python3
"""Assemble CDP screencast JPEG frames into an animated GIF (screen recording).

Usage: python3 scripts/assemble-recording.py <frames_dir> <output.gif> <max_width>
Frames are sampled to ~10 fps and resized to max_width.
"""
import sys
from pathlib import Path

from PIL import Image

frames_dir = Path(sys.argv[1])
output = Path(sys.argv[2])
max_width = int(sys.argv[3])

paths = sorted(frames_dir.glob("frame-*.jpg"))
if not paths:
    raise SystemExit(f"no frames in {frames_dir}")

# Screencast at ~30 fps -> keep every 2nd frame for a ~15 fps GIF.
sampled = paths[::2] or paths
images = []
for p in sampled:
    img = Image.open(p).convert("RGB")
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, round(img.height * ratio)), Image.LANCZOS)
    images.append(img)

images[0].save(
    output,
    save_all=True,
    append_images=images[1:],
    duration=66,
    loop=0,
    optimize=True,
)
print(f"wrote {output} ({len(images)} frames, {output.stat().st_size} bytes)")
