"""
Threat Detection Engine - Main orchestrator
Coordinates all threat detection modules and generates reports
"""

import logging
import uuid
from typing import Dict, List, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, asdict

from .scanner import FileScanner, ThreatDetection as FileThreat
from .process_monitor import ProcessMonitor, ProcessThreat, RegistryMonitor


@dataclass
class ThreatReport:
    """Complete threat detection report"""
    scan_id: str
    scan_type: str  # quick, full, realtime
    start_time: str
    end_time: str = None
    total_threats: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    threats: List[Dict] = None
    
    def to_dict(self):
        """Convert to dictionary for API"""
        return {
            "scan_id": self.scan_id,
            "scan_type": self.scan_type,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "total_threats": self.total_threats,
            "severity_breakdown": {
                "critical": self.critical_count,
                "high": self.high_count,
                "medium": self.medium_count,
                "low": self.low_count,
            },
            "threats": self.threats or [],
        }


class ThreatDetectionEngine:
    """Main threat detection engine coordinating all scanners"""
    
    def __init__(self, log_callback: Optional[Callable[[str], None]] = None):
        self.logger = logging.getLogger("ThreatDetectionEngine")
        self.log_callback = log_callback
        
        # Initialize sub-modules
        self.file_scanner = FileScanner(log_callback)
        self.process_monitor = ProcessMonitor(log_callback)
        self.registry_monitor = RegistryMonitor(log_callback)
        
        self.last_scan: Optional[ThreatReport] = None
    
    def _log(self, msg: str, level: str = "info"):
        """Log message with optional callback"""
        getattr(self.logger, level)(msg)
        if self.log_callback and level in {"warning", "error", "critical"}:
            self.log_callback(f"[ThreatEngine] {msg}")
    
    def _normalize_threat(self, threat: FileThreat | ProcessThreat | Dict) -> Dict:
        """Normalize threat object to dictionary"""
        if isinstance(threat, FileThreat):
            return {
                "threat_id": threat.threat_id,
                "threat_name": threat.threat_name,
                "threat_type": threat.threat_type,
                "severity": threat.severity,
                "file_path": threat.file_path,
                "file_hash": threat.file_hash,
                "detection_engine": threat.detection_engine,
                "details": threat.details or {},
            }
        elif isinstance(threat, ProcessThreat):
            return {
                "threat_id": str(uuid.uuid4()),
                "threat_name": threat.threat_type,
                "threat_type": "process_anomaly",
                "severity": threat.severity,
                "process_name": threat.process_name,
                "process_id": threat.process_id,
                "reason": threat.reason,
                "detection_engine": "behavioral",
                "details": threat.details or {},
            }
        elif isinstance(threat, Dict):
            if "registry_key" in threat:  # Registry threat
                return {
                    "threat_id": str(uuid.uuid4()),
                    "threat_name": threat.get("threat_type", "registry_anomaly"),
                    "threat_type": "registry_modification",
                    "severity": threat.get("severity", "high"),
                    "registry_key": threat.get("registry_key"),
                    "detection_engine": "behavioral",
                    "details": threat,
                }
        
        return threat
    
    def quick_scan(self) -> ThreatReport:
        """Perform quick scan of critical directories and running processes"""
        self._log("Starting quick scan...")
        scan_id = str(uuid.uuid4())
        start_time = datetime.utcnow().isoformat()
        
        threats = []
        
        # Quick file scan
        self._log("Scanning critical directories...")
        file_threats = self.file_scanner.quick_scan()
        threats.extend([self._normalize_threat(t) for t in file_threats])
        
        # Process monitoring
        self._log("Scanning running processes...")
        process_threats = self.process_monitor.scan_all_processes()
        threats.extend([self._normalize_threat(t) for t in process_threats])
        
        # Registry check (Windows)
        self._log("Checking registry...")
        registry_threats = self.registry_monitor.check_suspicious_registry()
        threats.extend([self._normalize_threat(t) for t in registry_threats])
        
        # Build report
        report = ThreatReport(
            scan_id=scan_id,
            scan_type="quick",
            start_time=start_time,
            end_time=datetime.utcnow().isoformat(),
            total_threats=len(threats),
            threats=threats,
        )
        
        # Count by severity
        for threat in threats:
            severity = threat.get("severity", "low")
            if severity == "critical":
                report.critical_count += 1
            elif severity == "high":
                report.high_count += 1
            elif severity == "medium":
                report.medium_count += 1
            else:
                report.low_count += 1
        
        self.last_scan = report
        
        self._log(f"Quick scan complete: {report.total_threats} threats, "
                 f"Critical: {report.critical_count}, "
                 f"High: {report.high_count}, "
                 f"Medium: {report.medium_count}")
        
        return report
    
    def full_scan(self) -> ThreatReport:
        """Perform full system scan"""
        self._log("Starting full system scan...")
        scan_id = str(uuid.uuid4())
        start_time = datetime.utcnow().isoformat()
        
        threats = []
        
        # Full file scan
        self._log("Performing full file system scan...")
        file_threats = self.file_scanner.full_scan()
        threats.extend([self._normalize_threat(t) for t in file_threats])
        
        # Process monitoring
        self._log("Scanning all running processes...")
        process_threats = self.process_monitor.scan_all_processes()
        threats.extend([self._normalize_threat(t) for t in process_threats])
        
        # Registry check (Windows)
        self._log("Performing deep registry scan...")
        registry_threats = self.registry_monitor.check_suspicious_registry()
        threats.extend([self._normalize_threat(t) for t in registry_threats])
        
        # Build report
        report = ThreatReport(
            scan_id=scan_id,
            scan_type="full",
            start_time=start_time,
            end_time=datetime.utcnow().isoformat(),
            total_threats=len(threats),
            threats=threats,
        )
        
        # Count by severity
        for threat in threats:
            severity = threat.get("severity", "low")
            if severity == "critical":
                report.critical_count += 1
            elif severity == "high":
                report.high_count += 1
            elif severity == "medium":
                report.medium_count += 1
            else:
                report.low_count += 1
        
        self.last_scan = report
        
        self._log(f"Full scan complete: {report.total_threats} threats, "
                 f"Critical: {report.critical_count}, "
                 f"High: {report.high_count}, "
                 f"Medium: {report.medium_count}")
        
        return report
    
    def realtime_scan(self) -> ThreatReport:
        """Perform realtime scan (running processes + registry only, no full filesystem)"""
        self._log("Starting realtime scan...")
        scan_id = str(uuid.uuid4())
        start_time = datetime.utcnow().isoformat()
        
        threats = []
        
        # Process monitoring only
        self._log("Scanning running processes (realtime)...")
        process_threats = self.process_monitor.scan_all_processes()
        threats.extend([self._normalize_threat(t) for t in process_threats])
        
        # Registry check (Windows)
        self._log("Checking registry (realtime)...")
        registry_threats = self.registry_monitor.check_suspicious_registry()
        threats.extend([self._normalize_threat(t) for t in registry_threats])
        
        # Build report
        report = ThreatReport(
            scan_id=scan_id,
            scan_type="realtime",
            start_time=start_time,
            end_time=datetime.utcnow().isoformat(),
            total_threats=len(threats),
            threats=threats,
        )
        
        # Count by severity
        for threat in threats:
            severity = threat.get("severity", "low")
            if severity == "critical":
                report.critical_count += 1
            elif severity == "high":
                report.high_count += 1
            elif severity == "medium":
                report.medium_count += 1
            else:
                report.low_count += 1
        
        self.last_scan = report
        
        if threats:
            self._log(f"Realtime scan: {report.total_threats} threats detected!")
        else:
            self._log("Realtime scan: No threats detected")
        
        return report
    
    def get_last_scan(self) -> Optional[ThreatReport]:
        """Get last scan report"""
        return self.last_scan
    
    def interrupt_scan(self):
        """Interrupt ongoing file scan"""
        self.file_scanner.interrupt_scan()
        self._log("Scan interruption requested")
