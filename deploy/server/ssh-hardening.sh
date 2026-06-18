#!/usr/bin/env bash
set -euo pipefail

SSH_ALLOW_IP="${SSH_ALLOW_IP:-166.0.17.12}"
SSHD_DROPIN="/etc/ssh/sshd_config.d/99-hugetools-hardening.conf"
FAIL2BAN_JAIL="/etc/fail2ban/jail.d/sshd.local"

apt-get update
apt-get install -y fail2ban ufw

install -d -m 0755 /etc/ssh/sshd_config.d
cat > "$SSHD_DROPIN" <<'EOF'
UseDNS no
PrintMotd no
LoginGraceTime 20
MaxStartups 3:30:10
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF

install -d -m 0755 /etc/fail2ban/jail.d
cat > "$FAIL2BAN_JAIL" <<EOF
[sshd]
enabled = true
port = ssh
backend = systemd
maxretry = 3
findtime = 10m
bantime = 24h
ignoreip = 127.0.0.1/8 ::1 ${SSH_ALLOW_IP}
EOF

ufw allow from "${SSH_ALLOW_IP}" to any port 22 proto tcp
ufw delete allow 22/tcp >/dev/null 2>&1 || true
ufw allow 18089/tcp

sshd -t
systemctl enable --now fail2ban
systemctl restart fail2ban
systemctl restart ssh || systemctl restart sshd

echo "SSH hardening complete. SSH allow IP: ${SSH_ALLOW_IP}"
