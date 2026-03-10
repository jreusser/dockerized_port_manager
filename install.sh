#!/usr/bin/env bash
# install.sh — Deploy Port Manager as a systemd service
# Run as root or with sudo: sudo ./install.sh
set -euo pipefail

INSTALL_DIR="/opt/port-manager"
SERVICE_FILE="/etc/systemd/system/port-manager.service"

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (or with sudo)." >&2
  exit 1
fi

echo "==> Creating install directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

echo "==> Copying project files…"
# Sync everything except node_modules, __pycache__, and .venv
rsync -a --delete \
  --exclude='node_modules/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='.venv/' \
  --exclude='frontend/dist/' \
  . "$INSTALL_DIR/"

# Restore .env if it was overwritten with the template — preserve customisations
if [[ -f "$INSTALL_DIR/.env" ]]; then
  echo "    project files synced (existing .env preserved)"
else
  echo "    .env copied — edit $INSTALL_DIR/.env to set your passwords"
fi

echo "==> Installing systemd unit…"
cp port-manager.service "$SERVICE_FILE"

# Update WorkingDirectory to the install dir in the unit file
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$INSTALL_DIR|" "$SERVICE_FILE"

echo "==> Reloading systemd and enabling service…"
systemctl daemon-reload
systemctl enable port-manager.service
systemctl start port-manager.service

echo ""
echo "Done! Port Manager is running."
echo ""
  echo "  Dashboard:   http://localhost:$(grep FRONTEND_PORT $INSTALL_DIR/.env | cut -d= -f2 || echo 8090)"
  echo "  API:         http://localhost:$(grep BACKEND_PORT $INSTALL_DIR/.env | cut -d= -f2 || echo 9000)/docs"
echo ""
echo "  Logs:        journalctl -u port-manager -f"
echo "  Stop:        systemctl stop port-manager"
echo "  Uninstall:   systemctl disable --now port-manager && rm $SERVICE_FILE"
