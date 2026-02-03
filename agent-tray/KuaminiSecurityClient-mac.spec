# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'pystray',
        'psutil',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'requests',
        'requests.adapters',
        'requests.auth',
        'requests.certs',
        'requests.cookies',
        'requests.exceptions',
        'requests.models',
        'requests.packages',
        'requests.sessions',
        'requests.structures',
        'requests.utils',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='KuaminiSecurityClient',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='KuaminiSecurityClient',
)
app = BUNDLE(
    coll,
    name='KuaminiSecurityClient.app',
    icon=None,
    bundle_identifier='com.kuamini.securityclient',
)
