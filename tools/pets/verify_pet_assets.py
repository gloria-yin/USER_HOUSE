#!/usr/bin/env python3
"""Verify formal pet runtime assets, manifests, CSS mappings, and alpha bounds."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


SPECIES = {
    "otter": "水獭",
    "hedgehog": "刺猬",
    "redpanda": "小熊猫",
    "alpaca": "羊驼",
    "sikadeer": "梅花鹿",
}
FORMS = ("baby", "adult", "magic")
STATES = ("normal", "happy", "eat", "sleep", "sad")


def verify_image(path: Path, size: tuple[int, int], errors: list[str]) -> None:
    if not path.exists():
        errors.append(f"missing image: {path}")
        return

    with Image.open(path) as image:
        if image.mode != "RGBA":
            errors.append(f"not RGBA: {path} ({image.mode})")
        if image.size != size:
            errors.append(f"wrong size: {path} ({image.size}, expected {size})")
            return

        alpha = image.convert("RGBA").getchannel("A")
        width, height = size
        for corner in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)):
            if alpha.getpixel(corner) != 0:
                errors.append(f"opaque corner: {path} {corner}")

        if alpha.getbbox() is None:
            errors.append(f"empty image: {path}")

        if width == 512 and height == 128:
            for frame_index in range(4):
                frame_alpha = alpha.crop((frame_index * 128, 0, (frame_index + 1) * 128, 128))
                bbox = frame_alpha.getbbox()
                if bbox is None:
                    errors.append(f"empty frame {frame_index + 1}: {path}")
                elif bbox[0] <= 0 or bbox[1] <= 0 or bbox[2] >= 128 or bbox[3] >= 128:
                    errors.append(f"subject touches frame edge {frame_index + 1}: {path} {bbox}")


def verify(root: Path) -> dict:
    errors: list[str] = []
    png_count = 0
    strip_count = 0

    for species, display_name in SPECIES.items():
        species_dir = root / species
        manifest_path = species_dir / "manifest.json"
        css_path = species_dir / f"{species}.css"
        readme_path = species_dir / "README.md"

        if not manifest_path.exists():
            errors.append(f"missing manifest: {manifest_path}")
            manifest = {}
        else:
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception as error:
                errors.append(f"invalid manifest: {manifest_path} ({error})")
                manifest = {}

        if manifest.get("species") != species:
            errors.append(f"wrong manifest species: {manifest_path}")
        if manifest.get("displayName") != display_name:
            errors.append(f"wrong displayName: {manifest_path}")
        if manifest.get("frameDurationMs") != 500:
            errors.append(f"wrong frameDurationMs: {manifest_path}")
        if manifest.get("framesPerAnimation") != 4:
            errors.append(f"wrong framesPerAnimation: {manifest_path}")

        if not css_path.exists():
            errors.append(f"missing CSS: {css_path}")
            css = ""
        else:
            css = css_path.read_text(encoding="utf-8")
        if not readme_path.exists():
            errors.append(f"missing README: {readme_path}")

        preview_path = species_dir / "preview.png"
        verify_image(preview_path, (128, 128), errors)
        if preview_path.exists():
            png_count += 1

        for form in FORMS:
            form_dir = species_dir / form
            full_path = form_dir / "full.png"
            verify_image(full_path, (128, 128), errors)
            if full_path.exists():
                png_count += 1

            form_manifest = manifest.get("forms", {}).get(form, {}).get("states", {})
            for state in STATES:
                image_path = form_dir / f"{state}.png"
                verify_image(image_path, (512, 128), errors)
                if image_path.exists():
                    png_count += 1
                    strip_count += 1

                expected_src = f"{form}/{state}.png"
                state_manifest = form_manifest.get(state, {})
                if state_manifest.get("src") != expected_src:
                    errors.append(f"wrong manifest src: {manifest_path} {form}.{state}")
                if state_manifest.get("frameWidth") != 128 or state_manifest.get("frameHeight") != 128:
                    errors.append(f"wrong manifest frame size: {manifest_path} {form}.{state}")
                if state_manifest.get("frames") != 4:
                    errors.append(f"wrong manifest frame count: {manifest_path} {form}.{state}")

                css_rule = f".wb-{species}.{form}.{state}"
                css_src = f"url('./{form}/{state}.png')"
                if css_rule not in css or css_src not in css:
                    errors.append(f"missing CSS mapping: {css_path} {form}.{state}")

        species_pngs = list(species_dir.rglob("*.png"))
        if len(species_pngs) != 19:
            errors.append(f"wrong PNG count: {species_dir} ({len(species_pngs)}, expected 19)")

    return {
        "ok": not errors,
        "species": len(SPECIES),
        "forms": len(SPECIES) * len(FORMS),
        "state_strips": strip_count,
        "runtime_pngs": png_count,
        "errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    report = verify(args.root)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()

