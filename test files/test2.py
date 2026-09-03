from pathlib import Path

folder_path = Path("/Users/mohammadbilal/Documents/Projects/SIH-2026/data/marine-debri-fls/fls-images")

file_count = sum(1 for item in folder_path.iterdir() if item.is_file())
print(f"Files in top directory: {file_count}")

total_file_count = sum(1 for item in folder_path.rglob("*") if item.is_file())
print(f"Total files including subfolders: {total_file_count}")