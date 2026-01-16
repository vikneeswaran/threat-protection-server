"""
Build Windows installer by packaging PyInstaller output as ZIP
Named as .msi for UI consistency, but contains executable ZIP
Users can double-click to open or extract manually
"""
import os
import sys
import zipfile
import shutil

def build_msi():
    # Define paths
    script_dir = os.path.dirname(os.path.abspath(__file__))  # agent-tray/build
    agent_tray_dir = os.path.dirname(script_dir)  # agent-tray
    dist_path = os.path.join(agent_tray_dir, "dist", "KuaminiSecurityClient")
    output_dir = os.path.join(agent_tray_dir, "dist")
    msi_path = os.path.join(output_dir, "KuaminiSecurityClient-1.0.0.msi")
    
    print(f"PyInstaller dist path: {dist_path}")
    print(f"Output MSI path: {msi_path}")
    
    if not os.path.exists(dist_path):
        print(f"ERROR: PyInstaller dist folder not found at {dist_path}")
        sys.exit(1)
    
    # Create ZIP file and name it .msi for UI consistency
    return create_msi_as_zip(dist_path, msi_path)

def create_msi_as_zip(dist_path, msi_path):
    """Create MSI file by zipping the dist folder"""
    try:
        # Create ZIP with all files from dist folder
        with zipfile.ZipFile(msi_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(dist_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, dist_path)
                    zipf.write(file_path, arcname)
        
        print(f"MSI (ZIP) created successfully: {msi_path}")
        print(f"File size: {os.path.getsize(msi_path) / (1024*1024):.1f} MB")
        return True
    except Exception as e:
        print(f"Failed to create MSI: {e}")
        return False

if __name__ == "__main__":
    success = build_msi()
    sys.exit(0 if success else 1)

