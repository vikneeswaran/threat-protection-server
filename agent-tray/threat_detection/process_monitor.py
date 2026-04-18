"""
Process & Memory Monitor - Detects suspicious process behavior
Monitors: memory usage, CPU, network connections, registry modifications, child processes
"""

import os
import sys
import logging
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
import psutil
from datetime import datetime, timedelta

from .signatures import BEHAVIORAL_INDICATORS, ThreatSignature


@dataclass
class ProcessThreat:
    """Suspicious process detected"""
    process_name: str
    process_id: int
    threat_type: str
    severity: str
    reason: str
    details: Dict
    detection_time: str = None


class ProcessMonitor:
    """Monitors running processes for suspicious behavior"""
    
    def __init__(self, log_callback: Optional[Callable[[str], None]] = None):
        self.logger = logging.getLogger("ProcessMonitor")
        self.log_callback = log_callback
        self.suspicious_processes: Dict[int, ProcessThreat] = {}
        self.monitored_processes: Dict[int, Dict] = {}
        self._debug_error_counts: Dict[str, int] = {}
        
        # Suspicious process names
        self.suspicious_proc_names = [
            "rundll32.exe", "regsvcs.exe", "regasm.exe", "cmd.exe with unusual args",
            "cscript.exe", "wscript.exe", "mshta.exe", "certutil.exe",
            "bitsadmin.exe", "curl.exe", "powershell.exe",
        ]

        # Common legitimate Windows processes that should not be flagged by generic heuristics
        self._known_system_processes = {
            "system", "system idle process", "smss.exe", "csrss.exe", "wininit.exe", "services.exe",
            "lsass.exe", "winlogon.exe", "fontdrvhost.exe", "wudfhost.exe", "sihost.exe", "audiodg.exe",
            "dwm.exe", "ctfmon.exe", "conhost.exe", "wmiapsrv.exe", "svchost.exe", "explorer.exe",
        }
    
    def _log(self, msg: str, level: str = "info"):
        """Log message with optional callback"""
        getattr(self.logger, level)(msg)
        # Avoid callback duplication for debug noise; callback is logged at INFO by caller
        if self.log_callback and level in {"warning", "error", "critical"}:
            self.log_callback(f"[ProcessMonitor] {msg}")

    def _debug_once(self, key: str, msg: str):
        """Log repetitive debug conditions at most a few times."""
        count = self._debug_error_counts.get(key, 0)
        if count < 3:
            self._log(msg, "debug")
        self._debug_error_counts[key] = count + 1
    
    def check_cpu_abuse(self, process: psutil.Process, threshold: int = 80) -> ProcessThreat | None:
        """Check if process is using excessive CPU"""
        try:
            proc_name = process.name().lower()
            if process.pid in (0, 4) or proc_name in self._known_system_processes:
                return None

            # Non-blocking sample to avoid slow per-process scans and noisy spikes
            cpu_percent = process.cpu_percent(interval=0.0)
            if cpu_percent > threshold:
                self._log(f"HIGH CPU: {process.name()} using {cpu_percent}%")
                return ProcessThreat(
                    process_name=process.name(),
                    process_id=process.pid,
                    threat_type="resource_abuse",
                    severity="high",
                    reason="High CPU usage",
                    details={
                        "cpu_percent": cpu_percent,
                        "threshold": threshold,
                        "description": "Process using excessive CPU resources"
                    }
                )
        except Exception as e:
            self._debug_once("cpu_check", f"CPU check error for pid={process.pid}: {e}")
        
        return None
    
    def check_memory_abuse(self, process: psutil.Process, threshold_mb: int = 1000) -> ProcessThreat | None:
        """Check if process is using excessive memory"""
        try:
            memory_mb = process.memory_info().rss / (1024 * 1024)
            if memory_mb > threshold_mb:
                self._log(f"HIGH MEMORY: {process.name()} using {memory_mb:.1f}MB")
                return ProcessThreat(
                    process_name=process.name(),
                    process_id=process.pid,
                    threat_type="resource_abuse",
                    severity="medium",
                    reason="High memory usage",
                    details={
                        "memory_mb": memory_mb,
                        "threshold_mb": threshold_mb,
                        "description": "Process using excessive memory"
                    }
                )
        except Exception as e:
            self._log(f"Memory check error for {process.name()}: {e}", "debug")
        
        return None
    
    def check_suspicious_name(self, process: psutil.Process) -> ProcessThreat | None:
        """Check if process name is suspicious"""
        try:
            proc_name = process.name().lower()
            if proc_name in self._known_system_processes:
                return None

            exe_path = process.exe() if hasattr(process, 'exe') else ""
            if not exe_path:
                return None
            path_l = exe_path.lower().replace("/", "\\")
            
            # Check if running from suspicious location
            suspicious_locations = [
                "\\temp\\", "appdata\\local\\temp", "\\downloads\\", "\\recycler\\",
            ]
            trusted_prefixes = [
                "c:\\windows\\system32\\",
                "c:\\windows\\syswow64\\",
                "c:\\program files\\",
                "c:\\program files (x86)\\",
            ]

            if any(path_l.startswith(prefix) for prefix in trusted_prefixes):
                return None

            if any(loc in path_l for loc in suspicious_locations):
                self._log(f"SUSPICIOUS LOCATION: {proc_name} from {exe_path}")
                return ProcessThreat(
                    process_name=proc_name,
                    process_id=process.pid,
                    threat_type="trojan",
                    severity="medium",
                    reason="Running from suspicious location",
                    details={
                        "exe_path": exe_path,
                        "suspicious_locations": suspicious_locations,
                        "description": "Process running from unusual directory"
                    }
                )
        except Exception as e:
            self._debug_once("suspicious_name", f"Suspicious name check error (pid={process.pid}): {e}")
        
        return None
    
    def check_parent_process_anomaly(self, process: psutil.Process) -> ProcessThreat | None:
        """Check if parent process is suspicious"""
        try:
            parent = process.parent()
            if not parent:
                return None
            
            parent_name = parent.name().lower()
            current_name = process.name().lower()
            
            # Suspicious parent-child relationships
            suspicious_parents = {
                "explorer.exe": ["powershell.exe", "cmd.exe"],
                "winlogon.exe": ["cmd.exe", "powershell.exe"],
                "svchost.exe": ["whoami.exe", "ipconfig.exe"],
            }
            
            if parent_name in suspicious_parents:
                if current_name in [p.lower() for p in suspicious_parents[parent_name]]:
                    self._log(f"SUSPICIOUS PARENT-CHILD: {parent_name} -> {current_name}")
                    return ProcessThreat(
                        process_name=current_name,
                        process_id=process.pid,
                        threat_type="trojan",
                        severity="high",
                        reason="Suspicious parent process",
                        details={
                            "parent_process": parent_name,
                            "parent_pid": parent.pid,
                            "description": "Suspicious parent-child process relationship"
                        }
                    )
        except Exception as e:
            self._log(f"Parent process check error: {e}", "debug")
        
        return None
    
    def check_network_connections(self, process: psutil.Process) -> Optional[List[ProcessThreat]]:
        """Check for suspicious network connections"""
        threats = []
        try:
            # psutil API compatibility across versions/platforms
            if hasattr(process, "net_connections"):
                connections = process.net_connections(kind='inet')
            elif hasattr(process, "connections"):
                connections = process.connections(kind='inet')
            else:
                return None
            
            # Known malicious domains/IPs
            suspicious_ips = [
                "127.0.0.1",  # Localhost (sometimes used for C2)
                "0.0.0.0",
            ]
            suspicious_domains = [
                ".tk", ".ml", ".ga", ".cf",  # Known malicious TLDs
            ]
            
            for conn in connections:
                if conn.raddr and conn.raddr.ip not in suspicious_ips:
                    # Could add domain resolution here
                    if any(conn.raddr.ip.endswith(tld) for tld in suspicious_domains):
                        threats.append(ProcessThreat(
                            process_name=process.name(),
                            process_id=process.pid,
                            threat_type="trojan",
                            severity="high",
                            reason="Connection to suspicious domain",
                            details={
                                "ip_address": conn.raddr.ip,
                                "port": conn.raddr.port,
                                "status": str(conn.status),
                                "description": "Process connecting to malicious TLD"
                            }
                        ))
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            return None
        except Exception as e:
            self._debug_once("network_check", f"Network check error (pid={process.pid}): {e}")
        
        return threats if threats else None
    
    def check_child_processes(self, process: psutil.Process) -> Optional[ProcessThreat]:
        """Check if process spawning too many children (forking bomb)"""
        try:
            proc_name = process.name().lower()
            if proc_name in self._known_system_processes:
                return None
            children = process.children(recursive=True)
            if len(children) > 250:  # Excessive children
                self._log(f"FORKING BOMB: {process.name()} spawned {len(children)} children")
                return ProcessThreat(
                    process_name=process.name(),
                    process_id=process.pid,
                    threat_type="worm",
                    severity="critical",
                    reason="Excessive child processes (forking bomb)",
                    details={
                        "child_count": len(children),
                        "threshold": 250,
                        "description": "Process spawning excessive child processes"
                    }
                )
        except Exception as e:
            self._debug_once("child_check", f"Child process check error (pid={process.pid}): {e}")
        
        return None
    
    def scan_all_processes(self) -> List[ProcessThreat]:
        """Scan all running processes for threats"""
        threats = []
        
        self._log("Scanning all processes...")
        
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                # CPU abuse check
                threat = self.check_cpu_abuse(proc)
                if threat:
                    threats.append(threat)
                
                # Memory abuse check
                threat = self.check_memory_abuse(proc)
                if threat:
                    threats.append(threat)
                
                # Suspicious name/location check
                threat = self.check_suspicious_name(proc)
                if threat:
                    threats.append(threat)
                
                # Parent process anomaly check
                threat = self.check_parent_process_anomaly(proc)
                if threat:
                    threats.append(threat)
                
                # Forking bomb check
                threat = self.check_child_processes(proc)
                if threat:
                    threats.append(threat)
                
                # Network connections check
                net_threats = self.check_network_connections(proc)
                if net_threats:
                    threats.extend(net_threats)
            
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass  # Process terminated or access denied
            except Exception as e:
                self._log(f"Error scanning process: {e}", "debug")
        
        self._log(f"Process scan complete: {len(threats)} threats detected")
        return threats
    
    def get_process_info(self, pid: int) -> Dict | None:
        """Get detailed information about a process"""
        try:
            proc = psutil.Process(pid)
            return {
                "pid": proc.pid,
                "name": proc.name(),
                "exe": proc.exe(),
                "cmdline": proc.cmdline(),
                "cwd": proc.cwd(),
                "cpu_percent": proc.cpu_percent(interval=0.1),
                "memory_mb": proc.memory_info().rss / (1024 * 1024),
                "status": proc.status(),
                "create_time": proc.create_time(),
                "num_threads": proc.num_threads(),
            }
        except Exception as e:
            self._log(f"Error getting process info: {e}", "debug")
        
        return None


class RegistryMonitor:
    """Monitors Windows registry for suspicious modifications (Windows only)"""
    
    def __init__(self, log_callback: Optional[Callable[[str], None]] = None):
        self.logger = logging.getLogger("RegistryMonitor")
        self.log_callback = log_callback
        self.is_windows = os.name == 'nt'
    
    def _log(self, msg: str, level: str = "info"):
        """Log message with optional callback"""
        getattr(self.logger, level)(msg)
        if self.log_callback:
            self.log_callback(f"[RegistryMonitor] {msg}")
    
    def check_suspicious_registry(self) -> List[Dict]:
        """Check Windows registry for suspicious modifications"""
        if not self.is_windows:
            return []
        
        threats = []
        
        try:
            import winreg
            
            # Check Run keys for persistence
            run_keys = [
                (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run"),
                (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run"),
            ]
            
            suspicious_programs = [
                r"C:\Temp", r"C:\Windows\Temp", "Downloads", "AppData\\Local\\Temp",
            ]
            
            for hive, subkey in run_keys:
                try:
                    with winreg.OpenKey(hive, subkey) as key:
                        for i in range(winreg.QueryInfoKey(key)[1]):
                            name, value, _ = winreg.EnumValue(key, i)
                            
                            # Check if value points to suspicious location
                            if any(sus in str(value).lower() for sus in suspicious_programs):
                                threats.append({
                                    "registry_key": subkey,
                                    "value_name": name,
                                    "value_data": value,
                                    "threat_type": "persistence",
                                    "severity": "high",
                                    "description": "Registry persistence mechanism detected"
                                })
                
                except Exception as e:
                    self._log(f"Error checking registry key {subkey}: {e}", "debug")
        
        except ImportError:
            self._log("Windows registry module not available", "warning")
        
        return threats
