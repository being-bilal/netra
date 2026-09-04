"""
xtf_handler.py
===============
Parses real .xtf (Extended Triton Format) side-scan sonar files.

XTF is a single binary file that interleaves sonar ping packets with
navigation/attitude packets. This is the format produced by most real
side-scan sonar systems (Klein, EdgeTech, Teledyne, etc).

We use the `pyxtf` library to do the low-level binary parsing, and this
module is responsible for:
  1. Pulling per-ping navigation (lat/lon/depth/heading/pitch/roll) straight
     out of the sonar ping header (XTF stores full nav in EVERY ping header,
     not just in separate nav packets).
  2. Converting each ping's acoustic return into a small grayscale image
     "chip" (or building one big waterfall image, your choice - both are
     provided).
  3. Wrapping everything into the shared `SonarFrame` schema.

Install dependency:
    pip install pyxtf --break-system-packages
"""

from __future__ import annotations
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

import numpy as np

from .common import SonarFrame, IngestionError, IngestionWarning

try:
    import pyxtf
    from pyxtf import XTFHeaderType, XTFNavUnits
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "pyxtf is required to parse .xtf files. "
        "Install it with: pip install pyxtf --break-system-packages"
    ) from e


# ---------------------------------------------------------------------------
# Low level helpers
# ---------------------------------------------------------------------------

def _ping_timestamp(ping) -> datetime:
    """XTF stores Year/Month/Day/Hour/Minute/Second/HSeconds directly on
    the ping header. HSeconds is hundredths of a second."""
    try:
        return datetime(
            ping.Year, ping.Month, ping.Day,
            ping.Hour, ping.Minute, ping.Second,
            microsecond=int(ping.HSeconds) * 10_000,
        )
    except Exception:
        # Some malformed/simulated files have zeroed or invalid date fields.
        return datetime(1970, 1, 1)


def _ping_to_image_row(ping, file_header, channel: int) -> np.ndarray:
    """
    Returns the raw 1-D acoustic intensity array for one ping/channel,
    normalized to 0-255 uint8 so it behaves like a normal grayscale image row.
    """
    raw = np.asarray(ping.data[channel])
    if raw.size == 0:
        return np.zeros((1,), dtype=np.uint8)

    raw = raw.astype(np.float32)
    # Sonar returns are often heavily skewed; a log-scale + normalize is the
    # standard way to make side-scan waterfall imagery human/model readable.
    raw = np.log1p(np.abs(raw))
    max_val = raw.max()
    if max_val > 0:
        raw = (raw / max_val) * 255.0
    return raw.astype(np.uint8)


def _choose_coordinates(ping, nav_units: int) -> Tuple[float, float]:
    """
    XTF ping headers carry BOTH ship coordinates (ShipXcoordinate/Y) and
    towfish/sensor coordinates (SensorXcoordinate/Y). For a towed side-scan
    or AUV-mounted sonar, the SENSOR position is the more accurate one to
    geotag detections with, so we prefer it when it looks populated
    (non-zero), falling back to ship coordinates otherwise.

    NavUnits tells us whether X/Y are already lat/lon degrees or projected
    meters. This module only handles the lat/lon case natively; projected
    meter coordinates are passed through as-is with a flag so the caller
    can decide to reproject (e.g. with pyproj) if needed.
    """
    sx, sy = ping.SensorXcoordinate, ping.SensorYcoordinate
    if sx == 0.0 and sy == 0.0:
        sx, sy = ping.ShipXcoordinate, ping.ShipYcoordinate

    # In XTF: X = longitude, Y = latitude (when NavUnits == latlon)
    longitude, latitude = sx, sy
    return latitude, longitude


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def load_xtf(
    file_path: str,
    channel: int = 0,
    max_frames: int = None,
) -> Tuple[List[SonarFrame], List[IngestionWarning]]:
    """
    Parse a .xtf file into a list of SonarFrame objects, one per sonar ping.

    Parameters
    ----------
    file_path : path to the .xtf file
    channel   : which sonar channel to extract as the image (0 = port/first
                channel by default; side-scan sonars usually have channel 0
                = port, channel 1 = starboard)
    max_frames: optional cap, useful for quick previews of huge files

    Returns
    -------
    (frames, warnings)
    """
    path = Path(file_path)
    if not path.exists():
        raise IngestionError(f"XTF file not found: {file_path}")

    warnings: List[IngestionWarning] = []

    try:
        file_header, packets = pyxtf.xtf_read(str(path))
    except Exception as e:
        raise IngestionError(f"Failed to parse XTF file '{path.name}': {e}") from e

    sonar_pings = packets.get(XTFHeaderType.sonar, [])
    if not sonar_pings:
        raise IngestionError(
            f"No sonar ping packets found in '{path.name}'. "
            "This file may only contain bathymetry/navigation data."
        )

    nav_units = getattr(file_header, "NavUnits", XTFNavUnits.latlon)
    if nav_units != XTFNavUnits.latlon:
        warnings.append(IngestionWarning(
            "File header reports coordinates in projected meters, not "
            "lat/lon degrees. Coordinates below are passed through raw; "
            "reproject them (e.g. with pyproj) before trusting the GPS "
            "fields in the report."
        ))

    frames: List[SonarFrame] = []
    pings_to_use = sonar_pings[:max_frames] if max_frames else sonar_pings

    for i, ping in enumerate(pings_to_use):
        try:
            image_row = _ping_to_image_row(ping, file_header, channel)
            # A single ping is only 1 pixel tall; stack a small vertical
            # window so downstream CV models get a real 2D image "chip"
            # rather than a 1-pixel-tall strip. Here we just tile it - in
            # production you'd instead build a rolling waterfall window of
            # N consecutive pings (see build_waterfall_image below).
            image_chip = np.tile(image_row, (64, 1))

            lat, lon = _choose_coordinates(ping, nav_units)
            has_gps = not (lat == 0.0 and lon == 0.0)
            if not has_gps:
                warnings.append(IngestionWarning(
                    f"Ping {ping.PingNumber} has zeroed navigation fields.",
                    frame_id=f"ping_{ping.PingNumber}",
                ))

            frame = SonarFrame(
                frame_id=f"{path.stem}_ping{ping.PingNumber:06d}",
                image=image_chip,
                source_file=path.name,
                latitude=lat if has_gps else None,
                longitude=lon if has_gps else None,
                depth_meters=float(ping.SensorDepth) if ping.SensorDepth else float(ping.ShipDepth) / 10.0,
                heading_degrees=float(ping.SensorHeading),
                timestamp=_ping_timestamp(ping),
                location_source="real" if has_gps else "missing",
                pitch_degrees=float(ping.SensorPitch),
                roll_degrees=float(ping.SensorRoll),
                sound_velocity=float(ping.SoundVelocity) if ping.SoundVelocity else None,
                extra={"ping_number": int(ping.PingNumber), "channel": channel},
            )
            frames.append(frame)

        except Exception as e:
            warnings.append(IngestionWarning(
                f"Skipped malformed ping at index {i}: {e}"
            ))
            continue

    # Fill in any missing GPS by straight-line interpolation between the
    # nearest valid neighbors, rather than silently leaving None (which would
    # make those detections un-mappable). This is flagged, not hidden.
    _interpolate_missing_locations(frames, warnings)

    return frames, warnings


def build_waterfall_image(frames: List[SonarFrame]) -> np.ndarray:
    """
    Optional helper: stack many single-ping rows into one big waterfall
    image (the classic 'scrolling' side-scan sonar picture), useful if you
    want to run detection on a wide strip instead of tiny per-ping chips.
    """
    if not frames:
        return np.zeros((1, 1), dtype=np.uint8)
    rows = [f.image[0:1, :] for f in frames]  # take one row from each tiled chip
    widths = [r.shape[1] for r in rows]
    max_w = max(widths)
    padded = [np.pad(r, ((0, 0), (0, max_w - r.shape[1]))) for r in rows]
    return np.vstack(padded)


def _interpolate_missing_locations(
    frames: List[SonarFrame],
    warnings: List[IngestionWarning],
) -> None:
    """Linearly interpolate lat/lon for frames with missing GPS, using the
    nearest valid frames before and after. Frames before the first valid GPS
    or after the last valid GPS are held at that nearest value instead
    (can't interpolate outside the known range)."""
    n = len(frames)
    valid_idx = [i for i, f in enumerate(frames) if f.has_valid_location()]

    if not valid_idx:
        for f in frames:
            f.location_source = "synthetic"
        warnings.append(IngestionWarning(
            "No frames had valid GPS at all - every position in the report "
            "is a placeholder. This file likely has no real navigation data."
        ))
        return

    if len(valid_idx) == n:
        return  # nothing missing

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

    warnings.append(IngestionWarning(
        f"{n - len(valid_idx)} of {n} pings had missing GPS and were "
        "interpolated from neighboring pings."
    ))
