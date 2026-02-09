"""
Integration example: How to use the threat detection engine in the main agent
This file shows how to integrate threat detection with the existing agent loop
"""

import logging
import threading
import time
from threat_detection import (
    ThreatDetectionEngine,
    ThreatReporter,
    ThreatActionExecutor,
)


def integrate_threat_detection(config: dict, log_callback=None):
    """
    Example integration of threat detection into the main agent
    
    Add this to your main agent loop to enable threat scanning
    """
    
    # Initialize threat detection engine
    threat_engine = ThreatDetectionEngine(log_callback)
    threat_reporter = ThreatReporter(
        api_base_url=config.get('api_base', 'https://kuaminisystems.com/api/agent'),
        agent_id=config.get('agent_id'),
        account_id=config.get('account_id'),
        log_callback=log_callback
    )
    threat_executor = ThreatActionExecutor(log_callback)
    
    # Configuration
    scan_interval = config.get('scan_interval', 3600)  # 1 hour default
    endpoint_id = config.get('endpoint_id')  # From agent registration
    
    def threat_scan_loop():
        """Background thread that performs periodic threat scans"""
        last_scan_time = 0
        
        while True:
            try:
                current_time = time.time()
                
                # Perform scan at configured interval
                if current_time - last_scan_time >= scan_interval:
                    logging.info(f"Starting scheduled threat scan...")
                    
                    # Perform full scan
                    scan_report = threat_engine.full_scan()
                    
                    # Report findings
                    success, results = threat_reporter.report_scan_results(
                        scan_report,
                        endpoint_id=endpoint_id
                    )
                    
                    if not success:
                        logging.warning(f"Failed to report {scan_report.total_threats} threats")
                    else:
                        logging.info(f"Successfully reported all threats")
                    
                    last_scan_time = current_time
                    
                    # Apply automatic remediation based on policy
                    for threat in scan_report.threats or []:
                        threat_severity = threat.get('severity', 'low')
                        
                        # Example policy: Auto-quarantine high/critical threats
                        if threat_severity in ['critical', 'high']:
                            if 'file_path' in threat:
                                success, msg = threat_executor.quarantine_file(threat['file_path'])
                                if success:
                                    logging.info(f"Auto-quarantined: {threat['file_path']}")
                            
                            elif 'process_id' in threat:
                                success, msg = threat_executor.kill_process(threat['process_id'])
                                if success:
                                    logging.info(f"Auto-killed process: {threat['process_id']}")
                
                # Sleep briefly to avoid spinning
                time.sleep(10)
            
            except Exception as e:
                logging.error(f"Error in threat scan loop: {e}", exc_info=True)
                time.sleep(60)  # Wait before retrying
    
    def quick_scan_on_demand():
        """Perform quick scan on demand (called from UI or API)"""
        logging.info("Performing quick threat scan...")
        scan_report = threat_engine.quick_scan()
        
        success, results = threat_reporter.report_scan_results(
            scan_report,
            endpoint_id=endpoint_id
        )
        
        return scan_report.to_dict()
    
    def realtime_monitor():
        """Continuous realtime monitoring (less intensive)"""
        while True:
            try:
                # Quick realtime scan every 5 minutes
                scan_report = threat_engine.realtime_scan()
                
                # Report critical/high threats immediately
                critical_threats = [t for t in (scan_report.threats or [])
                                   if t.get('severity') in ['critical', 'high']]
                
                if critical_threats:
                    logging.warning(f"CRITICAL THREATS DETECTED: {len(critical_threats)}")
                    for threat in critical_threats:
                        threat_reporter.report_threat(threat, endpoint_id=endpoint_id)
                
                time.sleep(300)  # Check every 5 minutes
            
            except Exception as e:
                logging.error(f"Error in realtime monitor: {e}", exc_info=True)
                time.sleep(60)
    
    # Start background threads
    scan_thread = threading.Thread(target=threat_scan_loop, daemon=True)
    scan_thread.start()
    logging.info("✓ Threat scan background thread started")
    
    realtime_thread = threading.Thread(target=realtime_monitor, daemon=True)
    realtime_thread.start()
    logging.info("✓ Realtime monitor thread started")
    
    return {
        'engine': threat_engine,
        'reporter': threat_reporter,
        'executor': threat_executor,
        'quick_scan': quick_scan_on_demand,
    }


# Example usage in main agent loop:
"""
def agent_main_loop(config):
    # ... existing agent code ...
    
    # Integrate threat detection
    threat_system = integrate_threat_detection(config, log_callback=log_to_ui)
    
    # Now threat detection runs in background
    # You can also trigger scans on demand:
    # scan_result = threat_system['quick_scan']()
    
    # Keep agent running
    while True:
        # ... existing heartbeat and other agent logic ...
        time.sleep(1)
"""
