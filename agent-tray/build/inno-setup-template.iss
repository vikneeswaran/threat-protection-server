; Inno Setup script template for Kuamini Agent Tray
; Build with: iscc inno-setup-template.iss
; For signed installer, set environment variable before building:
;   SignTool=signtool.exe sign /f "path\to\cert.pfx" /p "password" /tr http://timestamp.digicert.com /td sha256 /fd sha256 $f

[Setup]
AppName=Kuamini Agent Tray
AppVersion=1.0.0
AppPublisher=Kuamini Systems Private Limited
AppPublisherURL=https://kuaminisystems.com
AppSupportURL=https://kuaminisystems.com/contact
AppUpdatesURL=https://kuaminisystems.com/securityAgent/installers
DefaultDirName={autopf}\Kuamini\Tray
DefaultGroupName=Kuamini
OutputBaseFilename=KuaminiAgentTray-Setup
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\KuaminiAgentTray.exe
; Sign the installer if SignTool environment variable is set
SignTool=SignTool $f
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern

[Files]
Source: "dist\KuaminiAgentTray\*"; DestDir: "{app}"; Flags: recursesubdirs
Source: "config.example.json"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\Kuamini Agent Tray"; Filename: "{app}\KuaminiAgentTray.exe"
Name: "{commondesktop}\Kuamini Agent Tray"; Filename: "{app}\KuaminiAgentTray.exe"

[Run]
Filename: "{app}\KuaminiAgentTray.exe"; Description: "Launch Kuamini Agent Tray"; Flags: postinstall nowait skipifsilent
