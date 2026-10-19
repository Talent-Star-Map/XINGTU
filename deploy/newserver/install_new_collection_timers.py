"""New server only. Preserve old schedules; leave external-AI timer gated."""
from pathlib import Path
import datetime,json,subprocess

BASE=Path('/data/xingtu');SYSTEMD=Path('/etc/systemd/system')
def main():
    script=BASE/'run_scheduled_task.sh'
    script.write_text('''#!/bin/bash
set -euo pipefail
umask 077
kind="${1:?task required}"
case "$kind" in
 github) command=(python -u -m collectors.github.collector) ;;
 analyzer)
   [[ -f /data/xingtu/secrets/external_ai_rotation_confirmed ]] || { echo "AI credential rotation pending"; exit 78; }
   command=(python -u -m analyzer.entity_extractor --limit 50) ;;
 *) exit 64 ;;
esac
exec /usr/bin/flock -n "/data/xingtu/collector_state/logs/${kind}.lock" /usr/bin/docker exec xingtu-collector "${command[@]}"
''');script.chmod(0o700)
    for kind,calendars in [('github',['*-*-* 14:30:00 Asia/Shanghai','*-*-* 23:10:00 Asia/Shanghai']),('analyzer',['*-*-* *:15:00 Asia/Shanghai'])]:
        (SYSTEMD/('xingtu-'+kind+'.service')).write_text('''[Unit]
Description=XINGTU '''+kind+''' scheduled collection
After=docker.service
Requires=docker.service
RequiresMountsFor=/data
ConditionPathIsMountPoint=/data

[Service]
Type=oneshot
UMask=0077
ExecStart=/data/xingtu/run_scheduled_task.sh '''+kind+'''
TimeoutStartSec=40min
StandardOutput=journal
StandardError=journal
SyslogIdentifier=xingtu-'''+kind+'\n')
        (SYSTEMD/('xingtu-'+kind+'.timer')).write_text('''[Unit]
Description=XINGTU '''+kind+''' schedule Asia/Shanghai

[Timer]
'''+''.join('OnCalendar='+x+'\n' for x in calendars)+'''Persistent=false
AccuracySec=1s
Unit=xingtu-'''+kind+'''.service

[Install]
WantedBy=timers.target
''')
    subprocess.run(['systemd-analyze','verify',str(SYSTEMD/'xingtu-github.service'),str(SYSTEMD/'xingtu-github.timer'),str(SYSTEMD/'xingtu-analyzer.service'),str(SYSTEMD/'xingtu-analyzer.timer')],check=True,capture_output=True)
    subprocess.run(['systemctl','daemon-reload'],check=True)
    subprocess.run(['systemctl','enable','--now','xingtu-github.timer'],check=True,capture_output=True)
    # No marker or provider-side rotation evidence has been received.
    subprocess.run(['systemctl','disable','--now','xingtu-analyzer.timer'],check=True,capture_output=True)
    p=Path('/etc/systemd/journald.conf.d');p.mkdir(exist_ok=True)
    (p/'xingtu-storage.conf').write_text('[Journal]\nSystemMaxUse=200M\nRuntimeMaxUse=50M\n')
    subprocess.run(['systemctl','restart','systemd-journald'],check=True)
    result={'jd_scheduler':'container repair_pipeline.scheduler; daily 14:30 and 23:10 Asia/Shanghai','github_timer_enabled':True,'github_times':['14:30','23:10'],'analyzer_timer_enabled':False,'analyzer_gate':'provider API key rotation not confirmed','old_broken_ai_features_cron_copied':False,'old_server_modified':False}
    (BASE/'collection_schedules_result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
if __name__=='__main__':main()
