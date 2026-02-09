"""
Threat Signatures Database - Pattern matching for malware detection
Includes: file hashes, file names, registry keys, suspicious patterns
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Callable


@dataclass
class ThreatSignature:
    """Represents a malware signature pattern"""
    id: str
    name: str
    type: str  # malware, ransomware, trojan, pup, virus, worm, rootkit, etc.
    severity: str  # critical, high, medium, low
    detection_method: str  # hash, pattern, registry, behavior, heuristic
    pattern: str | None = None
    hashes: List[str] | None = None  # MD5, SHA256 hashes
    registry_keys: List[str] | None = None  # Windows registry paths
    process_names: List[str] | None = None  # Suspicious process names
    file_extensions: List[str] | None = None  # Extension patterns
    description: str | None = None


# Known malware signatures database
THREAT_SIGNATURES: Dict[str, ThreatSignature] = {
    # Known ransomware patterns
    "ransomware_lockbit": ThreatSignature(
        id="sig_lockbit_001",
        name="LockBit Ransomware",
        type="ransomware",
        severity="critical",
        detection_method="pattern",
        pattern=r".*\.lockbit|.*\.lock",
        file_extensions=[".lockbit", ".lock"],
        description="LockBit ransomware file extension pattern"
    ),
    
    "ransomware_wannacry": ThreatSignature(
        id="sig_wannacry_001",
        name="WannaCry Ransomware",
        type="ransomware",
        severity="critical",
        detection_method="hash",
        hashes=[
            "4eca8ac0cfb3d8ec113f6661d20b123fc65f6612",  # WannaCry dropper
            "ed01ebfbc9eb5bbea545af4d01bf5f1071661840",  # WannaCry hash
        ],
        description="WannaCry known malware hashes"
    ),
    
    # Known trojan patterns
    "trojan_emotet": ThreatSignature(
        id="sig_emotet_001",
        name="Emotet Trojan",
        type="trojan",
        severity="critical",
        detection_method="pattern",
        file_extensions=[".exe", ".dll"],
        process_names=["svchost.exe", "explorer.exe"],  # Suspicious impersonation
        description="Emotet banking trojan patterns"
    ),
    
    # Potentially Unwanted Programs (PUP)
    "pup_crypto_miner": ThreatSignature(
        id="sig_miner_001",
        name="CryptoMiner",
        type="pup",
        severity="medium",
        detection_method="pattern",
        process_names=["xmrig", "cpuminer", "ethminer"],
        registry_keys=[r".*CryptoMiner.*"],
        description="Unauthorized cryptocurrency miner"
    ),
    
    "pup_browser_hijacker": ThreatSignature(
        id="sig_hijacker_001",
        name="Browser Hijacker",
        type="pup",
        severity="medium",
        detection_method="pattern",
        registry_keys=[r".*SearchProvider.*", r"HKCU\\Software\\Microsoft\\Internet Explorer\\Search"],
        description="Browser search engine hijacker"
    ),
    
    # Suspicious behaviors
    "behavior_suspicious_cmd": ThreatSignature(
        id="sig_behavior_cmd_001",
        name="Suspicious Command Execution",
        type="trojan",
        severity="high",
        detection_method="behavior",
        pattern=r"(powershell|cmd|rundll32|regsvcs|certutil).*(-enc|-e |-nop|-c |-executionpolicy)",
        description="Suspicious PowerShell/CMD command patterns"
    ),
    
    "behavior_registry_persistence": ThreatSignature(
        id="sig_behavior_persist_001",
        name="Registry Persistence Attempt",
        type="trojan",
        severity="high",
        detection_method="behavior",
        registry_keys=[
            r"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            r"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        ],
        description="Suspicious registry run key modifications"
    ),
    
    # Worms
    "worm_conficker": ThreatSignature(
        id="sig_conficker_001",
        name="Conficker Worm",
        type="worm",
        severity="critical",
        detection_method="pattern",
        file_extensions=[".exe"],
        process_names=["svchost.exe"],
        description="Conficker worm self-propagation patterns"
    ),
    
    # Rootkits (harder to detect, based on behavior)
    "rootkit_spyeye": ThreatSignature(
        id="sig_rootkit_001",
        name="SpyEye Rootkit",
        type="rootkit",
        severity="critical",
        detection_method="behavior",
        process_names=["system.exe", "kernel32.exe"],
        registry_keys=[r".*\\System32\\drivers\\etc\\hosts"],
        description="SpyEye rootkit host file manipulation"
    ),
}


# Heuristic patterns for suspicious activity
HEURISTIC_PATTERNS: Dict[str, ThreatSignature] = {
    "suspicious_file_execution": ThreatSignature(
        id="heur_exec_001",
        name="Suspicious File Execution",
        type="suspicious",
        severity="medium",
        detection_method="heuristic",
        pattern=r".*\.(exe|dll|scr|vbs|js|bat|cmd)$",
        description="Executable files from suspicious locations"
    ),
    
    "suspicious_registry_modification": ThreatSignature(
        id="heur_registry_001",
        name="Suspicious Registry Modification",
        type="suspicious",
        severity="medium",
        detection_method="heuristic",
        registry_keys=[
            r"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RunMRU",
            r"HKLM\\System\\CurrentControlSet\\Services",
        ],
        description="Registry modifications from suspicious processes"
    ),
    
    "suspicious_network_connection": ThreatSignature(
        id="heur_network_001",
        name="Suspicious Network Connection",
        type="suspicious",
        severity="high",
        detection_method="heuristic",
        pattern=r".*\.(tk|ml|ga|cf)$",  # Known malicious TLDs
        description="Connection to known malicious domains"
    ),
}


# Behavioral indicators
BEHAVIORAL_INDICATORS: Dict[str, Dict[str, str | int | List]] = {
    "high_cpu_usage": {
        "description": "Process using >80% CPU for extended period",
        "threshold": 80,
        "duration": 300,  # seconds
        "severity": "high",
    },
    "memory_dump_attempt": {
        "description": "Process attempting to dump memory of other processes",
        "indicators": ["CreateRemoteThread", "WriteProcessMemory", "ReadProcessMemory"],
        "severity": "high",
    },
    "file_encryption": {
        "description": "Process encrypting files rapidly",
        "file_operations": 100,  # files encrypted in short time
        "severity": "critical",
    },
    "registry_deletion": {
        "description": "Mass registry key deletion attempt",
        "operations": 50,
        "severity": "critical",
    },
    "service_hijacking": {
        "description": "Attempt to modify Windows services",
        "indicators": ["CreateServiceA", "CreateServiceW", "ChangeServiceConfig"],
        "severity": "critical",
    },
}


def get_signature_by_name(name: str) -> ThreatSignature | None:
    """Find threat signature by threat name"""
    for sig in THREAT_SIGNATURES.values():
        if sig.name.lower() == name.lower():
            return sig
    return None


def get_signatures_by_type(threat_type: str) -> List[ThreatSignature]:
    """Get all signatures of a specific threat type"""
    return [sig for sig in THREAT_SIGNATURES.values() if sig.type == threat_type]


def match_pattern(content: str, pattern: str) -> bool:
    """Check if content matches regex pattern"""
    try:
        return bool(re.search(pattern, content, re.IGNORECASE | re.DOTALL))
    except Exception:
        return False


def add_custom_signature(sig: ThreatSignature) -> None:
    """Add custom threat signature to database"""
    THREAT_SIGNATURES[sig.id] = sig


def remove_signature(sig_id: str) -> bool:
    """Remove threat signature from database"""
    if sig_id in THREAT_SIGNATURES:
        del THREAT_SIGNATURES[sig_id]
        return True
    return False
