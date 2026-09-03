"""
loader.py
=========
Single entry point for the Flask dashboard's upload handler.

    from sonar_ingest.loader import load_sonar_upload

    frames, warnings = load_sonar_upload("uploaded_file.zip")
    # or
    frames, warnings = load_sonar_upload("uploaded_file.xtf")

`frames` is a List[SonarFrame] ready to feed into preprocessing + the
detection ensemble. `warnings` is a list of IngestionWarning to show the
user and/or bake into the final report ("12 frames had interpolated GPS").
"""

from __future__ import annotations
from pathlib import Path
from typing import List, Tuple

from .common import SonarFrame, IngestionError, IngestionWarning
from .xtf_handler import load_xtf
from .zip_handler import load_zip

SUPPORTED_EXTENSIONS = {".xtf", ".zip"}


def load_sonar_upload(file_path: str, **kwargs) -> Tuple[List[SonarFrame], List[IngestionWarning]]:
    """
    Detect file type by extension and dispatch to the right handler.

    Extra kwargs are passed through to the underlying handler
    (e.g. channel=1, max_frames=500 for XTF files).
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".xtf":
        return load_xtf(str(path), **kwargs)
    elif ext == ".zip":
        return load_zip(str(path))
    else:
        raise IngestionError(
            f"Unsupported file type '{ext}'. Supported types: "
            f"{', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )


def summarize_ingestion(frames: List[SonarFrame], warnings: List[IngestionWarning]) -> dict:
    """
    Quick summary dict, handy to show on the dashboard right after upload
    (e.g. 'Loaded 342 frames. 12 had interpolated GPS. 0 fully synthetic.')
    """
    counts = {"real": 0, "interpolated": 0, "synthetic": 0, "missing": 0}
    for f in frames:
        counts[f.location_source] = counts.get(f.location_source, 0) + 1

    return {
        "total_frames": len(frames),
        "location_source_breakdown": counts,
        "warning_count": len(warnings),
        "warnings": [w.message for w in warnings],
    }
