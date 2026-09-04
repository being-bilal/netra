import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".bmp",
    ".tif",
    ".tiff",
}

# Map string arguments to OpenCV colormaps
COLORMAPS = {
    "inferno": cv2.COLORMAP_INFERNO,
    "viridis": cv2.COLORMAP_VIRIDIS,
    "ocean": cv2.COLORMAP_OCEAN,
    "jet": cv2.COLORMAP_JET,
    "hot": cv2.COLORMAP_HOT,
    "bone": cv2.COLORMAP_BONE,
}


def process_image(input_path: Path, output_path: Path, colormap: int):
    """Reads an image, ensures it is grayscale, applies pseudo-color, and saves it."""
    # Load unchanged to check dimensions
    img = cv2.imread(str(input_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise RuntimeError(f"Could not read: {input_path}")

    # Colormaps require an 8-bit single-channel (grayscale) input
    if img.ndim == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img

    # Ensure it's 8-bit (0-255)
    if gray.dtype != np.uint8:
        # Normalize to 0-255 if it's a 16-bit float or integer format
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)

    # Apply the colormap
    colorized = cv2.applyColorMap(gray, colormap)

    # Save output
    cv2.imwrite(str(output_path), colorized)
    return True


def main():
    parser = argparse.ArgumentParser(description="Apply pseudo-color to sonar images.")
    parser.add_argument(
        "--input", type=Path, required=True, help="Input directory containing images"
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output directory for colorized images",
    )
    parser.add_argument(
        "--cmap",
        type=str,
        choices=list(COLORMAPS.keys()),
        default="inferno",
        help="Colormap to apply (default: inferno)",
    )
    parser.add_argument(
        "--workers", type=int, default=16, help="Number of concurrent workers"
    )

    args = parser.parse_args()

    input_dir = args.input.expanduser().resolve()
    output_dir = args.output.expanduser().resolve()

    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory missing: {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    # Grab all valid image paths
    image_paths = [
        p
        for p in input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    ]

    print(f"\nColormap   : {args.cmap.upper()}")
    print(f"Input Dir  : {input_dir}")
    print(f"Output Dir : {output_dir}")
    print(f"Images     : {len(image_paths)}\n")

    colormap_flag = COLORMAPS[args.cmap]

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = []
        for img_path in image_paths:
            out_path = output_dir / img_path.name
            futures.append(
                executor.submit(process_image, img_path, out_path, colormap_flag)
            )

        for _ in tqdm(
            as_completed(futures), total=len(futures), desc=f"Colorizing ({args.cmap})"
        ):
            pass

    print("\nDone! Colorized images saved to:", output_dir)


if __name__ == "__main__":
    main()
