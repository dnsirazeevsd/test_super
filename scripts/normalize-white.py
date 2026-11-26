#!/usr/bin/env python3
"""Normalize product render backgrounds to pure #FFFFFF.

Finds the near-white background region connected to the image border and
forces it to pure white, preserving the device and its soft contact shadow.
Usage: python3 scripts/normalize-white.py <image> [<image> ...]
"""
import sys

import numpy as np
from scipy import ndimage
from PIL import Image

NEAR_WHITE_THRESHOLD = 242  # default: min(r,g,b) above this counts as background


def normalize(path: str, threshold: int = NEAR_WHITE_THRESHOLD) -> None:
    img = Image.open(path).convert("RGB")
    arr = np.asarray(img).copy()
    near_white = arr.min(axis=2) >= threshold
    labels, _ = ndimage.label(near_white)
    border_labels = set(
        np.unique(
            np.concatenate(
                [labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]
            )
        )
    )
    border_labels.discard(0)
    bg = near_white & np.isin(labels, list(border_labels))
    arr[bg] = 255
    Image.fromarray(arr).save(path, optimize=True)
    print(f"normalized {path} ({bg.mean() * 100:.1f}% of pixels flattened)")


if __name__ == "__main__":
    args = sys.argv[1:]
    threshold = int(args[0]) if args and args[0].isdigit() else NEAR_WHITE_THRESHOLD
    for p in args[1 if threshold != NEAR_WHITE_THRESHOLD else 0:]:
        normalize(p, threshold)
