"""
Build a real Windows MSI using WiX Toolset (heat/candle/light).
Assumes WiX is available on windows-latest GitHub runner.

Usage:
  python build-windows-msi.py [REGISTRATION_TOKEN]
  
If REGISTRATION_TOKEN is provided, it will be embedded in the MSI.
Otherwise, it reads from REGISTRATION_TOKEN environment variable.
"""
import os
import sys
import subprocess
import tempfile


def run(cmd, cwd=None):
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=cwd)


def build_msi(registration_token=None):
    # Get registration token from parameter, environment, or prompt
    if not registration_token:
        registration_token = os.environ.get("REGISTRATION_TOKEN", "")
    
    if not registration_token:
        print("\nWARNING: No REGISTRATION_TOKEN provided.")
        print("The MSI will be created without an embedded token.")
        print("Users will need to configure the token manually after installation.")
        print("\nTo embed a token, either:")
        print("  1. Pass as argument: python build-windows-msi.py YOUR_TOKEN")
        print("  2. Set environment: set REGISTRATION_TOKEN=YOUR_TOKEN")
        response = input("\nContinue anyway? (y/N): ")
        if response.lower() != 'y':
            print("Build cancelled.")
            sys.exit(0)
    else:
        print(f"Using registration token: {registration_token[:20]}...")
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))  # agent-tray/build
    agent_tray_dir = os.path.dirname(script_dir)  # agent-tray
    dist_dir = os.path.join(agent_tray_dir, "dist")
    exe_path = os.path.join(dist_dir, "KuaminiSecurityClient.exe")
    msi_path = os.path.join(dist_dir, "KuaminiSecurityClient-1.0.0.msi")

    print(f"PyInstaller exe path: {exe_path}")
    print(f"Output MSI path: {msi_path}")

    if not os.path.exists(exe_path):
        print(f"ERROR: PyInstaller exe not found at {exe_path}")
        sys.exit(1)
    
    # Create a temp dist folder structure for WiX
    dist_path = os.path.join(dist_dir, "KuaminiSecurityClient")
    os.makedirs(dist_path, exist_ok=True)
    import shutil
    shutil.copy2(exe_path, os.path.join(dist_path, "KuaminiSecurityClient.exe"))
    print(f"Created dist folder structure at {dist_path}")

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
        
        # Create a token file that the agent will read on first run
        token_file = os.path.join(dist_path, "registration_token.txt")
        if registration_token:
            with open(token_file, "w", encoding="utf-8") as f:
                f.write(registration_token)
            print(f"Created token file: {token_file}")

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

        # Product WiX - Use registry Run keys for reliable auto-start
        product_xml = f"""<?xml version='1.0' encoding='UTF-8'?>
<Wix xmlns='http://schemas.microsoft.com/wix/2006/wi' xmlns:util='http://schemas.microsoft.com/wix/UtilExtension'>
  <Product Id='*' Name='Kuamini Security Client' Language='1033' Version='1.0.0' Manufacturer='Kuamini Systems' UpgradeCode='8B5F8A9E-3D4C-4F1A-9E2B-7C6D5E4F3A2B'>
    <Package InstallerVersion='500' Compressed='yes' InstallScope='perMachine' />
    <MediaTemplate EmbedCab='yes' CabinetTemplate='cab{{0}}.cab' />

    <!-- Allow upgrades over existing installs -->
    <MajorUpgrade DowngradeErrorMessage='A newer version of Kuamini Security Client is already installed.' />

    <Directory Id='TARGETDIR' Name='SourceDir'>
      <Directory Id='ProgramFilesFolder'>
        <Directory Id='INSTALLFOLDER' Name='KuaminiSecurityClient'>
          <Component Id='RemoveInstallFolder' Guid='*'>
            <CreateFolder />
            <RemoveFolder Id='RemoveINSTALLFOLDER' On='uninstall' />
            <RegistryValue Root='HKCU' Key='Software\\Kuamini\\SecurityClient' Name='installed' Type='integer' Value='1' KeyPath='yes' />
          </Component>
          <!-- Auto-start for all users (machine-wide) -->
          <Component Id='AgentStartupHKLM' Guid='*'>
            <RegistryValue Root='HKLM' Key='Software\\Microsoft\\Windows\\CurrentVersion\\Run' Name='KuaminiSecurityClient' Type='string' Value='"[INSTALLFOLDER]KuaminiSecurityClient.exe"' KeyPath='yes' />
          </Component>
          <!-- Auto-start for current user as fallback -->
          <Component Id='AgentStartupHKCU' Guid='*'>
            <RegistryValue Root='HKCU' Key='Software\\Microsoft\\Windows\\CurrentVersion\\Run' Name='KuaminiSecurityClient' Type='string' Value='"[INSTALLFOLDER]KuaminiSecurityClient.exe"' KeyPath='yes' />
          </Component>
        </Directory>
      </Directory>
    </Directory>


    <Feature Id='DefaultFeature' Level='1'>
      <ComponentGroupRef Id='AppFiles' />
      <ComponentRef Id='RemoveInstallFolder' />
      <ComponentRef Id='AgentStartupHKLM' />
      <ComponentRef Id='AgentStartupHKCU' />
      
    </Feature>

    <!-- Launch the tray app once right after install completes -->
    <Property Id='WixShellExecTarget' Value='[INSTALLFOLDER]KuaminiSecurityClient.exe' />
    <CustomAction Id='LaunchKuaminiClient' BinaryKey='WixCA' DllEntry='WixShellExec' Impersonate='yes' />

    <InstallExecuteSequence>
      <!-- Run only on initial install -->
      <Custom Action='LaunchKuaminiClient' After='InstallFinalize'>NOT Installed</Custom>
    </InstallExecuteSequence>
  </Product>
</Wix>
"""
        with open(product_wxs, "w", encoding="utf-8") as f:
            f.write(product_xml)

        # Compile
        run(["candle", "-ext", "WixUtilExtension", "-dSourceDir=" + dist_path, "-o", app_wixobj, app_wxs])
        run(["candle", "-ext", "WixUtilExtension", "-dSourceDir=" + dist_path, "-o", product_wixobj, product_wxs])

        # Link
        run(["light", "-ext", "WixUtilExtension", "-o", msi_path, product_wixobj, app_wixobj, "-b", dist_path])

    print(f"MSI created successfully: {msi_path}")
    # Publish MSI to web-accessible folder for download
    try:
        project_root = os.path.dirname(agent_tray_dir)
        public_tray_dir = os.path.join(project_root, "public", "tray")
        os.makedirs(public_tray_dir, exist_ok=True)
        dest_path = os.path.join(public_tray_dir, os.path.basename(msi_path))
        import shutil
        shutil.copy2(msi_path, dest_path)
        print(f"Published MSI to {dest_path}")
    except Exception as e:
        print(f"WARNING: Failed to publish MSI to public/tray: {e}")
    return True


if __name__ == "__main__":
    # Accept token as command line argument
    token = sys.argv[1] if len(sys.argv) > 1 else None
    success = build_msi(token)
    sys.exit(0 if success else 1)

