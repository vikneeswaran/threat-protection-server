#!/bin/bash
#
# macOS Package Builder for Kuamini Security Client
# Creates a .pkg installer from the PyInstaller-built app bundle
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== macOS Package Builder ===${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$( dirname "$SCRIPT_DIR" )" )"
AGENT_ROOT="$( dirname "$SCRIPT_DIR" )"

# Paths
APP_BUNDLE="${AGENT_ROOT}/dist/KuaminiSecurityClient/KuaminiSecurityClient.app"
BUILD_DIR="${SCRIPT_DIR}"
PACKAGE_DIR="${BUILD_DIR}/pkgtmp"
SCRIPTS_DIR="${PACKAGE_DIR}/scripts"
PAYLOAD_DIR="${PACKAGE_DIR}/payload"
OUTPUT_PKG="${BUILD_DIR}/KuaminiSecurityClient-1.0.5.pkg"

# Cleanup function
cleanup() {
  echo -e "${YELLOW}Cleaning up temporary directories...${NC}"
  rm -rf "$PACKAGE_DIR"
}

# Error handler
trap cleanup EXIT

echo -e "${YELLOW}Checking for app bundle...${NC}"
if [ ! -d "$APP_BUNDLE" ]; then
  echo -e "${RED}Error: App bundle not found at $APP_BUNDLE${NC}"
  echo "Please run PyInstaller first: pyinstaller KuaminiSecurityClient-mac.spec"
  exit 1
fi

echo -e "${GREEN}✓ Found app bundle: $APP_BUNDLE${NC}"

# Create package structure
echo -e "${YELLOW}Creating package structure...${NC}"
mkdir -p "$PAYLOAD_DIR/Applications"
mkdir -p "$SCRIPTS_DIR"

# Copy app bundle to payload
echo -e "${YELLOW}Copying app bundle to payload...${NC}"
cp -r "$APP_BUNDLE" "$PAYLOAD_DIR/Applications/"

# Create preinstall script (optional)
cat > "$SCRIPTS_DIR/preinstall" << 'EOF'
#!/bin/bash
# Preinstall script for Kuamini Security Client
echo "Preparing to install Kuamini Security Client..."
exit 0
EOF
chmod +x "$SCRIPTS_DIR/preinstall"

# Create postinstall script
cat > "$SCRIPTS_DIR/postinstall" << 'EOF'
#!/bin/bash
# Postinstall script for Kuamini Security Client
set -e

APP_PATH="/Applications/KuaminiSecurityClient.app"
EXECUTABLE="$APP_PATH/Contents/MacOS/KuaminiSecurityClient"

echo "Setting executable permissions..."
chmod +x "$EXECUTABLE"

echo "Installation complete!"
exit 0
EOF
chmod +x "$SCRIPTS_DIR/postinstall"

# Remove any quarantine attributes if they exist
if [ -d "$PAYLOAD_DIR/Applications/KuaminiSecurityClient.app" ]; then
  xattr -rd com.apple.quarantine "$PAYLOAD_DIR/Applications/KuaminiSecurityClient.app" 2>/dev/null || true
fi

# Create the distributor file (component plist)
echo -e "${YELLOW}Creating distribution definition...${NC}"
cat > "$BUILD_DIR/distribution.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.kuamini.securityclient</string>
  <key>CFBundleVersion</key>
  <string>1.0.5</string>
  <key>IFMajorVersion</key>
  <integer>1</integer>
  <key>IFMinorVersion</key>
  <integer>0</integer>
  <key>IFPkgFormat</key>
  <string>plist10</string>
  <key>IFPkgFlagAllowBackRev</key>
  <false/>
  <key>IFPkgFlagAuthenticateEverywhere</key>
  <false/>
  <key>IFPkgFlagEnableLocationChoicePlugin</key>
  <false/>
  <key>IFPkgFlagFollowLinks</key>
  <true/>
  <key>IFPkgFlagInstallFatBinaries</key>
  <false/>
  <key>IFPkgFlagIsRequired</key>
  <false/>
  <key>IFPkgFlagRelocatable</key>
  <false/>
  <key>IFPkgFlagRestartAction</key>
  <string>NoRestart</string/>
  <key>IFPkgFlagRootVolumeOnly</key>
  <true/>
  <key>IFPkgFlagUpdateInstalledLanguages</key>
  <false/>
  <key>IFPkgFlagUseUserSelectedMD5Checksums</key>
  <false/>
</dict>
</plist>
EOF

# Build the package using pkgbuild
echo -e "${YELLOW}Building macOS package with pkgbuild...${NC}"

# Remove old package if it exists
rm -f "$OUTPUT_PKG"

# Use pkgbuild to create the package
pkgbuild \
  --root "$PAYLOAD_DIR" \
  --scripts "$SCRIPTS_DIR" \
  --identifier "com.kuamini.securityclient" \
  --version "1.0.5" \
  --ownership preserve \
  "$OUTPUT_PKG"

if [ ! -f "$OUTPUT_PKG" ]; then
  echo -e "${RED}Error: Failed to create package at $OUTPUT_PKG${NC}"
  exit 1
fi

# Verify the package was created
PKG_SIZE=$(du -h "$OUTPUT_PKG" | cut -f1)
echo -e "${GREEN}✓ Package created successfully!${NC}"
echo -e "${GREEN}  Location: $OUTPUT_PKG${NC}"
echo -e "${GREEN}  Size: $PKG_SIZE${NC}"

# Verify package contents
echo -e "${YELLOW}Verifying package contents...${NC}"
if pkgutil --check-signature "$OUTPUT_PKG" >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Package signature verified${NC}"
fi

echo -e "${GREEN}=== Build Complete ===${NC}"
exit 0
