"""
Kuamini Threat Detection Module
Complete threat detection engine with file scanning, process monitoring, and behavioral analysis
"""

from .engine import ThreatDetectionEngine, ThreatReport
from .reporter import ThreatReporter, ThreatActionExecutor
from .scanner import FileScanner, ThreatDetection
from .process_monitor import ProcessMonitor, ProcessThreat, RegistryMonitor
from .signatures import THREAT_SIGNATURES, HEURISTIC_PATTERNS, BEHAVIORAL_INDICATORS

__all__ = [
    "ThreatDetectionEngine",
    "ThreatReport",
    "ThreatReporter",
    "ThreatActionExecutor",
    "FileScanner",
    "ThreatDetection",
    "ProcessMonitor",
    "ProcessThreat",
    "RegistryMonitor",
    "THREAT_SIGNATURES",
    "HEURISTIC_PATTERNS",
    "BEHAVIORAL_INDICATORS",
]

__version__ = "1.0.0"
