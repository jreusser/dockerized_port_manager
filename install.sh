#!/usr/bin/env bash
# install.sh — Install Port Manager as a systemd service.
# The service runs directly from this git checkout — no files are copied.
# Run as root or with sudo: sudo ./install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="/etc/systemd/system/port-manager.service"

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (or with sudo)." >&2
  exit 1
fi

echo "==> Installing systemd unit (WorkingDirectory: $REPO_DIR)…"
cp "$REPO_DIR/port-manager.service" "$SERVICE_FILE"
# Stamp the actual repo path into the installed unit
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$REPO_DIR|" "$SERVICE_FILE"

echo "==> Reloading systemd and enabling service…"
systemctl daemon-reload
systemctl enable port-manager.service
systemctl restart port-manager.service

echo ""
echo "Done! Port Manager is running."
echo ""
echo "  Dashboard:   http://localhost:$(grep FRONTEND_PORT "$REPO_DIR/.env" | cut -d= -f2 || echo 8091)"
echo "  API:         http://localhost:$(grep BACKEND_PORT "$REPO_DIR/.env" | cut -d= -f2 || echo 9001)/docs"
echo ""
echo "  Logs:        journalctl -u port-manager -f"
echo "  Deploy:      git pull && sudo systemctl restart port-manager"
echo "  Stop:        systemctl stop port-manager"
echo "  Uninstall:   systemctl disable --now port-manager && rm $SERVICE_FILE"
