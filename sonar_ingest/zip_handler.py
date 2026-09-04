"""
zip_handler.py
===============
Parses the "practical" upload format: a ZIP file containing

    my_survey.zip
    ├── images/
    │   ├── frame_0001.png
    │   ├── frame_0002.png
    │   └── ...
    └── metadata.csv   (or metadata.json)

The metadata sidecar has one row per image with:
    image_filename, latitude, longitude, depth_meters, timestamp, heading

This is what you actually get from the public training datasets (which have
no embedded GPS at all, since they're lab-captured) once you've paired them
with either a real navigation log or a synthetic demo track.

This handler is deliberately forgiving:
- Accepts CSV or JSON metadata, auto-detected.
- Accepts metadata.csv at the zip root OR inside the images folder.
- Matches filenames case-insensitively and ignores path prefixes.
- Any image with no matching metadata row is still ingested (so a bad upload
  doesn't fail entirely), but is clearly flagged with location_source="missing"
  and later interpolated / marked synthetic - never silently dropped.
"""

from __future__ import annotations
import csv
import io
import json
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None
from PIL import Image

from .common import SonarFrame, IngestionError, IngestionWarning

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
METADATA_FILENAMES = {"metadata.csv", "metadata.json", "nav.csv", "navigation.csv"}

REQUIRED_FIELDS = {"latitude", "longitude"}
OPTIONAL_FIELDS = {"depth_meters", "timestamp", "heading", "image_filename", "filename"}

TIMESTAMP_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S.%f",
    "%d-%m-%Y %H:%M:%S",
]


# ---------------------------------------------------------------------------
# Metadata parsing
# ---------------------------------------------------------------------------

def _parse_timestamp(value: str) -> Optional[datetime]:
    if not value:
        return None
    value = value.strip()
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _normalize_key(filename: str) -> str:
    """Match by basename only, case-insensitive, so it doesn't matter if the
    metadata says 'images/frame_0001.png' or just 'frame_0001.PNG'."""
    return PurePosixPath(filename).name.lower()


def _parse_csv_metadata(raw_bytes: bytes) -> Dict[str, dict]:
    text = raw_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        raise IngestionError("Metadata CSV appears to be empty.")

    fieldnames_lower = {f.lower().strip(): f for f in reader.fieldnames}
    filename_col = fieldnames_lower.get("image_filename") or fieldnames_lower.get("filename")
    if filename_col is None:
        raise IngestionError(
            "Metadata CSV must have an 'image_filename' (or 'filename') column."
        )

    missing_required = REQUIRED_FIELDS - set(fieldnames_lower.keys())
    if missing_required:
        raise IngestionError(
            f"Metadata CSV is missing required column(s): {sorted(missing_required)}"
        )

    records: Dict[str, dict] = {}
    for row in reader:
        fname = row.get(filename_col, "").strip()
        if not fname:
            continue
        key = _normalize_key(fname)

        def _get_float(col_name):
            val = row.get(fieldnames_lower.get(col_name, ""), "")
            try:
                return float(val) if val not in (None, "") else None
            except ValueError:
                return None

        records[key] = {
            "latitude": _get_float("latitude"),
            "longitude": _get_float("longitude"),
            "depth_meters": _get_float("depth_meters"),
            "heading": _get_float("heading"),
            "timestamp": _parse_timestamp(row.get(fieldnames_lower.get("timestamp", ""), "")),
        }
    return records


def _parse_json_metadata(raw_bytes: bytes) -> Dict[str, dict]:
    data = json.loads(raw_bytes.decode("utf-8"))

    # Accept either a flat list of records, or {"detections":[...]} /
    # {"frames":[...]} wrapper shapes.
    if isinstance(data, dict):
        for key in ("frames", "detections", "records", "images"):
            if key in data and isinstance(data[key], list):
                data = data[key]
                break

    if not isinstance(data, list):
        raise IngestionError(
            "Metadata JSON must be a list of records, or an object containing "
            "a 'frames'/'images' list of records."
        )

    records: Dict[str, dict] = {}
    for row in data:
        fname = row.get("image_filename") or row.get("filename")
        if not fname:
            continue
        key = _normalize_key(fname)
        records[key] = {
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "depth_meters": row.get("depth_meters"),
            "heading": row.get("heading"),
            "timestamp": _parse_timestamp(row.get("timestamp", "")) if isinstance(row.get("timestamp"), str) else None,
        }
    return records


def _load_metadata_from_zip(zf: zipfile.ZipFile) -> Tuple[Dict[str, dict], List[IngestionWarning]]:
    warnings: List[IngestionWarning] = []
    names = zf.namelist()

    meta_name = None
    for name in names:
        if PurePosixPath(name).name.lower() in METADATA_FILENAMES:
            meta_name = name
            break

    if meta_name is None:
        warnings.append(IngestionWarning(
            "No metadata.csv / metadata.json found in the ZIP. All images "
            "will be ingested with a synthetic placeholder location - "
            "provide a metadata sidecar for real geotagging."
        ))
        return {}, warnings

    raw_bytes = zf.read(meta_name)
    if meta_name.lower().endswith(".json"):
        records = _parse_json_metadata(raw_bytes)
    else:
        records = _parse_csv_metadata(raw_bytes)

    return records, warnings


# ---------------------------------------------------------------------------
# Image loading
# ---------------------------------------------------------------------------

def _read_image_grayscale(raw_bytes: bytes) -> np.ndarray:
    """Decode image bytes to a grayscale numpy array, using OpenCV if
    available (faster, handles more sonar-adjacent formats) else Pillow."""
    if cv2 is not None:
        arr = np.frombuffer(raw_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        if img is not None:
            return img
    # Fallback to Pillow
    img = Image.open(io.BytesIO(raw_bytes)).convert("L")
    return np.array(img)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def load_zip(file_path: str) -> Tuple[List[SonarFrame], List[IngestionWarning]]:
    """
    Parse a ZIP of sonar images (+ optional metadata sidecar) into a list
    of SonarFrame objects.
    """
    path = Path(file_path)
    if not path.exists():
        raise IngestionError(f"ZIP file not found: {file_path}")

    if not zipfile.is_zipfile(path):
        raise IngestionError(f"'{path.name}' is not a valid ZIP archive.")

    frames: List[SonarFrame] = []
    all_warnings: List[IngestionWarning] = []

    with zipfile.ZipFile(path) as zf:
        metadata, meta_warnings = _load_metadata_from_zip(zf)
        all_warnings.extend(meta_warnings)

        image_entries = [
            name for name in zf.namelist()
            if PurePosixPath(name).suffix.lower() in IMAGE_EXTENSIONS
            and not name.startswith("__MACOSX")
        ]
        image_entries.sort()  # deterministic, and usually matches capture order

        if not image_entries:
            raise IngestionError(
                f"No image files ({', '.join(sorted(IMAGE_EXTENSIONS))}) found inside '{path.name}'."
            )

        unmatched = 0
        for i, entry in enumerate(image_entries):
            try:
                raw_bytes = zf.read(entry)
                image = _read_image_grayscale(raw_bytes)
            except Exception as e:
                all_warnings.append(IngestionWarning(f"Could not decode image '{entry}': {e}"))
                continue

            key = _normalize_key(entry)
            meta_row = metadata.get(key)

            if meta_row and meta_row.get("latitude") is not None and meta_row.get("longitude") is not None:
                location_source = "real"
                lat, lon = meta_row["latitude"], meta_row["longitude"]
                depth = meta_row.get("depth_meters")
                heading = meta_row.get("heading")
                timestamp = meta_row.get("timestamp")
            else:
                unmatched += 1
                location_source = "missing"
                lat = lon = depth = heading = None
                timestamp = None

            frame = SonarFrame(
                frame_id=f"{path.stem}_{i:06d}",
                image=image,
                source_file=PurePosixPath(entry).name,
                latitude=lat,
                longitude=lon,
                depth_meters=depth,
                heading_degrees=heading,
                timestamp=timestamp,
                location_source=location_source,
            )
            frames.append(frame)

        if unmatched:
            all_warnings.append(IngestionWarning(
                f"{unmatched} of {len(image_entries)} images had no matching "
                "metadata row (filename mismatch or missing entry)."
            ))

    _fill_missing_locations(frames, all_warnings)
    return frames, all_warnings


def _fill_missing_locations(frames: List[SonarFrame], warnings: List[IngestionWarning]) -> None:
    """
    Same interpolation strategy as the XTF handler: fill gaps between known
    points, hold constant at the ends, and mark everything as fully synthetic
    if there was no real metadata at all.
    """
    n = len(frames)
    valid_idx = [i for i, f in enumerate(frames) if f.has_valid_location()]

    if not valid_idx:
        # No metadata at all - generate a simple synthetic straight-line
        # track so the dashboard/report still has *something* to plot,
        # clearly flagged as synthetic (never presented as real GPS).
        base_lat, base_lon = 0.0, 0.0
        for i, f in enumerate(frames):
            f.latitude = base_lat + i * 0.0001
            f.longitude = base_lon + i * 0.0001
            f.location_source = "synthetic"
        warnings.append(IngestionWarning(
            "No usable metadata was found for any image - a synthetic demo "
            "track was generated. Replace with a real metadata.csv for "
            "actual survey coordinates."
        ))
        return

    if len(valid_idx) == n:
        return

    for i, f in enumerate(frames):
        if f.has_valid_location():
            continue
        before = max([j for j in valid_idx if j < i], default=None)
        after = min([j for j in valid_idx if j > i], default=None)

        if before is not None and after is not None:
            t = (i - before) / (after - before)
            f.latitude = frames[before].latitude + t * (frames[after].latitude - frames[before].latitude)
            f.longitude = frames[before].longitude + t * (frames[after].longitude - frames[before].longitude)
        elif before is not None:
            f.latitude, f.longitude = frames[before].latitude, frames[before].longitude
        else:
            f.latitude, f.longitude = frames[after].latitude, frames[after].longitude

        f.location_source = "interpolated"
