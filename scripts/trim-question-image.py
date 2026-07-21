#!/usr/bin/env python3
"""Trim excessive white margins from generated question PNGs.

The PDF cropper sometimes captures an entire question row even when the
figure is a small object at the left edge. This helper keeps the visible
figure and a little breathing room, while ignoring pale WDA watermarks.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def content_bbox(image: Image.Image, threshold: int) -> tuple[int, int, int, int] | None:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    left, top, right, bottom = width, height, -1, -1

    max_background_channel = 255 - threshold
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            # Keep strong foreground marks only. Pale gray/colored WDA
            # watermarks have enough chroma to confuse a generic detector, so
            # the rule is intentionally based on channel darkness instead.
            if min(r, g, b) <= max_background_channel:
                left = min(left, x)
                top = min(top, y)
                right = max(right, x)
                bottom = max(bottom, y)

    if right < left or bottom < top:
        return None
    return left, top, right + 1, bottom + 1


def trim_image(path: Path, pad: int, threshold: int, min_saved_ratio: float) -> bool:
    image = Image.open(path).convert("RGB")
    width, height = image.size
    bbox = content_bbox(image, threshold)
    if not bbox:
        return False

    left, top, right, bottom = bbox
    crop_left = max(0, left - pad)
    crop_top = max(0, top - pad)
    crop_right = min(width, right + pad)
    crop_bottom = min(height, bottom + pad)
    new_width = crop_right - crop_left
    new_height = crop_bottom - crop_top

    if new_width <= 0 or new_height <= 0:
        return False

    # Avoid tiny cosmetic churn. The helper is for obvious whitespace strips.
    saved_ratio = 1 - ((new_width * new_height) / (width * height))
    if saved_ratio < min_saved_ratio:
        return False

    image.crop((crop_left, crop_top, crop_right, crop_bottom)).save(path)
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument("--pad", type=int, default=16)
    parser.add_argument("--threshold", type=int, default=70)
    parser.add_argument("--min-saved-ratio", type=float, default=0.20)
    args = parser.parse_args()

    changed = 0
    for path in args.paths:
        if trim_image(path, args.pad, args.threshold, args.min_saved_ratio):
            changed += 1
            print(f"trimmed {path}")
    print(f"trimmed {changed}/{len(args.paths)}")


if __name__ == "__main__":
    main()
