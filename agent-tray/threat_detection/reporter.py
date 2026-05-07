"""
Threat Reporting & API Integration
Handles communication with the management API to report detected threats
"""

import logging
import json
from typing import Dict, List, Optional, Tuple
import requests
from datetime import datetime

from .engine import ThreatReport


class ThreatReporter:
    """Handles threat reporting to management API"""
    
    def __init__(self, api_base_url: str, agent_id: str, account_id: Optional[str] = None,
                 log_callback: Optional[callable] = None):
        self.logger = logging.getLogger("ThreatReporter")
        self.log_callback = log_callback
        self.api_base_url = api_base_url.rstrip('/')
        self.agent_id = agent_id
        self.account_id = account_id
        self.threat_endpoint = f"{self.api_base_url}/threat"
    
    def _log(self, msg: str, level: str = "info"):
        """Log message with optional callback"""
        getattr(self.logger, level)(msg)
        if self.log_callback:
            self.log_callback(f"[ThreatReporter] {msg}")
    
    def report_threat(self, threat: Dict, endpoint_id: Optional[str] = None) -> Tuple[bool, Dict | str]:
        """Report a single threat to the API"""
        try:
            payload = {
                "agent_id": self.agent_id,
                "account_id": self.account_id,
                "endpoint_id": endpoint_id,
                "threat_name": threat.get("threat_name"),
                "threat_type": threat.get("threat_type"),
                "severity": threat.get("severity"),
                "file_path": threat.get("file_path") or threat.get("process_name") or threat.get("registry_key"),
                "file_hash": threat.get("file_hash"),
                "process_name": threat.get("process_name"),
                "process_id": threat.get("process_id"),
                "detection_engine": threat.get("detection_engine", "signature"),
                "details": threat.get("details", {}),
                "detected_at": datetime.utcnow().isoformat(),
            }
            
            self._log(f"Reporting threat: {payload['threat_name']} ({payload['severity']})")
            
            response = requests.post(
                self.threat_endpoint,
                json=payload,
                timeout=10,
                verify=True
            )
            
            if response.status_code >= 400:
                error_msg = response.text
                try:
                    error_msg = response.json().get("error", response.text)
                except:
                    pass
                
                self._log(f"Threat report failed (HTTP {response.status_code}): {error_msg}", "error")
                return False, error_msg
            
            result = response.json()
            self._log(f"✓ Threat reported successfully")
            return True, result
        
        except Exception as e:
            self._log(f"Exception reporting threat: {e}", "error")
            return False, str(e)
    
    def report_scan_results(self, scan_report: ThreatReport, endpoint_id: Optional[str] = None) -> Tuple[bool, List]:
        """Report all threats from a scan"""
        self._log(f"Reporting {scan_report.total_threats} threats from {scan_report.scan_type} scan...")
        
        results = []
        reported_count = 0
        failed_count = 0
        
        if not scan_report.threats:
            self._log("No threats to report")
            # Still report the scan summary even if no threats found
            self.report_scan_summary(scan_report, endpoint_id)
            return True, results
        
        for threat in scan_report.threats:
            success, result = self.report_threat(threat, endpoint_id)
            results.append({
                "threat": threat.get("threat_name"),
                "success": success,
                "result": result
            })
            
            if success:
                reported_count += 1
            else:
                failed_count += 1
        
        self._log(f"Scan reporting complete: {reported_count} succeeded, {failed_count} failed")
        
        # Also report scan summary for console dashboard visibility
        try:
            summary_ok, summary_result = self.report_scan_summary(scan_report, endpoint_id)
            if summary_ok:
                self._log(f"✓ Scan summary recorded in console")
            else:
                self._log(f"⚠ Failed to record scan summary: {summary_result.get('error', 'Unknown error')}", "warning")
        except Exception as e:
            self._log(f"⚠ Exception reporting scan summary: {e}", "warning")
        
        return failed_count == 0, results
    
    def report_scan_summary(self, scan_report: ThreatReport, endpoint_id: Optional[str] = None) -> Tuple[bool, Dict]:
        """Report scan summary (without individual threats)"""
        try:
            payload = {
                "agent_id": self.agent_id,
                "account_id": self.account_id,
                "endpoint_id": endpoint_id,
                "scan_id": scan_report.scan_id,
                "scan_type": scan_report.scan_type,
                "start_time": scan_report.start_time,
                "end_time": scan_report.end_time,
                "total_threats": scan_report.total_threats,
                "severity_breakdown": {
                    "critical": scan_report.critical_count,
                    "high": scan_report.high_count,
                    "medium": scan_report.medium_count,
                    "low": scan_report.low_count,
                },
            }
            
            self._log(f"Reporting scan summary: {scan_report.total_threats} threats detected")
            
            # Use a different endpoint for scan summary
            scan_summary_endpoint = f"{self.api_base_url}/scan-summary"
            
            response = requests.post(
                scan_summary_endpoint,
                json=payload,
                timeout=10,
                verify=True
            )
            
            if response.status_code >= 400:
                error_msg = response.text
                try:
                    error_msg = response.json().get("error", response.text)
                except:
                    pass
                
                self._log(f"Scan summary report failed (HTTP {response.status_code}): {error_msg}", "error")
                return False, {"error": error_msg}
            
            result = response.json()
            self._log(f"✓ Scan summary reported successfully")
            return True, result
        
        except Exception as e:
            self._log(f"Exception reporting scan summary: {e}", "error")
            return False, {"error": str(e)}
    
    def update_threat_status(self, threat_id: str, status: str, action: Optional[str] = None) -> Tuple[bool, Dict]:
        """Update threat status (quarantined, killed, allowed, resolved)"""
        try:
            payload = {
                "threat_id": threat_id,
                "status": status,  # detected, quarantined, killed, allowed, resolved
                "action": action,  # optional: the action taken
                "updated_at": datetime.utcnow().isoformat(),
            }
            
            endpoint = f"{self.api_base_url}/threat/{threat_id}/status"
            
            response = requests.post(
                endpoint,
                json=payload,
                timeout=10,
                verify=True
            )
            
            if response.status_code >= 400:
                self._log(f"Update threat status failed (HTTP {response.status_code})", "warning")
                return False, response.json() if response.headers.get('content-type') == 'application/json' else {}
            
            self._log(f"✓ Threat status updated: {threat_id} -> {status}")
            return True, response.json()
        
        except Exception as e:
            self._log(f"Exception updating threat status: {e}", "warning")
            return False, {"error": str(e)}
    
    def get_client_policies(self) -> Tuple[bool, Dict]:
        """Fetch threat detection policies from server"""
        try:
            endpoint = f"{self.api_base_url}/policies"
            
            response = requests.get(
                endpoint,
                timeout=10,
                verify=True
            )
            
            if response.status_code >= 400:
                self._log(f"Fetch policies failed (HTTP {response.status_code})", "warning")
                return False, {}
            
            policies = response.json()
            self._log(f"✓ Fetched {len(policies) if isinstance(policies, list) else 1} policies")
            return True, policies
        
        except Exception as e:
            self._log(f"Exception fetching policies: {e}", "warning")
            return False, {}


class ThreatActionExecutor:
    """Executes threat remediation actions"""
    
    def __init__(self, log_callback: Optional[callable] = None):
        self.logger = logging.getLogger("ThreatActionExecutor")
        self.log_callback = log_callback
    
    def _log(self, msg: str, level: str = "info"):
        """Log message with optional callback"""
        getattr(self.logger, level)(msg)
        if self.log_callback:
            self.log_callback(f"[ThreatAction] {msg}")

    def _quarantine_dir(self):
        from pathlib import Path
        import os

        if os.name == 'nt':
            return Path.home() / "AppData" / "Local" / "KuaminiSecurityClient" / "Quarantine"
        return Path.home() / ".kuamini" / "quarantine"
    
    def quarantine_file(self, file_path: str) -> Tuple[bool, str]:
        """Move file to quarantine, with extra diagnostics"""
        import shutil
        from pathlib import Path
        import os
        try:
            file_path = Path(file_path)
            self._log(f"[DEBUG] Quarantine requested for: {file_path}")
            if not file_path.exists():
                self._log(f"[ERROR] File not found for quarantine: {file_path}", "error")
                return False, "File not found"
            # Create quarantine directory
            quarantine_dir = self._quarantine_dir()
            self._log(f"[DEBUG] Ensuring quarantine dir exists: {quarantine_dir}")
            quarantine_dir.mkdir(parents=True, exist_ok=True)
            if not quarantine_dir.exists():
                self._log(f"[ERROR] Failed to create quarantine dir: {quarantine_dir}", "error")
                return False, f"Failed to create quarantine dir: {quarantine_dir}"
            # Move file
            quarantine_path = quarantine_dir / file_path.name
            self._log(f"[DEBUG] Moving {file_path} to {quarantine_path}")
            shutil.move(str(file_path), str(quarantine_path))
            self._log(f"✓ Quarantined: {file_path} -> {quarantine_path}")
            return True, f"Quarantined to {quarantine_path}"
        except Exception as e:
            self._log(f"Quarantine failed: {e}", "error")
            return False, str(e)

    def restore_file(self, original_path: str) -> Tuple[bool, str]:
        """Restore a file from quarantine back to its original path."""
        import shutil
        from pathlib import Path

        try:
            target_path = Path(original_path)
            quarantine_path = self._quarantine_dir() / target_path.name

            if not quarantine_path.exists():
                return False, f"Quarantined file not found: {quarantine_path}"

            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(quarantine_path), str(target_path))

            self._log(f"✓ Restored: {quarantine_path} -> {target_path}")
            return True, f"Restored to {target_path}"
        except Exception as e:
            self._log(f"Restore failed: {e}", "error")
            return False, str(e)
    
    def kill_process(self, process_id: int, force: bool = False) -> Tuple[bool, str]:
        """Terminate suspicious process"""
        import psutil
        
        try:
            proc = psutil.Process(process_id)
            proc_name = proc.name()
            
            if force:
                proc.kill()
                self._log(f"✓ Force killed process: {proc_name} (PID: {process_id})")
                return True, f"Killed process {proc_name}"
            else:
                proc.terminate()
                # Wait for process to terminate
                try:
                    proc.wait(timeout=5)
                    self._log(f"✓ Terminated process: {proc_name} (PID: {process_id})")
                    return True, f"Terminated process {proc_name}"
                except psutil.TimeoutExpired:
                    proc.kill()
                    self._log(f"✓ Force killed process: {proc_name} (PID: {process_id})")
                    return True, f"Force killed process {proc_name}"
        
        except psutil.NoSuchProcess:
            return False, f"Process {process_id} not found"
        except psutil.AccessDenied:
            return False, f"Access denied to process {process_id}"
        except Exception as e:
            self._log(f"Kill process failed: {e}", "error")
            return False, str(e)
    
    def delete_file(self, file_path: str) -> Tuple[bool, str]:
        """Permanently delete malicious file"""
        import os
        from pathlib import Path
        
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                return False, "File not found"
            
            os.remove(str(file_path))
            self._log(f"✓ Deleted: {file_path}")
            return True, f"Deleted {file_path}"
        
        except Exception as e:
            self._log(f"Delete failed: {e}", "error")
            return False, str(e)
    
    def _whitelist_path(self):
        import os
        from pathlib import Path
        # Store in threat_detection/whitelist.json (same dir as this file)
        return Path(__file__).parent / "whitelist.json"

    def _load_whitelist(self) -> set:
        import json
        try:
            with open(self._whitelist_path(), "r", encoding="utf-8") as f:
                data = json.load(f)
            return set(data.get("hashes", []))
        except Exception:
            return set()

    def _save_whitelist(self, hashes: set) -> None:
        import json
        with open(self._whitelist_path(), "w", encoding="utf-8") as f:
            json.dump({"hashes": list(hashes)}, f, indent=2)

    def allow_threat(self, file_hash: str) -> Tuple[bool, str]:
        """Add file to persistent whitelist"""
        try:
            hashes = self._load_whitelist()
            if file_hash in hashes:
                self._log(f"Already whitelisted: {file_hash}")
                return True, f"Already whitelisted: {file_hash}"
            hashes.add(file_hash)
            self._save_whitelist(hashes)
            self._log(f"✓ Added to whitelist: {file_hash}")
            return True, f"Added {file_hash} to whitelist"
        except Exception as e:
            self._log(f"Whitelist failed: {e}", "error")
            return False, str(e)
