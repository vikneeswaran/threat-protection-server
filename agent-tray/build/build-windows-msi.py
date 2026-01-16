"""
Build Windows MSI installer using cx_Freeze
"""
import sys
from cx_Freeze import setup, Executable
import os

# Get the dist folder path
dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist", "KuaminiSecurityClient")

if not os.path.exists(dist_path):
    print(f"Error: PyInstaller dist folder not found at {dist_path}")
    sys.exit(1)

# Build configuration
build_exe_options = {
    "include_files": [
        (dist_path, "KuaminiSecurityClient")
    ]
}

bdist_msi_options = {
    "add_to_path": False,
    "initial_target_dir": r"[ProgramFilesFolder]\Kuamini\SecurityClient",
    "upgrade_code": "{8B5F8A9E-3D4C-4F1A-9E2B-7C6D5E4F3A2B}",
}

# Create a dummy main script since we're packaging pre-built files
dummy_script = os.path.join(os.path.dirname(__file__), "dummy_main.py")
with open(dummy_script, "w") as f:
    f.write("# Dummy script for MSI packaging\nprint('Installed')\n")

setup(
    name="KuaminiSecurityClient",
    version="1.0.0",
    description="Kuamini Threat Protection Agent",
    options={
        "build_exe": build_exe_options,
        "bdist_msi": bdist_msi_options,
    },
    executables=[Executable(dummy_script, base=None, target_name="setup.exe")],
)

# Clean up dummy script
if os.path.exists(dummy_script):
    os.remove(dummy_script)

print("MSI build complete!")
