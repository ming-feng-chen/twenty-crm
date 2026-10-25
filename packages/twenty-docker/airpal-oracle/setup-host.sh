#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu 24.04 Oracle VM. Safe to re-run.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -q
sudo apt-get -y -q -o Dpkg::Options::=--force-confold full-upgrade
sudo apt-get -y -q install docker.io docker-compose-v2 docker-buildx unattended-upgrades rclone
sudo usermod -aG docker ubuntu
sudo systemctl enable --now docker

# Oracle's Ubuntu image ships iptables rules that reject everything but SSH.
for port in 80 443; do
  while sudo iptables -D INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; do :; done
  reject_line=$(sudo iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')
  sudo iptables -I INPUT "${reject_line:-1}" -p tcp --dport "$port" -m state --state NEW -j ACCEPT
done
sudo netfilter-persistent save

# Building the image needs more than the 12 GB of RAM the containers leave free.
if [ ! -f /swapfile ]; then
  sudo fallocate -l 8G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

sudo mkdir -p /opt/airpal
sudo chown ubuntu:ubuntu /opt/airpal
