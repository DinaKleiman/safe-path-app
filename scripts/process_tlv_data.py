# This script will later clean raw municipality GeoJSON files
# and create app-ready files in data/processed/ and public/data/.

from pathlib import Path

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
PUBLIC_DATA_DIR = Path("public/data")

def main():
    print("Processing script placeholder.")
    print(f"Raw data folder: {RAW_DIR}")
    print(f"Processed data folder: {PROCESSED_DIR}")
    print(f"Public data folder: {PUBLIC_DATA_DIR}")

if __name__ == "__main__":
    main()
