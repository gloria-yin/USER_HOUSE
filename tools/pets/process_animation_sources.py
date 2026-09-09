#!/usr/bin/env python3
"""Convert 4x5 chroma-key pet action sheets into runtime-sized sprite assets."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image


COLS = 4
ROWS = 5
FRAME_SIZE = 128
MAX_SUBJECT_SIZE = 116
BASELINE = 122
STATES = ("normal", "happy", "eat", "sleep", "sad")
FORMS = ("baby", "adult", "magic")
SOURCE_RE = re.compile(
    r"^(?P<species>.+)-(?P<form>baby|adult|magic)-actions-source-v(?P<version>\d+)\.png$"
)


def proportional_bounds(length: int, count: int) -> list[int]:
    return [round(index * length / count) for index in range(count + 1)]


def content_aware_bounds(alpha: Image.Image, count: int, axis: str) -> list[int]:
    mask = alpha.point(lambda value: 255 if value >= 96 else 0)
    if axis == "x":
        profile = list(mask.resize((mask.width, 1), Image.Resampling.BOX).getdata())
    else:
        profile = list(mask.resize((1, mask.height), Image.Resampling.BOX).getdata())

    length = len(profile)
    nominal_cell = length / count
    bounds = [0]
    window_radius = max(2, round(nominal_cell * 0.012))
    search_radius = round(nominal_cell * 0.22)

    for boundary_index in range(1, count):
        expected = round(boundary_index * nominal_cell)
        start = max(bounds[-1] + 1, expected - search_radius)
        end = min(length - 1, expected + search_radius)

        def score(position: int) -> tuple[int, int]:
            left = max(0, position - window_radius)
            right = min(length, position + window_radius + 1)
            return sum(profile[left:right]), abs(position - expected)

        bounds.append(min(range(start, end + 1), key=score))
    bounds.append(length)
    return bounds


def load_cells(source: Image.Image) -> tuple[list[list[dict]], list[int], list[int]]:
    alpha = source.getchannel("A")
    x_bounds = content_aware_bounds(alpha, COLS, "x")
    y_bounds = content_aware_bounds(alpha, ROWS, "y")
    rows: list[list[dict]] = []

    for row in range(ROWS):
        row_cells = []
        for col in range(COLS):
            crop = source.crop(
                (x_bounds[col], y_bounds[row], x_bounds[col + 1], y_bounds[row + 1])
            )
            alpha = crop.getchannel("A")
            bbox = alpha.getbbox()
            if bbox is None:
                raise ValueError(f"Empty frame at row {row + 1}, column {col + 1}")
            row_cells.append({"image": crop, "bbox": bbox})
        rows.append(row_cells)
    return rows, x_bounds, y_bounds


def normalize_cells(rows: list[list[dict]]) -> tuple[list[list[Image.Image]], float]:
    max_width = max(cell["bbox"][2] - cell["bbox"][0] for row in rows for cell in row)
    max_height = max(cell["bbox"][3] - cell["bbox"][1] for row in rows for cell in row)
    scale = min(MAX_SUBJECT_SIZE / max_width, MAX_SUBJECT_SIZE / max_height)
    normalized: list[list[Image.Image]] = []

    for row in rows:
        bottom_margins = [cell["image"].height - cell["bbox"][3] for cell in row]
        grounded_margin = min(bottom_margins)
        output_row = []

        for cell, bottom_margin in zip(row, bottom_margins):
            left, top, right, bottom = cell["bbox"]
            subject = cell["image"].crop((left, top, right, bottom))
            width = max(1, round(subject.width * scale))
            height = max(1, round(subject.height * scale))
            subject = subject.resize((width, height), Image.Resampling.NEAREST)

            frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            x = (FRAME_SIZE - width) // 2
            jump_offset = round((bottom_margin - grounded_margin) * scale)
            dest_bottom = BASELINE - jump_offset
            y = dest_bottom - height
            if y < 2:
                y = 2
            if y + height > FRAME_SIZE - 2:
                y = FRAME_SIZE - 2 - height
            frame.alpha_composite(subject, (x, y))
            output_row.append(frame)
        normalized.append(output_row)

    return normalized, scale


def save_gif(frames: list[Image.Image], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGB", (FRAME_SIZE * len(frames), FRAME_SIZE), (255, 0, 255))
    for index, frame in enumerate(frames):
        atlas.paste(frame.convert("RGB"), (index * FRAME_SIZE, 0), frame.getchannel("A"))
    palette_source = atlas.convert(
        "P", palette=Image.Palette.ADAPTIVE, colors=255, dither=Image.Dither.NONE
    )
    palette = palette_source.getpalette() or []
    palette = (palette + [0] * 768)[:768]
    palette[255 * 3 : 255 * 3 + 3] = [255, 0, 255]

    gif_frames = []
    for frame in frames:
        rgb = Image.new("RGB", frame.size, (255, 0, 255))
        rgb.paste(frame.convert("RGB"), (0, 0), frame.getchannel("A"))
        indexed = rgb.quantize(palette=palette_source, dither=Image.Dither.NONE)
        transparent = frame.getchannel("A").point(lambda alpha: 255 if alpha < 96 else 0)
        indexed.paste(255, (0, 0), transparent)
        indexed.putpalette(palette)
        gif_frames.append(indexed)

    gif_frames[0].save(
        destination,
        save_all=True,
        append_images=gif_frames[1:],
        duration=500,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )


def save_form_assets(
    source_path: Path,
    output_root: Path,
    species: str,
    form: str,
    version: int,
) -> dict:
    source = Image.open(source_path).convert("RGBA")
    rows, x_bounds, y_bounds = load_cells(source)
    frames, scale = normalize_cells(rows)
    form_dir = output_root / species / form
    frame_dir = form_dir / "frames"
    gif_dir = form_dir / "gifs"
    form_dir.mkdir(parents=True, exist_ok=True)

    frame_records = []
    all_frames: list[Image.Image] = []
    for state_index, state in enumerate(STATES):
        state_frames = frames[state_index]
        all_frames.extend(state_frames)
        state_frame_dir = frame_dir / state
        state_frame_dir.mkdir(parents=True, exist_ok=True)

        strip = Image.new("RGBA", (FRAME_SIZE * COLS, FRAME_SIZE), (0, 0, 0, 0))
        for frame_index, frame in enumerate(state_frames):
            strip.alpha_composite(frame, (frame_index * FRAME_SIZE, 0))
            frame_path = state_frame_dir / f"{frame_index + 1:02d}.png"
            frame.save(frame_path)
            alpha_bbox = frame.getchannel("A").getbbox()
            frame_records.append(
                {
                    "state": state,
                    "frame": frame_index + 1,
                    "bbox": list(alpha_bbox) if alpha_bbox else None,
                }
            )

        strip.save(form_dir / f"{state}.png")
        save_gif(state_frames, gif_dir / f"{state}.gif")

    save_gif(all_frames, form_dir / "all-states.gif")

    contact = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    x_bounds = proportional_bounds(contact.width, COLS)
    y_bounds = proportional_bounds(contact.height, ROWS)
    for row in range(ROWS):
        for col in range(COLS):
            cell_w = x_bounds[col + 1] - x_bounds[col]
            cell_h = y_bounds[row + 1] - y_bounds[row]
            thumb = frames[row][col].copy()
            thumb.thumbnail((max(1, cell_w - 2), max(1, cell_h - 2)), Image.Resampling.NEAREST)
            x = x_bounds[col] + (cell_w - thumb.width) // 2
            y = y_bounds[row] + (cell_h - thumb.height) // 2
            contact.alpha_composite(thumb, (x, y))
    contact.save(form_dir / "full.png")

    metadata = {
        "species": species,
        "form": form,
        "source": str(source_path),
        "source_version": version,
        "source_size": [source.width, source.height],
        "grid": [COLS, ROWS],
        "detected_x_bounds": x_bounds,
        "detected_y_bounds": y_bounds,
        "states": list(STATES),
        "frame_size": [FRAME_SIZE, FRAME_SIZE],
        "strip_size": [FRAME_SIZE * COLS, FRAME_SIZE],
        "frame_duration_ms": 500,
        "normalization_scale": scale,
        "frames": frame_records,
    }
    (form_dir / "processing.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return metadata


def build_species_previews(output_root: Path, species: str) -> None:
    preview = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    x_bounds = proportional_bounds(preview.width, len(STATES))
    y_bounds = proportional_bounds(preview.height, len(FORMS))

    for row, form in enumerate(FORMS):
        for col, state in enumerate(STATES):
            frame_path = output_root / species / form / "frames" / state / "01.png"
            frame = Image.open(frame_path).convert("RGBA")
            cell_w = x_bounds[col + 1] - x_bounds[col]
            cell_h = y_bounds[row + 1] - y_bounds[row]
            frame.thumbnail((max(1, cell_w - 2), max(1, cell_h - 2)), Image.Resampling.NEAREST)
            x = x_bounds[col] + (cell_w - frame.width) // 2
            y = y_bounds[row] + (cell_h - frame.height) // 2
            preview.alpha_composite(frame, (x, y))
    preview.save(output_root / species / "preview.png")

    normal_animation = []
    for frame_index in range(COLS):
        canvas = Image.new("RGBA", (FRAME_SIZE * len(FORMS), FRAME_SIZE), (0, 0, 0, 0))
        for form_index, form in enumerate(FORMS):
            path = output_root / species / form / "frames" / "normal" / f"{frame_index + 1:02d}.png"
            frame = Image.open(path).convert("RGBA")
            canvas.alpha_composite(frame, (form_index * FRAME_SIZE, 0))
        normal_animation.append(canvas)
    save_gif(normal_animation, output_root / species / "preview-normal.gif")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    selected: dict[tuple[str, str], tuple[int, Path]] = {}
    for path in sorted(args.input_dir.glob("*.png")):
        match = SOURCE_RE.match(path.name)
        if not match:
            continue
        key = (match.group("species"), match.group("form"))
        version = int(match.group("version"))
        if key not in selected or version > selected[key][0]:
            selected[key] = (version, path)

    expected = 5 * len(FORMS)
    if len(selected) != expected:
        raise SystemExit(f"Expected {expected} selected form sheets, found {len(selected)}")

    manifests = []
    for (species, form), (version, path) in sorted(selected.items()):
        manifests.append(save_form_assets(path, args.output_dir, species, form, version))

    species_names = sorted({species for species, _form in selected})
    for species in species_names:
        build_species_previews(args.output_dir, species)

    summary = {
        "species": species_names,
        "forms": list(FORMS),
        "states": list(STATES),
        "frames_per_state": COLS,
        "total_frames": len(manifests) * len(STATES) * COLS,
        "forms_processed": manifests,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "processing-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"forms": len(manifests), "total_frames": summary["total_frames"]}))


if __name__ == "__main__":
    main()
