# sonar_ingest

Handles two upload formats for the ghost-net detection dashboard:

1. **`.xtf`** — real, raw side-scan sonar files (industry-standard binary
   format). Navigation, depth, heading, pitch/roll are pulled straight out
   of the per-ping header using `pyxtf`.
2. **`.zip`** — a folder of sonar images (PNG/JPG) plus a `metadata.csv` or
   `metadata.json` sidecar with one row per image (`image_filename`,
   `latitude`, `longitude`, `depth_meters`, `timestamp`, `heading`). This is
   the format you'll actually use with the public training datasets, since
   those don't have real embedded GPS.

Both paths produce the same output: a list of `SonarFrame` objects (see
`common.py`), so the rest of your pipeline (preprocessing, the
YOLO/Faster-RCNN/U-Net ensemble, geotagging/report generation) never needs
to know which upload format was used.

## Install

```bash
pip install pyxtf opencv-python-headless pillow numpy --break-system-packages
```

## Usage

```python
from sonar_ingest.loader import load_sonar_upload, summarize_ingestion

frames, warnings = load_sonar_upload("my_survey.zip")   # or "my_survey.xtf"

print(summarize_ingestion(frames, warnings))

for frame in frames:
    # frame.image        -> numpy grayscale array, ready for preprocessing
    # frame.latitude/lon  -> GPS (real, interpolated, or synthetic — check
    #                        frame.location_source)
    # frame.depth_meters, frame.timestamp, frame.heading_degrees
    ...
```

## Handling missing GPS honestly

Neither format is guaranteed to have complete navigation data (lab-captured
training images have none at all; real survey files can have dropouts).
Every `SonarFrame` carries a `location_source` flag:

| value           | meaning                                                        |
|-----------------|-----------------------------------------------------------------|
| `real`          | GPS came directly from the file's own navigation data           |
| `interpolated`  | GPS was linearly interpolated between two nearby valid points   |
| `synthetic`     | No real navigation existed anywhere in the file — a placeholder demo track was generated |
| `missing`       | Transient internal state before interpolation runs (shouldn't appear in final output) |

This is deliberate: your final report should never present a synthetic or
interpolated coordinate as if it were verified GPS. Carry `location_source`
through to the CSV/JSON report columns.

## Files

- `common.py` — the shared `SonarFrame` schema
- `xtf_handler.py` — `.xtf` binary parser
- `zip_handler.py` — `.zip` (images + metadata sidecar) parser
- `loader.py` — dispatches to the right handler by file extension
- `flask_example.py` — reference upload route showing how to wire this into your dashboard

## Tests

`test_data/make_synthetic_xtf.py` generates a small structurally-valid
`.xtf` file (since real ones are large/proprietary) to exercise the parser
without needing a licensed sample file.
