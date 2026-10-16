#!/bin/sh
# Runs inside cage: turn the panel to landscape, then open the display page full-screen.
# ROTATE: 90 or 270 (landscape either way up), 0/180 for portrait. Touch follows the rotation.
ROTATE="${ROTATE:-90}"
wlr-randr --output SPI-1 --transform "$ROTATE" 2>/dev/null || true

URL="http://localhost:8000/?display"
# First start after `install.sh --pair`: a one-time code waits in this file
PAIR_FILE="$HOME/.taddletick-display-pair"
if [ -f "$PAIR_FILE" ]; then
  URL="$URL&pair=$(cat "$PAIR_FILE")"
  rm -f "$PAIR_FILE"
fi

exec chromium \
  --kiosk "$URL" \
  --ozone-platform=wayland \
  --user-data-dir="$HOME/.taddletick-display" \
  --password-store=basic \
  --noerrdialogs --disable-infobars --no-first-run --no-default-browser-check \
  --disable-session-crashed-bubble --disable-features=Translate,TouchpadOverscrollHistoryNavigation \
  --overscroll-history-navigation=0 --disable-pinch \
  --check-for-update-interval=31536000 \
  --disable-gpu --force-device-scale-factor=1
