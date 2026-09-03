#!/usr/bin/env python3
"""
COMPLETE PIPELINE for merged_sonar_dataset (SKIP DEDUPLICATION)

1. Load COCO format dataset (all 9,468 images)
2. Convert to YOLO format (skip duplicate removal)
3. Train YOLOv8n with heavy augmentation
4. Create results archive
"""

import json
import os
import shutil
import random
from pathlib import Path
from ultralytics import YOLO


# ===== CONFIGURATION =====

DATASET_DIR = "/Users/mohammadbilal/Documents/Projects/SIH-2026/data/merged_sonar_dataset"
IMAGES_DIR = f"{DATASET_DIR}/images"
ANNOTATIONS_FILE = f"{DATASET_DIR}/annotations.json"

OUTPUT_YOLO_DIR = "/Users/mohammadbilal/Documents/Projects/SIH-2026/data"

SEED = 42

random.seed(SEED)


print("=" * 70)
print("🎯 PIPELINE: COCO → YOLO → TRAIN YOLOv26n → RESULTS")
print("=" * 70)


# ===== STEP 1: LOAD COCO DATASET =====

print("\n📊 STEP 1: Loading COCO annotations (ALL IMAGES)...")
print("-" * 70)

with open(ANNOTATIONS_FILE) as f:
    coco = json.load(f)

categories = {
    cat["id"]: cat["name"]
    for cat in coco["categories"]
}

print(f"✓ Found {len(coco['images'])} images")
print(f"✓ Found {len(coco['annotations'])} annotations")
print(f"✓ Found {len(categories)} classes")


img_annotations = {}

for ann in coco["annotations"]:
    img_id = ann["image_id"]

    if img_id not in img_annotations:
        img_annotations[img_id] = []

    img_annotations[img_id].append(ann)


# ===== STEP 2: SKIP DEDUPLICATION - USE ALL IMAGES =====

print("\n⏭️  STEP 2: Skipping duplicate removal (using all 9,468 images)...")
print("-" * 70)

images_to_keep = set(
    img["id"] for img in coco["images"]
)

print(f"✓ Using all {len(images_to_keep)} images")


# ===== STEP 3: CONVERT TO YOLO FORMAT =====

print("\n🔄 STEP 3: Converting to YOLO format...")
print("-" * 70)

os.makedirs(
    f"{OUTPUT_YOLO_DIR}/images/train",
    exist_ok=True
)

os.makedirs(
    f"{OUTPUT_YOLO_DIR}/images/val",
    exist_ok=True
)

os.makedirs(
    f"{OUTPUT_YOLO_DIR}/labels/train",
    exist_ok=True
)

os.makedirs(
    f"{OUTPUT_YOLO_DIR}/labels/val",
    exist_ok=True
)


# Use all images

coco_full = {
    "images": [
        img
        for img in coco["images"]
        if img["id"] in images_to_keep
    ],

    "annotations": [
        ann
        for ann in coco["annotations"]
        if ann["image_id"] in images_to_keep
    ],

    "categories": coco["categories"]
}


img_annotations_full = {}

for ann in coco_full["annotations"]:

    img_id = ann["image_id"]

    if img_id not in img_annotations_full:
        img_annotations_full[img_id] = []

    img_annotations_full[img_id].append(ann)


# 80/20 split

full_img_ids = [
    img["id"]
    for img in coco_full["images"]
]

random.shuffle(full_img_ids)

split_idx = int(len(full_img_ids) * 0.8)

train_ids = set(
    full_img_ids[:split_idx]
)

val_ids = set(
    full_img_ids[split_idx:]
)


train_count = 0
val_count = 0


for split_name, split_ids in [
    ("train", train_ids),
    ("val", val_ids)
]:

    for img_id in split_ids:

        img_info = next(
            (
                img
                for img in coco_full["images"]
                if img["id"] == img_id
            ),
            None
        )

        if not img_info:
            continue

        src_img = (
            f"{IMAGES_DIR}/"
            f"{img_info['file_name']}"
        )

        dst_img = (
            f"{OUTPUT_YOLO_DIR}/"
            f"images/{split_name}/"
            f"{img_info['file_name']}"
        )

        if not os.path.exists(src_img):
            continue

        shutil.copy2(
            src_img,
            dst_img
        )

        label_filename = (
            Path(img_info["file_name"]).stem
            + ".txt"
        )

        label_file = (
            f"{OUTPUT_YOLO_DIR}/"
            f"labels/{split_name}/"
            f"{label_filename}"
        )

        with open(label_file, "w") as f:

            if img_id in img_annotations_full:

                for ann in img_annotations_full[img_id]:

                    class_id = (
                        ann["category_id"] - 1
                    )

                    x, y, w, h = ann["bbox"]

                    x_center = (
                        (x + w / 2)
                        / img_info["width"]
                    )

                    y_center = (
                        (y + h / 2)
                        / img_info["height"]
                    )

                    w_norm = (
                        w / img_info["width"]
                    )

                    h_norm = (
                        h / img_info["height"]
                    )

                    f.write(
                        f"{class_id} "
                        f"{x_center:.6f} "
                        f"{y_center:.6f} "
                        f"{w_norm:.6f} "
                        f"{h_norm:.6f}\n"
                    )

        if split_name == "train":
            train_count += 1
        else:
            val_count += 1


# ===== CREATE YAML =====

class_names = [
    categories[i + 1]
    for i in range(len(categories))
]

yaml_content = f"""path: {os.path.abspath(OUTPUT_YOLO_DIR)}
train: images/train
val: images/val
nc: {len(categories)}
names: {class_names}
"""


with open(
    f"{OUTPUT_YOLO_DIR}/data.yaml",
    "w"
) as f:

    f.write(yaml_content)


print(f"✓ Train: {train_count} images (80%)")
print(f"✓ Val: {val_count} images (20%)")


# ===== STEP 4: TRAIN YOLOv26n =====

print("\n🚀 STEP 4: Training YOLOv26n with heavy augmentation...")
print("-" * 70)


model = YOLO("yolo26n.pt")


results = model.train(

    data=f"{OUTPUT_YOLO_DIR}/data.yaml",

    epochs=70,
    patience=10,

    batch=16,
    imgsz=512,

    # Mac
    device="mps",

    workers=8,

    seed=SEED,

    # Mac output directory
    project="/Users/mohammadbilal/Documents/Projects/SIH-2026/runs",

    name="yolov8n_final",

    exist_ok=True,

    pretrained=True,

    cls_remap=True,

    optimizer="SGD",

    verbose=True,

    deterministic=False,

    single_cls=False,

    rect=False,

    cos_lr=True,

    close_mosaic=10,

    resume=False,

    amp=True,

    fraction=1.0,

    lr0=0.01,

    lrf=0.01,

    momentum=0.937,

    weight_decay=0.0005,

    warmup_epochs=3.0,

    warmup_momentum=0.8,

    warmup_bias_lr=0.1,

    box=7.5,

    cls=0.5,

    cls_pw=0.0,

    dfl=1.5,


    # ===== HEAVY AUGMENTATION + NOISE =====

    hsv_h=0.3,

    hsv_s=0.5,

    hsv_v=0.5,

    degrees=50,

    translate=0.2,

    scale=0.6,

    shear=10,

    perspective=0.0001,

    flipud=0.3,

    fliplr=0.7,

    bgr=0.0,

    mosaic=1.0,

    mixup=0.3,

    cutmix=0.2,

    copy_paste=0.0,

    auto_augment="randaugment",

    erasing=0.5,

    dropout=0.2,


    # ===============================

    val=True,

    split="val",

    plots=True,
)


# ===== STEP 5: CREATE RESULTS ARCHIVE =====

print("\n📦 STEP 5: Creating results archive...")
print("-" * 70)


results_folder = (
    "/Users/mohammadbilal/Documents/"
    "Projects/SIH-2026/runs/yolov8n_final"
)

output_dir = (
    "/Users/mohammadbilal/Documents/"
    "Projects/SIH-2026/results"
)

os.makedirs(
    output_dir,
    exist_ok=True
)


output_zip = (
    f"{output_dir}/"
    "yolov8n_final_results.zip"
)


print("Zipping results...")


shutil.make_archive(

    output_zip.replace(".zip", ""),

    "zip",

    results_folder
)


size_mb = (
    os.path.getsize(output_zip)
    / (1024 * 1024)
)


# ===== SUMMARY =====

print("\n" + "=" * 70)

print("✅ COMPLETE PIPELINE FINISHED!")

print("=" * 70)


print("\n📊 Dataset Summary:")

print(f"  Total images: {len(coco['images'])}")

print(
    f"  Train: {train_count} images (80%)"
)

print(
    f"  Val: {val_count} images (20%)"
)

print(
    f"  Classes: {len(categories)}"
)


print("\n🎓 Training Summary:")

print("  Model: YOLO v26n")

print("  Epochs: 70")

print("  Batch size: 16")

print(
    "  Device: Apple Silicon MPS"
)

print(
    "  Augmentation: Extreme "
    "(rotation±50°, scale, mixup, "
    "cutmix, mosaic, dropout, noise, etc)"
)


print("\n📦 Results:")

print(
    "  File: yolov8n_final_results.zip"
)

print(
    f"  Size: {size_mb:.2f} MB"
)

print(
    f"  Location: {output_zip}"
)


print("\n" + "=" * 70)

print("📋 INCLUDED IN ZIP:")

print("=" * 70)

print("""
✓ results.csv - All metrics (mAP, precision, recall, loss)
✓ best.pt - Best model weights (USE THIS!)
✓ last.pt - Last epoch weights
✓ confusion_matrix.png - Class performance
✓ results.png - Training curves
✓ labels.jpg - Dataset distribution
✓ plots/ - All visualizations
""")


print("\n" + "=" * 70)

print("🎯 NEXT STEPS:")

print("=" * 70)

print("""
1. Extract best.pt from the results archive

2. Use best.pt for inference:

   from ultralytics import YOLO

   model = YOLO("best.pt")

   results = model.predict(
       "path/to/image.jpg"
   )

3. For SIH submission:
   - Include best.pt
   - Include results.csv
   - Document augmentation strategy
   - Show example detections
""")


print("\n" + "=" * 70)

print("✅ ALL DONE!")

print("=" * 70)