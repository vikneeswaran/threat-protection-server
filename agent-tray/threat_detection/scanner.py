"""
File System Scanner - Detects threats via signature matching and heuristics
Scans files for known malware patterns, suspicious extensions, and behaviors
"""

import os
import sys
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Callable, Optional
from dataclasses import dataclass, asdict
import mimetypes

from .signatures import THREAT_SIGNATURES, HEURISTIC_PATTERNS, match_pattern, ThreatSignature


@dataclass
class ThreatDetection:
    """Represents a detected threat"""
    threat_id: str
    threat_name: str
    threat_type: str
    severity: str
    file_path: str
    file_hash: str | None = None
    detection_engine: str = "signature"  # signature, heuristic, behavioral, ml
    details: Dict = None
    detection_time: str | None = None
    
    def to_dict(self):
        """Convert to dictionary for API reporting"""
        return asdict(self)


class FileScanner:
    """Scans file system for threats"""
    
    def __init__(self, log_callback: Optional[Callable[[str], None]] = None):
        self.logger = logging.getLogger("FileScanner")
        self.log_callback = log_callback
        self.scanned_files = 0
        self.threats_found = []
        self.scan_interrupted = False
        
        # High-risk directories to scan
        self.critical_paths = [
            Path.home() / "Downloads",
            Path.home() / "AppData" / "Local" / "Temp" if os.name == "nt" else Path("/tmp"),
            Path.home() / "Desktop",
            Path("C:\\Windows\\Temp") if os.name == "nt" else None,
            Path("C:\\Windows\\System32") if os.name == "nt" else None,
        ]
        self.critical_paths = [p for p in self.critical_paths if p]
    
    def _log(self, msg: str, level: str = "info"):
        """Log message with optional callback"""
        getattr(self.logger, level)(msg)
        if self.log_callback:
            self.log_callback(f"[Scanner] {msg}")
    
    def _calculate_hash(self, file_path: Path, algorithm: str = "sha256") -> str | None:
        """Calculate file hash"""
        try:
            hash_obj = hashlib.new(algorithm)
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    hash_obj.update(chunk)
            return hash_obj.hexdigest()
        except Exception as e:
            self._log(f"Failed to hash {file_path}: {e}", "debug")
            return None
    
    def _check_file_hash(self, file_path: Path) -> ThreatDetection | None:
        """Check file against known malware hashes"""
        file_hash = self._calculate_hash(file_path)
        if not file_hash:
            return None
        
        # Check against signature database
        for sig in THREAT_SIGNATURES.values():
            if sig.hashes and file_hash in sig.hashes:
                self._log(f"THREAT DETECTED: {sig.name} in {file_path}")
                return ThreatDetection(
                    threat_id=sig.id,
                    threat_name=sig.name,
                    threat_type=sig.type,
                    severity=sig.severity,
                    file_path=str(file_path),
                    file_hash=file_hash,
                    detection_engine="signature",
                    details={"signature_id": sig.id, "description": sig.description}
                )
        
        return None
    
    def _check_file_pattern(self, file_path: Path) -> ThreatDetection | None:
        """Check file against pattern-based signatures"""
        file_name = file_path.name
        file_name_str = str(file_path)
        
        for sig in THREAT_SIGNATURES.values():
            # Check filename patterns
            if sig.pattern and match_pattern(file_name, sig.pattern):
                self._log(f"PATTERN MATCH: {sig.name} matches {file_path}")
                return ThreatDetection(
                    threat_id=sig.id,
                    threat_name=sig.name,
                    threat_type=sig.type,
                    severity=sig.severity,
                    file_path=str(file_path),
                    detection_engine="signature",
                    details={"pattern": sig.pattern, "description": sig.description}
                )
            
            # Check file extensions
            if sig.file_extensions:
                ext = file_path.suffix.lower()
                if ext in [e.lower() for e in sig.file_extensions]:
                    self._log(f"SUSPICIOUS EXTENSION: {sig.name} - {ext}")
                    return ThreatDetection(
                        threat_id=sig.id,
                        threat_name=sig.name,
                        threat_type=sig.type,
                        severity=sig.severity,
                        file_path=str(file_path),
                        detection_engine="heuristic",
                        details={"extension": ext, "description": sig.description}
                    )
        
        return None
    
    def _check_heuristic(self, file_path: Path) -> ThreatDetection | None:
        """Check file with heuristic analysis"""
        file_name = file_path.name
        
        for heur_id, heur_sig in HEURISTIC_PATTERNS.items():
            if heur_sig.pattern and match_pattern(file_name, heur_sig.pattern):
                # Additional heuristic checks
                try:
                    file_size = file_path.stat().st_size
                    
                    # Check for packed/obfuscated executables
                    if file_path.suffix.lower() in [".exe", ".dll"]:
                        if file_size < 50000:  # Very small executable = possibly malicious
                            self._log(f"HEURISTIC: Suspicious small executable {file_path}")
                            return ThreatDetection(
                                threat_id=heur_id,
                                threat_name=heur_sig.name,
                                threat_type="suspicious",
                                severity="medium",
                                file_path=str(file_path),
                                detection_engine="heuristic",
                                details={
                                    "file_size": file_size,
                                    "reason": "Unusually small executable",
                                    "description": heur_sig.description
                                }
                            )
                except Exception as e:
                    self._log(f"Heuristic check error: {e}", "debug")
        
        return None
    
    def scan_file(self, file_path: Path) -> ThreatDetection | None:
        """Scan single file for threats"""
        if not file_path.exists() or not file_path.is_file():
            return None
        
        try:
            # Skip system files and very large files
            if file_path.suffix.lower() in [".sys", ".dll", ".drv"] and "System32" in str(file_path):
                return None  # Skip system DLLs during normal scan
            
            if file_path.stat().st_size > 1024 * 1024 * 500:  # Skip >500MB files
                return None
            
            # 1. Check against known malware hashes (most reliable)
            threat = self._check_file_hash(file_path)
            if threat:
                return threat
            
            # 2. Check pattern-based signatures
            threat = self._check_file_pattern(file_path)
            if threat:
                return threat
            
            # 3. Heuristic analysis
            threat = self._check_heuristic(file_path)
            if threat:
                return threat
            
        except Exception as e:
            self._log(f"Error scanning {file_path}: {e}", "warning")
        
        return None
    
    def scan_directory(self, directory: Path, recursive: bool = True, 
                      file_filter: Optional[Callable[[Path], bool]] = None) -> List[ThreatDetection]:
        """Scan directory for threats"""
        threats = []
        self.scanned_files = 0
        self.threats_found = []
        
        if not directory.exists():
            self._log(f"Directory not found: {directory}", "warning")
            return threats
        
        self._log(f"Starting directory scan: {directory}")
        
        try:
            if recursive:
                iterator = directory.rglob("*")
            else:
                iterator = directory.glob("*")
            
            for file_path in iterator:
                if self.scan_interrupted:
                    break
                
                if file_path.is_file():
                    # Apply filter if provided
                    if file_filter and not file_filter(file_path):
                        continue
                    
                    self.scanned_files += 1
                    
                    # Log progress
                    if self.scanned_files % 100 == 0:
                        self._log(f"Scanned {self.scanned_files} files...")
                    
                    # Scan file
                    threat = self.scan_file(file_path)
                    if threat:
                        threats.append(threat)
                        self.threats_found.append(threat)
        
        except Exception as e:
            self._log(f"Error during directory scan: {e}", "error")
        
        self._log(f"Scan complete: {self.scanned_files} files, {len(threats)} threats found")
        return threats
    
    def quick_scan(self) -> List[ThreatDetection]:
        """Perform quick scan of critical directories"""
        all_threats = []
        
        for directory in self.critical_paths:
            if directory and directory.exists():
                threats = self.scan_directory(directory, recursive=False)
                all_threats.extend(threats)
        
        return all_threats
    
    def full_scan(self) -> List[ThreatDetection]:
        """Perform full system scan"""
        all_threats = []
        
        if os.name == "nt":
            # Windows: scan user directories
            scan_paths = [
                Path.home(),
                Path("C:\\Users"),
                Path("C:\\ProgramFiles"),
                Path("C:\\ProgramFilesx86"),
            ]
        else:
            # Unix-like: scan home and common paths
            scan_paths = [
                Path.home(),
                Path("/opt"),
                Path("/tmp"),
            ]
        
        for base_path in scan_paths:
            if base_path.exists():
                threats = self.scan_directory(base_path, recursive=True)
                all_threats.extend(threats)
        
        return all_threats
    
    def interrupt_scan(self):
        """Interrupt ongoing scan"""
        self.scan_interrupted = True
        self._log("Scan interrupted by user")
    
    def get_scan_stats(self) -> Dict:
        """Get scan statistics"""
        return {
            "scanned_files": self.scanned_files,
            "threats_found": len(self.threats_found),
            "threats": [t.to_dict() for t in self.threats_found]
        }
