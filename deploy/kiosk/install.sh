#!/bin/sh
# Install (or update) the desk display service. Run on the Pi from the repo folder:
#   sh deploy/kiosk/install.sh USERNAME     # also pairs the display as USERNAME's
#   sh deploy/kiosk/install.sh              # just (re)install, keep the existing pairing
set -e
cd "$(dirname "$0")/../.."
sudo apt-get install -y --no-install-recommends cage chromium fonts-dejavu-core wlr-randr curl
chmod +x deploy/kiosk/browser.sh
sudo cp deploy/kiosk/taddletick-display.service /etc/systemd/system/
sudo cp deploy/kiosk/99-taddletick-touch.rules /etc/udev/rules.d/
sudo udevadm control --reload && sudo udevadm trigger --subsystem-match=input
sudo systemctl daemon-reload
if [ -n "$1" ]; then
  docker compose -f docker-compose.prod.yml exec -T app python -m app.pair_display "$1" > "$HOME/.taddletick-display-pair"
  chmod 600 "$HOME/.taddletick-display-pair"
fi
sudo systemctl enable taddletick-display
sudo systemctl restart taddletick-display
echo "Desk display started. Logs: journalctl -u taddletick-display -f"
