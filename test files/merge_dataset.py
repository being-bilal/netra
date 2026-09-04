import json
import cv2
import numpy as np
import xml.etree.ElementTree as ET
from pathlib import Path
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor
import os

"""
Merge UATD and Marine Debris FLS Datasets
Converts both to COCO format with unified 20 classes
Optimized with parallel processing for speed
FIXED: Handles actual Marine Debris JSON structure
"""


class DatasetMerger:
    def __init__(self, output_dir='./merged_sonar_dataset'):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        (self.output_dir / 'images').mkdir(parents=True, exist_ok=True)

        # Create unified class mapping (20 total: 10 UATD + 10 Marine)
        self.classes = {
            # UATD classes (1-10)
            'ball': 1,
            'cube': 2,
            'cylinder': 3,
            'human body': 4,
            'tyre': 5,
            'circle cage': 6,
            'square cage': 7,
            'metal bucket': 8,
            'plane': 9,
            'rov': 10,
            # Marine Debris classes (11-20)
            'bottle': 11,
            'can': 12,
            'chain': 13,
            'drink carton': 14,
            'hook': 15,
            'propeller': 16,
            'shampoo bottle': 17,
            'standing bottle': 18,
            'tire': 19,
            'valve': 20,
        }

        self.coco_annotations = {
            'info': {
                'description': 'Merged UATD and Marine Debris FLS Dataset',
                'version': '1.0',
                'year': 2025
            },
            'licenses': [],
            'images': [],
            'annotations': [],
            'categories': []
        }

        # Create category objects
        for class_name, class_id in self.classes.items():
            self.coco_annotations['categories'].append({
                'id': class_id,
                'name': class_name.replace('_', ' ').title(),
                'supercategory': 'underwater_object'
            })

        self.image_id_counter = 0
        self.annotation_id_counter = 0
        self.target_size = (512, 512)
        self.num_workers = min(8, max(1, os.cpu_count() or 1))

        # Precompute category names for fast annotation statistics
        self.category_names = {
            c['id']: c['name'] for c in self.coco_annotations['categories']
        }

    def normalize_image(self, image_path, save_path):
        """Load image, resize to target size, save as PNG."""
        try:
            img = cv2.imread(str(image_path))

            if img is None:
                return None, None, f"Warning: Could not read {image_path}"

            orig_h, orig_w = img.shape[:2]

            aspect = orig_w / orig_h
            if aspect > 1:
                new_w = self.target_size[0]
                new_h = int(new_w / aspect)
            else:
                new_h = self.target_size[1]
                new_w = int(new_h * aspect)

            resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

            pad_h = self.target_size[1] - new_h
            pad_w = self.target_size[0] - new_w
            padded = cv2.copyMakeBorder(
                resized,
                pad_h // 2, pad_h - pad_h // 2,
                pad_w // 2, pad_w - pad_w // 2,
                cv2.BORDER_CONSTANT,
                value=0
            )

            if not cv2.imwrite(str(save_path), padded):
                return None, None, f"Warning: Could not save {save_path}"

            return (orig_w, orig_h), self.target_size, None
        except Exception as e:
            return None, None, f"Error processing {image_path}: {e}"

    def transform_bbox(self, bbox, orig_shape, new_shape):
        """Transform bounding box from original image to normalized image."""
        orig_w, orig_h = orig_shape
        new_w, new_h = new_shape

        aspect = orig_w / orig_h
        if aspect > 1:
            scale_w = new_w / orig_w
            scale_h = scale_w
            pad_x = 0
            pad_y = (new_h - int(orig_h * scale_h)) // 2
        else:
            scale_h = new_h / orig_h
            scale_w = scale_h
            pad_x = (new_w - int(orig_w * scale_w)) // 2
            pad_y = 0

        x, y, w, h = bbox
        new_x = int(x * scale_w + pad_x)
        new_y = int(y * scale_h + pad_y)
        new_w = int(w * scale_w)
        new_h = int(h * scale_h)

        new_x = max(0, new_x)
        new_y = max(0, new_y)
        new_w = min(new_w, self.target_size[0] - new_x)
        new_h = min(new_h, self.target_size[1] - new_y)

        return [new_x, new_y, new_w, new_h]

    # ============ UATD Dataset Processing ============

    def _process_uatd_one(self, image_file):
        """Process a single UATD image and its XML annotation."""
        annotation_file = self._uatd_annotation_dir / image_file.with_suffix('.xml').name

        if not annotation_file.exists():
            return None, f"Warning: No annotation for {image_file.name}"

        normalized_name = f"uatd_{image_file.stem}.png"
        normalized_path = self.output_dir / 'images' / normalized_name
        orig_shape, new_shape, warning = self.normalize_image(image_file, normalized_path)

        if orig_shape is None:
            return None, warning

        annotations = []
        try:
            root = ET.parse(annotation_file).getroot()

            for obj in root.findall('object'):
                class_name = obj.find('name').text.lower()
                bndbox = obj.find('bndbox')

                xmin = float(bndbox.find('xmin').text)
                ymin = float(bndbox.find('ymin').text)
                xmax = float(bndbox.find('xmax').text)
                ymax = float(bndbox.find('ymax').text)

                bbox = [xmin, ymin, xmax - xmin, ymax - ymin]
                transformed_bbox = self.transform_bbox(bbox, orig_shape, new_shape)

                if class_name not in self.classes:
                    annotations.append((None, f"Warning: Unknown class '{class_name}' in {image_file.name}"))
                    continue

                annotations.append((self.classes[class_name], transformed_bbox, class_name))

        except Exception as e:
            return {
                'file_name': normalized_name,
                'original_resolution': orig_shape,
                'annotations': annotations
            }, f"Error parsing {annotation_file}: {e}"

        return {
            'file_name': normalized_name,
            'original_resolution': orig_shape,
            'annotations': annotations
        }, None

    def process_uatd(self, uatd_path):
        """Process UATD dataset."""
        uatd_path = Path(uatd_path)
        print("\n" + "=" * 60)
        print("PROCESSING UATD DATASET")
        print("=" * 60)

        image_dir = uatd_path / 'images'
        annotation_dir = uatd_path / 'annotations'

        if not image_dir.exists():
            print(f"Error: {image_dir} not found!")
            print(f"Expected structure: UATD-dataset/images/ and UATD-dataset/annotations/")
            return False

        if not annotation_dir.exists():
            print(f"Error: {annotation_dir} not found!")
            print(f"Expected structure: UATD-dataset/images/ and UATD-dataset/annotations/")
            return False

        print(f"Loading images from: {image_dir}")
        print(f"Loading annotations from: {annotation_dir}")

        image_files = sorted(image_dir.glob('*.bmp'))
        print(f"Found {len(image_files)} images")

        if len(image_files) == 0:
            print("Warning: No BMP files found in images directory")
            return False

        self._uatd_annotation_dir = annotation_dir

        # Process images in parallel
        with ThreadPoolExecutor(max_workers=self.num_workers) as executor:
            results = list(tqdm(
                executor.map(self._process_uatd_one, image_files),
                total=len(image_files),
                desc="UATD"
            ))

        # Assemble sequentially
        for image_file, (result, warning) in zip(image_files, results):
            if warning:
                print(warning)
            if result is None:
                continue

            self.image_id_counter += 1
            image_id = self.image_id_counter
            self.coco_annotations['images'].append({
                'id': image_id,
                'file_name': result['file_name'],
                'width': self.target_size[0],
                'height': self.target_size[1],
                'dataset': 'UATD',
                'split': 'unknown',
                'original_resolution': result['original_resolution']
            })

            for ann in result['annotations']:
                if len(ann) == 2 and ann[0] is None:
                    print(ann[1])
                    continue

                category_id, bbox, class_name = ann
                self.annotation_id_counter += 1
                self.coco_annotations['annotations'].append({
                    'id': self.annotation_id_counter,
                    'image_id': image_id,
                    'category_id': category_id,
                    'bbox': bbox,
                    'area': bbox[2] * bbox[3],
                    'iscrowd': 0,
                    'original_class': class_name
                })

        return True

    # ============ Marine Debris Dataset Processing ============

    def _process_marine_one(self, image_file, annotations_data):
        """Process a single Marine Debris image and its annotations (FIXED for actual JSON structure)."""
        normalized_name = f"marine_{image_file.stem}.png"
        normalized_path = self.output_dir / 'images' / normalized_name
        orig_shape, new_shape, warning = self.normalize_image(image_file, normalized_path)

        if orig_shape is None:
            return None, warning

        # Get annotations for this image using filename as key
        image_filename = image_file.name
        image_annotations = annotations_data.get(image_filename, {})
        bounding_boxes = image_annotations.get('bounding-boxes', [])

        annotations = []

        for bbox_data in bounding_boxes:
            class_name = bbox_data.get('class', '').lower()

            if not class_name:
                continue

            # Get bbox coordinates from the actual JSON structure
            x = bbox_data.get('top-left-x', 0)
            y = bbox_data.get('top-left-y', 0)
            w = bbox_data.get('width', 0)
            h = bbox_data.get('height', 0)

            if w <= 0 or h <= 0:
                continue

            bbox = [x, y, w, h]

            # Try exact match first
            if class_name not in self.classes:
                # Try fuzzy matching
                close_name = next(
                    (c for c in self._class_names if c in class_name or class_name in c),
                    None
                )
                if close_name is None:
                    print_warning = f"Warning: Unknown class '{class_name}' in {image_file.name}"
                    annotations.append((None, print_warning))
                    continue
                class_name = close_name

            # Transform bbox to normalized coordinates
            transformed_bbox = self.transform_bbox(bbox, orig_shape, new_shape)
            annotations.append((self.classes[class_name], transformed_bbox, class_name))

        return {
            'file_name': normalized_name,
            'original_resolution': orig_shape,
            'annotations': annotations
        }, None

    def process_marine_debris(self, dataset_path, annotations_file_path):
        """Process Marine Debris FLS dataset with FIXED annotation parsing."""
        dataset_path = Path(dataset_path)
        annotations_file = Path(annotations_file_path)

        print("\n" + "=" * 60)
        print("PROCESSING MARINE DEBRIS FLS DATASET")
        print("=" * 60)

        images_dir = dataset_path / 'images'

        if not images_dir.exists():
            print(f"Error: {images_dir} not found!")
            print(f"Expected structure: marine-debri-fls/images/")
            return False

        print(f"Loading images from: {images_dir}")
        print(f"Loading annotations from: {annotations_file}")

        if annotations_file.exists():
            with open(annotations_file, 'r') as f:
                annotations_data = json.load(f)
            print("✓ Loaded annotations.json")
            print(f"  Total images with annotations: {len(annotations_data)}")
        else:
            print("Warning: annotations.json not found, will process images without annotations")
            annotations_data = {}

        print("Processing Marine Debris images...")
        image_files = sorted(images_dir.glob('*.png'))
        print(f"Found {len(image_files)} images")

        if len(image_files) == 0:
            print("Warning: No PNG files found in images directory")
            return False

        self._class_names = tuple(self.classes)

        # Process images in parallel
        with ThreadPoolExecutor(max_workers=self.num_workers) as executor:
            results = list(tqdm(
                executor.map(lambda f: self._process_marine_one(f, annotations_data), image_files),
                total=len(image_files),
                desc="Marine Debris"
            ))

        # Assemble sequentially
        for image_file, (result, warning) in zip(image_files, results):
            if warning:
                print(warning)
            if result is None:
                continue

            self.image_id_counter += 1
            image_id = self.image_id_counter
            self.coco_annotations['images'].append({
                'id': image_id,
                'file_name': result['file_name'],
                'width': self.target_size[0],
                'height': self.target_size[1],
                'dataset': 'Marine_Debris_FLS',
                'split': 'unknown',
                'original_resolution': result['original_resolution']
            })

            for ann in result['annotations']:
                if len(ann) == 2 and ann[0] is None:
                    print(ann[1])
                    continue

                category_id, bbox, class_name = ann
                self.annotation_id_counter += 1
                self.coco_annotations['annotations'].append({
                    'id': self.annotation_id_counter,
                    'image_id': image_id,
                    'category_id': category_id,
                    'bbox': bbox,
                    'area': bbox[2] * bbox[3],
                    'iscrowd': 0,
                    'original_class': class_name
                })

        return True

    def save_dataset(self):
        """Save merged dataset in COCO format."""
        print("\n" + "=" * 60)
        print("SAVING MERGED DATASET")
        print("=" * 60)

        if len(self.coco_annotations['images']) == 0:
            print("ERROR: No images were processed! Check your dataset paths.")
            return False

        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Save annotations
        annotations_file = self.output_dir / 'annotations.json'
        with open(annotations_file, 'w') as f:
            json.dump(self.coco_annotations, f, indent=2)

        print(f"\n✓ Annotations saved to: {annotations_file}")
        print(f"  File size: {annotations_file.stat().st_size / (1024 * 1024):.2f} MB")

        # Save classes
        classes_file = self.output_dir / 'classes.txt'
        with open(classes_file, 'w') as f:
            for class_name, class_id in sorted(self.classes.items(), key=lambda x: x[1]):
                f.write(f"{class_id}: {class_name}\n")

        print(f"✓ Classes file saved to: {classes_file}")

        # Save metadata
        metadata_file = self.output_dir / 'metadata.txt'
        with open(metadata_file, 'w') as f:
            f.write("MERGED SONAR DATASET METADATA\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Total Images: {len(self.coco_annotations['images'])}\n")
            f.write(f"Total Annotations: {len(self.coco_annotations['annotations'])}\n")
            f.write(f"Total Classes: {len(self.coco_annotations['categories'])}\n")
            f.write(f"Target Resolution: {self.target_size[0]}x{self.target_size[1]}\n\n")

            uatd_count = sum(1 for img in self.coco_annotations['images'] if img['dataset'] == 'UATD')
            marine_count = sum(1 for img in self.coco_annotations['images'] if img['dataset'] == 'Marine_Debris_FLS')

            f.write("Dataset Breakdown:\n")
            f.write(f"  UATD: {uatd_count} images\n")
            f.write(f"  Marine Debris FLS: {marine_count} images\n\n")

            f.write("Classes:\n")
            for class_name, class_id in sorted(self.classes.items(), key=lambda x: x[1]):
                f.write(f"  {class_id}: {class_name}\n")

        print(f"✓ Metadata saved to: {metadata_file}")

        # Print summary
        print("\n" + "=" * 60)
        print("DATASET SUMMARY")
        print("=" * 60)
        print(f"Total images: {len(self.coco_annotations['images'])}")
        print(f"Total annotations: {len(self.coco_annotations['annotations'])}")
        print(f"Total classes: {len(self.coco_annotations['categories'])}")
        print(f"Output directory: {self.output_dir}")
        print(f"Target size per image: {self.target_size[0]}x{self.target_size[1]} pixels")

        uatd_count = sum(1 for img in self.coco_annotations['images'] if img['dataset'] == 'UATD')
        marine_count = sum(1 for img in self.coco_annotations['images'] if img['dataset'] == 'Marine_Debris_FLS')

        print(f"\nImages breakdown:")
        print(f"  - UATD: {uatd_count} ({uatd_count / len(self.coco_annotations['images']) * 100:.1f}%)")
        print(f"  - Marine Debris FLS: {marine_count} ({marine_count / len(self.coco_annotations['images']) * 100:.1f}%)")

        if len(self.coco_annotations['annotations']) > 0:
            print(f"\nAnnotations by class:")
            class_counts = {}
            for ann in self.coco_annotations['annotations']:
                cat_id = ann['category_id']
                cat_name = self.category_names[cat_id]
                class_counts[cat_name] = class_counts.get(cat_name, 0) + 1

            for class_name, count in sorted(class_counts.items()):
                percentage = count / len(self.coco_annotations['annotations']) * 100
                print(f"  - {class_name}: {count} ({percentage:.1f}%)")

            avg_objects = len(self.coco_annotations['annotations']) / len(self.coco_annotations['images'])
            print(f"\nAverage objects per image: {avg_objects:.2f}")
        else:
            print("\n⚠️  No annotations found in dataset")

        return True


def main():
    """Main execution"""

    # Relative paths for your directory structure
    UATD_PATH = '/Users/mohammadbilal/Documents/Projects/SIH-2026/data/UATD-dataset'
    MARINE_DEBRIS_PATH = '/Users/mohammadbilal/Documents/Projects/SIH-2026/data/marine-debris-fls'
    MARINE_ANNOTATIONS_PATH = '/Users/mohammadbilal/Documents/Projects/SIH-2026/data/marine-debris-fls/annotations.json'
    OUTPUT_PATH = '/Users/mohammadbilal/Documents/Projects/SIH-2026/data/merged_sonar_dataset'

    merger = DatasetMerger(output_dir=OUTPUT_PATH)

    print("\n" + "=" * 60)
    print("STARTING DATASET MERGE PROCESS")
    print("=" * 60)
    print(f"UATD Path: {UATD_PATH}")
    print(f"Marine Debris Path: {MARINE_DEBRIS_PATH}")
    print(f"Marine Annotations: {MARINE_ANNOTATIONS_PATH}")
    print(f"Output Path: {OUTPUT_PATH}")
    print(f"Number of parallel workers: {merger.num_workers}")

    # Process both datasets
    uatd_success = merger.process_uatd(UATD_PATH)
    marine_success = merger.process_marine_debris(MARINE_DEBRIS_PATH, MARINE_ANNOTATIONS_PATH)

    if not (uatd_success and marine_success):
        print("\n❌ One or more datasets failed to process!")
        return False

    # Save merged dataset
    if not merger.save_dataset():
        print("\n❌ Failed to save dataset!")
        return False

    return True


if __name__ == '__main__':
    import sys
    try:
        success = main()
        if success:
            print("\n" + "=" * 60)
            print("✓ MERGE COMPLETE!")
            print("=" * 60)
            print("\nNext steps:")
            print("1. Check merged_sonar_dataset/ for output files")
            print("2. Verify annotations.json for correctness")
            print("3. Create train/val/test splits if needed")
            print("4. Start training with YOLOv8 or Faster R-CNN")
            print("\n" + "=" * 60 + "\n")
        else:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("✗ MERGE INTERRUPTED BY USER")
        print("=" * 60 + "\n")
        sys.exit(1)
    except Exception as e:
        print("\n\n" + "=" * 60)
        print("✗ ERROR DURING MERGE")
        print("=" * 60)
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        print("\n" + "=" * 60 + "\n")
        sys.exit(1)