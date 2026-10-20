#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 server for Collaborators, run once as root on
# it (bin/deploy.sh --prepare does it over SSH): Docker, a firewall letting
# in SSH and the web only, a swap file as a cushion, automatic security
# updates, and the nightly backup.

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl ufw unattended-upgrades rsync python3

# Docker, from Docker's own repository
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# Firewall: SSH, HTTP (certificates, redirects), HTTPS (and HTTP/3)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# A 4 GB swap file: a cushion for memory spikes (builds, imports)
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
fi

# Security updates installed on their own
dpkg-reconfigure -f noninteractive unattended-upgrades

mkdir -p /opt/collaborators

# The nightly backup at 03:15
cat > /etc/cron.d/collaborators-backup <<'CRON'
15 3 * * * root /opt/collaborators/deploy/production/bin/backup.sh >> /var/log/collaborators-backup.log 2>&1
CRON

echo "Server ready."
