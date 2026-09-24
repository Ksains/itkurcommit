#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo 'Run this installer with sudo' >&2
    exit 1
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
install -m 0755 "$script_dir/server-auto-update.sh" /usr/local/sbin/itkurcommit-update

cat > /etc/systemd/system/itkurcommit-update.service <<'EOF'
[Unit]
Description=Update itkurcommit after a merge to GitHub main
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/itkurcommit-update
TimeoutStartSec=10min
EOF

cat > /etc/systemd/system/itkurcommit-update.timer <<'EOF'
[Unit]
Description=Check itkurcommit for new commits every two minutes

[Timer]
OnBootSec=1min
OnUnitInactiveSec=2min
AccuracySec=1s
Unit=itkurcommit-update.service

[Install]
WantedBy=timers.target
EOF

systemd-analyze verify /etc/systemd/system/itkurcommit-update.service /etc/systemd/system/itkurcommit-update.timer
systemctl daemon-reload
systemctl start itkurcommit-update.service
systemctl enable --now itkurcommit-update.timer
systemctl list-timers --no-pager itkurcommit-update.timer
