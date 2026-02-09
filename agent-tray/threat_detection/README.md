# Kuamini Threat Detection Module

Complete endpoint threat detection engine with file scanning, process monitoring, and behavioral analysis.

## Features

### 1. **File System Scanning**
- **Signature-based detection**: Matches files against known malware hashes and patterns
- **Heuristic analysis**: Identifies suspicious executables based on size, location, and characteristics
- **Pattern matching**: Detects ransomware file extensions and naming conventions
- **Hash calculation**: SHA256/MD5 verification against threat database

### 2. **Process Monitoring**
- **CPU/Memory abuse detection**: Identifies resource-hungry processes
- **Suspicious process detection**: Flags processes running from unusual locations
- **Parent-child relationships**: Detects trojan injection patterns
- **Network connection monitoring**: Identifies connections to malicious domains
- **Forking bomb detection**: Detects process multiplication attacks
- **Registry persistence checks**: Finds suspicious auto-start mechanisms

### 3. **Behavioral Analysis**
- **Command execution patterns**: Detects obfuscated PowerShell/CMD
- **Registry modification patterns**: Identifies persistence techniques
- **Network anomalies**: Detects C&C communication attempts
- **File encryption activities**: Identifies ransomware

### 4. **Windows Registry Monitoring**
- Checks Run keys for suspicious programs
- Detects persistence mechanisms
- Monitors service modifications

### 5. **Threat Reporting**
- Real-time reporting to management console
- Scan summaries and detailed threat information
- Threat status tracking
- Threat action execution (quarantine, kill, whitelist)

## Architecture

```
├── engine.py                 # Main orchestrator
├── scanner.py               # File system scanner
├── process_monitor.py       # Process & registry monitoring
├── reporter.py              # API integration & threat reporting
├── signatures.py            # Threat signature database
├── integration_example.py   # Usage examples
└── __init__.py              # Module exports
```

## Installation

### Prerequisites
```bash
# Add to requirements.txt
psutil>=5.9.8
requests>=2.31.0
```

### Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Place threat_detection folder in agent-tray directory
cp -r threat_detection agent-tray/
```

## Usage

### Basic Usage

#### 1. Quick Scan (Critical Directories)
```python
from threat_detection import ThreatDetectionEngine

engine = ThreatDetectionEngine()
report = engine.quick_scan()

print(f"Threats found: {report.total_threats}")
print(f"Critical: {report.critical_count}")
print(f"High: {report.high_count}")

for threat in report.threats:
    print(f"  - {threat['threat_name']} ({threat['severity']})")
```

#### 2. Full System Scan
```python
report = engine.full_scan()
print(f"Full scan complete: {report.total_threats} threats")
```

#### 3. Realtime Monitoring
```python
report = engine.realtime_scan()
# Lightweight scan - processes & registry only
```

### Reporting Threats

```python
from threat_detection import ThreatReporter

reporter = ThreatReporter(
    api_base_url="https://kuaminisystems.com/api/agent",
    agent_id="agent-uuid",
    account_id="account-uuid"
)

# Report scan results
success, results = reporter.report_scan_results(
    scan_report,
    endpoint_id="endpoint-uuid"
)

# Report individual threat
success, result = reporter.report_threat(
    threat={
        "threat_name": "Win32.Malware.X",
        "threat_type": "trojan",
        "severity": "critical",
        "file_path": "C:\\badfile.exe",
        "detection_engine": "signature"
    },
    endpoint_id="endpoint-uuid"
)
```

### Threat Remediation

```python
from threat_detection import ThreatActionExecutor

executor = ThreatActionExecutor()

# Quarantine file
success, msg = executor.quarantine_file("C:\\infected_file.exe")

# Kill process
success, msg = executor.kill_process(process_id=1234, force=False)

# Delete file
success, msg = executor.delete_file("C:\\malware.exe")

# Add to whitelist
success, msg = executor.allow_threat("file_hash")
```

### Integration with Agent

```python
from threat_detection.integration_example import integrate_threat_detection

# In your main agent
config = {
    'api_base': 'https://kuaminisystems.com/api/agent',
    'agent_id': 'agent-uuid',
    'account_id': 'account-uuid',
    'endpoint_id': 'endpoint-uuid',
    'scan_interval': 3600,  # 1 hour
}

# Initialize with background threads
threat_system = integrate_threat_detection(config, log_callback=log_func)

# Perform on-demand scan
scan_result = threat_system['quick_scan']()
```

## Threat Signatures

### Built-in Signatures Include:
- **Ransomware**: LockBit, WannaCry, and variants
- **Trojans**: Emotet, Zeus, and banking trojans
- **PUP**: Crypto miners, browser hijackers
- **Worms**: Self-propagating malware
- **Rootkits**: System-level persistence mechanisms

### Adding Custom Signatures

```python
from threat_detection.signatures import ThreatSignature, add_custom_signature

custom_sig = ThreatSignature(
    id="custom_001",
    name="My Malware",
    type="trojan",
    severity="critical",
    detection_method="hash",
    hashes=["abc123..."],
    description="Custom threat signature"
)

add_custom_signature(custom_sig)
```

## Configuration

### Scan Settings
```python
# Console policy (recommended)
{
  "type": "scheduled_scan",
  "config": {
    "enabled": true,
    "scan_interval": 3600,        # Seconds
    "scan_mode": "quick"          # quick, full, realtime
  }
}

# Optional local defaults in config.json
{
  "threat_scan_interval": 3600,
  "threat_scan_mode": "quick",
  "threat_realtime_monitor": false,
  "threat_realtime_interval": 300
}
```

## Threat Report Format

```json
{
  "scan_id": "uuid",
  "scan_type": "full",
  "start_time": "2026-02-09T10:00:00Z",
  "end_time": "2026-02-09T10:15:00Z",
  "total_threats": 5,
  "severity_breakdown": {
    "critical": 1,
    "high": 2,
    "medium": 2,
    "low": 0
  },
  "threats": [
    {
      "threat_id": "sig_001",
      "threat_name": "Win32.Malware.X",
      "threat_type": "trojan",
      "severity": "critical",
      "file_path": "C:\\temp\\malware.exe",
      "file_hash": "abc123...",
      "detection_engine": "signature",
      "details": {
        "signature_id": "sig_001",
        "description": "Known trojan pattern"
      }
    }
  ]
}
```

## API Endpoints

### Report Threat
```
POST /api/agent/threat
{
  "agent_id": "uuid",
  "account_id": "uuid",
  "threat_name": "Malware.X",
  "threat_type": "trojan",
  "severity": "critical",
  "file_path": "C:\\file.exe",
  "detection_engine": "signature",
  "details": {...}
}

Response:
{
  "success": true,
  "threat_id": "uuid"
}
```

### Report Scan Summary
```
POST /api/agent/scan-summary
{
  "agent_id": "uuid",
  "scan_id": "uuid",
  "scan_type": "full",
  "total_threats": 5,
  "severity_breakdown": {...}
}

Response:
{
  "success": true,
  "scan_id": "uuid"
}
```

### Update Threat Status
```
POST /api/agent/threat/{threat_id}/status
{
  "status": "quarantined",
  "action": "moved_to_quarantine"
}

Response:
{
  "success": true
}
```

## Detection Methods

| Method | Accuracy | Speed | Resource Usage |
|--------|----------|-------|----------------|
| **Signature** | Very High | Fast | Low |
| **Heuristic** | Medium-High | Medium | Medium |
| **Behavioral** | Medium | Slow | High |
| **Pattern** | High | Fast | Low |

## Performance Considerations

- **Quick Scan**: ~5-10 minutes (critical directories only)
- **Full Scan**: 30 minutes - 2 hours (depends on disk size)
- **Realtime Scan**: <2 minutes (processes only)

### Optimization Tips
1. Run full scans during off-hours
2. Use quick scans for frequent checks
3. Enable realtime monitoring for critical systems
4. Exclude legitimate large directories (backups, archives)
5. Use process-based detection for immediate threats

## Logging

```python
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

# Or set specific module level
logging.getLogger("ThreatDetectionEngine").setLevel(logging.DEBUG)
```

## Threat Severity Levels

- **Critical**: Immediate action required (ransomware, active exploitation)
- **High**: Urgent response needed (trojans, rootkits)
- **Medium**: Should be addressed (suspicious behavior, PUP)
- **Low**: Monitor (suspicious patterns, low-risk PUP)
- **Info**: Informational only

## Limitations & Known Issues

1. **System DLL Detection**: Avoids false positives on critical system files
2. **File Access**: Some system files require elevated privileges
3. **Network Detection**: Requires network monitoring capabilities
4. **Registry Access**: Windows only, requires admin on some keys
5. **Performance**: Full scans can impact system performance

## Testing

```bash
# Run tests
python -m pytest threat_detection/tests/

# Test file scanning
python -c "
from threat_detection import FileScanner
scanner = FileScanner()
threats = scanner.scan_directory('/test/path')
print(f'Found {len(threats)} threats')
"

# Test process monitoring
python -c "
from threat_detection import ProcessMonitor
pm = ProcessMonitor()
threats = pm.scan_all_processes()
print(f'Found {len(threats)} suspicious processes')
"
```

## Updates & Maintenance

### Signature Updates
```python
# Fetch latest signatures from server
success, policies = reporter.get_client_policies()

# Server can push signature updates
# Implement periodic updates (daily/weekly)
```

### Version Management
```python
import threat_detection
print(threat_detection.__version__)  # "1.0.0"
```

## Support & Troubleshooting

### High False Positive Rate
- Disable heuristics for known-good software
- Add signatures to exception list
- Adjust CPU/memory thresholds

### Scan Performance Issues
- Run scans during off-hours
- Exclude network drives
- Use quick scan instead of full scan

### Missing Detections
- Update threat signatures
- Enable behavioral detection
- Check scan type (realtime vs full)

## Security Best Practices

1. **Keep signatures updated** - Weekly updates recommended
2. **Use file hashing** - Most reliable detection method
3. **Monitor behavior** - Enable realtime monitoring
4. **Quarantine safely** - Never restore from untrusted sources
5. **Audit actions** - Log all threat detections and actions taken

## Future Enhancements

- [ ] Machine learning threat detection
- [ ] Yara rule integration
- [ ] VirusTotal API integration
- [ ] Advanced memory forensics
- [ ] Sandbox detonation
- [ ] Threat intelligence feeds
- [ ] Behavioral ML models
- [ ] GPU-accelerated scanning

## License

Part of Kuamini Threat Protection Agent
© 2026 Kuamini Systems Private Limited

## Support

For issues, feature requests, or contributions, please contact the development team.
