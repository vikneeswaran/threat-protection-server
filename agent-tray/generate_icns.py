# This script converts PNG tray icons to a macOS .icns file for PyInstaller
from pathlib import Path
from PIL import Image
import sys

def pngs_to_icns(png_paths, icns_path):
    # Apple icon sizes (must be square)
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    images = []
    for size in sizes:
        # Use green icon as base for all sizes (or pick the first PNG)
        img = Image.open(png_paths[0]).convert("RGBA").resize((size, size), Image.LANCZOS)
        images.append(img)
    # Save as .icns
    images[0].save(icns_path, format="ICNS", sizes=[(s, s) for s in sizes])
    print(f"Created {icns_path}")

if __name__ == "__main__":
    # Use green icon for .icns (can be improved to composite all statuses)
    base_dir = Path(__file__).parent
    pngs = [str(base_dir / "icon-green.png")]
    icns = base_dir / "icon-windowed.icns"
    pngs_to_icns(pngs, icns)
