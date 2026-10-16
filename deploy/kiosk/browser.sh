#!/bin/sh
# Runs inside cage: rotate the panel if asked, then open the display page full-screen.
# The panel is landscape (480x320) as it comes. ROTATE=180 turns it upside down; 90/270 portrait.
# Touch follows the rotation.
ROTATE="${ROTATE:-normal}"
[ "$ROTATE" != normal ] && wlr-randr --output SPI-1 --transform "$ROTATE" 2>/dev/null

# Wait until the app answers, so the screen doesn't open on an error page after a reboot
until curl -sf http://localhost:8000/health >/dev/null; do sleep 2; done

URL="http://localhost:8000/?display"
# Touch calibration: `touch ~/.taddletick-display-calibrate` and restart the service
if [ -f "$HOME/.taddletick-display-calibrate" ]; then
  rm -f "$HOME/.taddletick-display-calibrate"
  URL="file://$(dirname "$(readlink -f "$0")")/calibrate.html"
fi
# First start after `install.sh --pair`: a one-time code waits in this file
PAIR_FILE="$HOME/.taddletick-display-pair"
if [ -f "$PAIR_FILE" ] && [ "${URL#http}" != "$URL" ]; then
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
  --overscroll-history-navigation=0 --disable-pinch --disable-smooth-scrolling \
  --check-for-update-interval=31536000 \
  --disable-gpu \
  --force-device-scale-factor=0.95  # Chromium won't make a window under ~500px; 480px / 0.95 = 505 fits
