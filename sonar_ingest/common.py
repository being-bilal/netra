"""
common.py
=========
Defines the ONE unified data structure that both ingestion paths
(.xtf raw sonar files, and .zip image+metadata folders) are converted into.

Everything downstream of ingestion (preprocessing, the YOLO/Faster-RCNN/U-Net
ensemble, and the geotagging/report engine) only ever talks to `SonarFrame`
objects. This means you can swap or add a new upload format later (e.g. .jsf)
without touching any detection or reporting code.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import numpy as np


@dataclass
class SonarFrame:
    """
    One 'ping' / one sonar image, with everything the geotagging engine
    needs attached to it directly.
    """
    frame_id: str                     # unique id, e.g. "DET_SRC_00042"
    image: np.ndarray                 # grayscale sonar image as a numpy array (H x W)
    source_file: str                  # which .xtf / .zip / filename this came from

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    depth_meters: Optional[float] = None
    heading_degrees: Optional[float] = None
    timestamp: Optional[datetime] = None

    # Metadata quality flag - very important for honesty in the final report.
    # "real"       -> came from genuine navigation data (real XTF nav packet,
    #                 or a user-provided metadata sidecar file)
    # "interpolated" -> filled in by straight-line interpolation because some
    #                 rows/pings were missing GPS
    # "synthetic"  -> no navigation data existed at all (e.g. lab watertank
    #                 images); a placeholder track was generated for demo
    #                 purposes only
    location_source: str = "real"

    # Optional extras carried through from XTF headers, useful for judges'
    # "noise filtering" component (pitch/roll/heave cause data dropouts)
    pitch_degrees: Optional[float] = None
    roll_degrees: Optional[float] = None
    sound_velocity: Optional[float] = None

    extra: dict = field(default_factory=dict)

    def has_valid_location(self) -> bool:
        return self.latitude is not None and self.longitude is not None

    def to_metadata_dict(self) -> dict:
        """Flat dict form, handy for CSV/JSON export and debugging."""
        return {
            "frame_id": self.frame_id,
            "source_file": self.source_file,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "depth_meters": self.depth_meters,
            "heading_degrees": self.heading_degrees,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "location_source": self.location_source,
            "pitch_degrees": self.pitch_degrees,
            "roll_degrees": self.roll_degrees,
        }


class IngestionError(Exception):
    """Raised when an uploaded file can't be parsed into SonarFrames at all."""
    pass


class IngestionWarning:
    """
    Non-fatal issue collected during ingestion (e.g. 'GPS missing for 4 of 50
    frames, interpolated'). Collected into a list and shown to the user /
    included in the final report so nothing is silently faked.
    """
    def __init__(self, message: str, frame_id: Optional[str] = None):
        self.message = message
        self.frame_id = frame_id

    def __repr__(self):
        return f"IngestionWarning(frame_id={self.frame_id!r}, message={self.message!r})"
