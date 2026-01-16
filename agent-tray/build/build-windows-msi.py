"""
Build a real Windows MSI using WiX Toolset (heat/candle/light).
Assumes WiX is available on windows-latest GitHub runner.
"""
import os
import sys
import subprocess
import tempfile


def run(cmd, cwd=None):
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=cwd)


def build_msi():
    # Paths
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

    # Validate WiX tools
    for tool in ["heat", "candle", "light"]:
        try:
            subprocess.run([tool, "-?"] , capture_output=True, check=True)
        except Exception:
            print(f"ERROR: WiX tool '{tool}' not found. Ensure WiX Toolset is installed on runner.")
            sys.exit(1)

    with tempfile.TemporaryDirectory() as tmp:
        app_wxs = os.path.join(tmp, "files.wxs")
        product_wxs = os.path.join(tmp, "product.wxs")
        app_wixobj = os.path.join(tmp, "files.wixobj")
        product_wixobj = os.path.join(tmp, "product.wixobj")
        
        # Copy post-install script to temp
        post_install_src = os.path.join(script_dir, "post-install.ps1")
        post_install_dst = os.path.join(tmp, "post-install.ps1")
        if os.path.exists(post_install_src):
            import shutil
            shutil.copy2(post_install_src, post_install_dst)
            print(f"Copied post-install script: {post_install_src}")
        else:
            print(f"WARNING: post-install.ps1 not found at {post_install_src}")

        # Harvest files into a ComponentGroup AppFiles
        heat_cmd = [
            "heat",
            "dir",
            dist_path,
            "-cg",
            "AppFiles",
            "-dr",
            "INSTALLFOLDER",
            "-sfrag",
            "-srd",
            "-sreg",
            "-gg",
            "-var",
            "var.SourceDir",
            "-out",
            app_wxs,
        ]
        run(heat_cmd)

        # Product WiX
        product_xml = f"""<?xml version='1.0' encoding='UTF-8'?>
<Wix xmlns='http://schemas.microsoft.com/wix/2006/wi'>
  <Product Id='*' Name='Kuamini Security Client' Language='1033' Version='1.0.0' Manufacturer='Kuamini Systems' UpgradeCode='8B5F8A9E-3D4C-4F1A-9E2B-7C6D5E4F3A2B'>
    <Package InstallerVersion='500' Compressed='yes' InstallScope='perMachine' />
    <MediaTemplate EmbedCab='yes' CabinetTemplate='cab{{0}}.cab' />
    
    <Directory Id='TARGETDIR' Name='SourceDir'>
      <Directory Id='ProgramFilesFolder'>
        <Directory Id='INSTALLFOLDER' Name='KuaminiSecurityClient'>
          <Component Id='PostInstallScript' Guid='*'>
            <File Id='PostInstallPs1' Source='{post_install_dst}' KeyPath='yes' />
          </Component>
        </Directory>
      </Directory>
    </Directory>
    
    <Feature Id='DefaultFeature' Level='1'>
      <ComponentGroupRef Id='AppFiles' />
      <ComponentRef Id='PostInstallScript' />
    </Feature>
    
    <!-- Run post-install PowerShell script after installation -->
    <CustomAction Id='RunPostInstall' 
                  Directory='INSTALLFOLDER' 
                  ExeCommand='powershell.exe -ExecutionPolicy Bypass -File "[INSTALLFOLDER]post-install.ps1"'
                  Execute='deferred'
                  Impersonate='yes'
                  Return='ignore' />
    
    <InstallExecuteSequence>
      <Custom Action='RunPostInstall' After='InstallFiles'>NOT Installed AND NOT REMOVE</Custom>
    </InstallExecuteSequence>
    
  </Product>
</Wix>
"""
        with open(product_wxs, "w", encoding="utf-8") as f:
            f.write(product_xml)

        # Compile
        run(["candle", "-dSourceDir=" + dist_path, "-o", app_wixobj, app_wxs])
        run(["candle", "-dSourceDir=" + dist_path, "-o", product_wixobj, product_wxs])

        # Link
        run(["light", "-o", msi_path, product_wixobj, app_wixobj, "-b", dist_path])

    print(f"MSI created successfully: {msi_path}")
    return True


if __name__ == "__main__":
    success = build_msi()
    sys.exit(0 if success else 1)

