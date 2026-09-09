#!/usr/bin/env python3
"""Verify generated pet animation dimensions, alpha, frame counts, and padding."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


SPECIES = ("alpaca", "hedgehog", "otter", "red-panda", "sika-deer")
FORMS = ("baby", "adult", "magic")
STATES = ("normal", "happy", "eat", "sleep", "sad")
FRAME_SIZE = 128


def verify(root: Path) -> dict:
    errors = []
    strip_count = 0
    frame_count = 0
    gif_count = 0

    for species in SPECIES:
        species_dir = root / species
        for form in FORMS:
            form_dir = species_dir / form
            for state in STATES:
                strip_path = form_dir / f"{state}.png"
                if not strip_path.exists():
                    errors.append(f"missing strip: {strip_path}")
                    continue
                strip = Image.open(strip_path)
                strip_count += 1
                if strip.mode != "RGBA":
                    errors.append(f"not RGBA: {strip_path} ({strip.mode})")
                if strip.size != (512, 128):
                    errors.append(f"wrong strip size: {strip_path} ({strip.size})")
                alpha = strip.convert("RGBA").getchannel("A")
                for corner in ((0, 0), (511, 0), (0, 127), (511, 127)):
                    if alpha.getpixel(corner) != 0:
                        errors.append(f"opaque strip corner: {strip_path} {corner}")

                for index in range(1, 5):
                    frame_path = form_dir / "frames" / state / f"{index:02d}.png"
                    if not frame_path.exists():
                        errors.append(f"missing frame: {frame_path}")
                        continue
                    frame = Image.open(frame_path)
                    frame_count += 1
                    if frame.mode != "RGBA":
                        errors.append(f"not RGBA: {frame_path} ({frame.mode})")
                    if frame.size != (128, 128):
                        errors.append(f"wrong frame size: {frame_path} ({frame.size})")
                    frame_alpha = frame.convert("RGBA").getchannel("A")
                    bbox = frame_alpha.getbbox()
                    if bbox is None:
                        errors.append(f"empty frame: {frame_path}")
                    elif bbox[0] <= 0 or bbox[1] <= 0 or bbox[2] >= 128 or bbox[3] >= 128:
                        errors.append(f"subject touches frame edge: {frame_path} {bbox}")
                    for corner in ((0, 0), (127, 0), (0, 127), (127, 127)):
                        if frame_alpha.getpixel(corner) != 0:
                            errors.append(f"opaque frame corner: {frame_path} {corner}")

                gif_path = form_dir / "gifs" / f"{state}.gif"
                if not gif_path.exists():
                    errors.append(f"missing gif: {gif_path}")
                else:
                    animation = Image.open(gif_path)
                    gif_count += 1
                    if getattr(animation, "n_frames", 1) != 4:
                        errors.append(
                            f"wrong gif frame count: {gif_path} "
                            f"({getattr(animation, 'n_frames', 1)})"
                        )

            full_path = form_dir / "full.png"
            if not full_path.exists() or Image.open(full_path).size != (128, 128):
                errors.append(f"missing or invalid full preview: {full_path}")

        preview_path = species_dir / "preview.png"
        if not preview_path.exists() or Image.open(preview_path).size != (128, 128):
            errors.append(f"missing or invalid species preview: {preview_path}")
        preview_gif_path = species_dir / "preview-normal.gif"
        if not preview_gif_path.exists():
            errors.append(f"missing species animation preview: {preview_gif_path}")
        else:
            preview_gif = Image.open(preview_gif_path)
            if getattr(preview_gif, "n_frames", 1) != 4:
                errors.append(f"wrong species preview frame count: {preview_gif_path}")

    return {
        "ok": not errors,
        "species": len(SPECIES),
        "forms": len(SPECIES) * len(FORMS),
        "state_strips": strip_count,
        "individual_frames": frame_count,
        "state_gifs": gif_count,
        "errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    report = verify(args.root)
    report_path = args.root / "verification-report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
