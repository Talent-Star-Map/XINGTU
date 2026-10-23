"""Install an independent daily board timer without changing legacy collectors."""
from pathlib import Path
import subprocess

BASE = Path('/data/xingtu')
UNITS = Path('/etc/systemd/system')


def main():
    if not (BASE / 'collector/github_daily.py').is_file():
        raise RuntimeError('stage github_daily.py first')
    service = UNITS / 'xingtu-github-daily.service'
    timer = UNITS / 'xingtu-github-daily.timer'
    for path in (service, timer):
        if path.exists():
            path.with_suffix(path.suffix + '.before').write_bytes(path.read_bytes())
    service.write_text('''[Unit]
Description=XINGTU GitHub daily Trending board and immutable snapshot
After=docker.service network-online.target
Requires=docker.service
RequiresMountsFor=/data
ConditionPathIsMountPoint=/data

[Service]
Type=oneshot
UMask=0077
ExecStart=/usr/bin/flock -n /data/xingtu/collector_state/logs/github-daily.lock /usr/bin/docker exec xingtu-collector python /app/github_daily.py
TimeoutStartSec=15min
StandardOutput=journal
StandardError=journal
''')
    timer.write_text('''[Unit]
Description=XINGTU daily GitHub Trending observation

[Timer]
OnCalendar=*-*-* 09:00:00 Asia/Shanghai
Persistent=true
AccuracySec=30s
Unit=xingtu-github-daily.service

[Install]
WantedBy=timers.target
''')
    subprocess.run(['systemd-analyze', 'verify', str(service), str(timer)], check=True, capture_output=True)
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    subprocess.run(['systemctl', 'enable', '--now', timer.name], check=True)
    print('Daily GitHub Trending snapshot scheduled at 09:00 Asia/Shanghai')


if __name__ == '__main__':
    main()
