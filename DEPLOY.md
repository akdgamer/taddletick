# Deploying Taddletick on a Raspberry Pi

The whole app runs on the Pi in Docker: Postgres, the app (API + web UI), a worker
that syncs to Google every 5 minutes, and a nightly database backup to the NAS.
You reach it from your laptop and iPhone through Tailscale, over HTTPS, without
opening anything to the internet.

```
iPhone / laptop ──Tailscale (HTTPS)──► Pi: tailscale serve ──► app :8000 ──► Postgres
                                                              │
                                            worker ──► Google Calendar + Tasks
                                            files + nightly backups ──► NAS (SMB mount)
```

## 1. Prepare the Pi

- Raspberry Pi OS **64-bit** (Lite is fine). A USB SSD instead of the SD card is
  strongly recommended: SD cards wear out and corrupt on power cuts.
- Install Docker:

  ```sh
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # log out and back in afterwards
  ```

## 2. Install Tailscale on the Pi

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

In the Tailscale admin console (login.tailscale.com):

- **Machines**: rename the Pi to something like `taddletick-pi`.
- **DNS**: enable **MagicDNS** and **HTTPS Certificates**.

Your app's address will be `https://taddletick-pi.<your-tailnet>.ts.net` (the
exact name is shown under **DNS → Tailnet name**).

## 3. Mount the NAS share (OpenMediaVault, SMB)

In OMV, create a shared folder (e.g. `taddletick`) and an SMB share for it, with a
user that can read and write. Then on the Pi:

```sh
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/nas
printf 'username=NAS_USER\npassword=NAS_PASSWORD\n' | sudo tee /root/.nas-credentials >/dev/null
sudo chmod 600 /root/.nas-credentials
echo '//NAS_IP/taddletick /mnt/nas cifs credentials=/root/.nas-credentials,uid=1000,gid=1000,iocharset=utf8,_netdev,x-systemd.automount 0 0' | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount -a
mkdir -p /mnt/nas/taddletick/files /mnt/nas/taddletick/backups
```

Replace `NAS_IP`, `NAS_USER` and `NAS_PASSWORD`.

> **Your NAS uses RAID 0.** RAID 0 has no redundancy: if either disk fails, every
> file on it is gone, including these backups. Copy `/mnt/nas/taddletick` to a
> second place (USB drive, another machine, cloud) regularly.

## 4. Get the code and configure it

```sh
git clone https://github.com/akdgamer/taddletick.git
cd taddletick
cp .env.example .env
nano .env       # set DB_PASSWORD (long random), FILES_PATH, BACKUP_PATH, GOOGLE_REDIRECT_URI
mkdir -p secrets
```

`openssl rand -hex 24` makes a good `DB_PASSWORD`.

## 5. Start it

```sh
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # all four services "Up"
curl http://127.0.0.1:8000/health                    # {"status":"ok"}
```

The first build takes a while on a Pi (it compiles the web UI). Migrations run
automatically every time the app starts.

## 6. Publish it to your devices with Tailscale

```sh
sudo tailscale serve --bg 8000
tailscale serve status
```

Now open `https://taddletick-pi.<your-tailnet>.ts.net` from any device logged in to
your Tailscale account.

The first visit asks you to **create the admin account**. If you're moving data
from the laptop (step 8) and already have an account there, it comes along and
you just log in. Add the other people under **Users**: each gets a username and
a first password from you, and can change it under **Settings**.

**iPhone**: install the Tailscale app, sign in with the same account and switch it
on. Open the address in Safari → Share → **Add to Home Screen**. It opens like an app.

## 7. Connect Google Calendar and Tasks

1. Go to https://console.cloud.google.com, create a project (e.g. "Taddletick").
2. **APIs & Services → Library**: enable **Google Calendar API** and **Google Tasks API**.
3. **OAuth consent screen** (Google Auth Platform → Branding/Audience): user type
   **External**, app name "Taddletick", your email. Under **Audience**, add your
   Google account as a test user, then press **Publish app** so the status is
   **In production**. (In "Testing" status, Google expires the sign-in after 7 days
   and sync silently stops.)
4. **Credentials → Create credentials → OAuth client ID**, type **Web application**.
   Under **Authorized redirect URIs** add:
   - `https://taddletick-pi.<your-tailnet>.ts.net/google/callback` (the Pi)
   - `http://localhost:8000/google/callback` (optional: development on your laptop)
5. Download the JSON and copy it to the Pi as `taddletick/secrets/google_client_secret.json`.
6. Make sure `GOOGLE_REDIRECT_URI` in `.env` is exactly the Pi URI above, then
   `docker compose -f docker-compose.prod.yml up -d`.
7. In the app: **Settings → Connect Google account**. Each person connects their
   own Google account this way; they only get the projects they can see. Google will warn that the app
   isn't verified; that's expected for a personal app: **Advanced → Go to Taddletick**.

The app creates a calendar and a task list named **Taddletick** and only ever
touches those. Turn on notifications for that calendar on your iPhone (Settings →
Calendar → Accounts → add your Google account if it isn't there; or use the Google
Calendar app). Events carry a reminder at 9:00 the day before.

If Google rejects the sign-in with a scope error, edit `SCOPES` in
`backend/app/google_sync.py` to use `https://www.googleapis.com/auth/calendar`
instead of `.../calendar.app.created`, rebuild, and connect again.

## 8. Move your existing data from the laptop

On the laptop (in the project folder, with the dev database running):

```sh
docker compose exec -T db pg_dump -U tracker -Fc tracker > taddletick.dump
scp taddletick.dump PI_USER@taddletick-pi:~/taddletick/
rsync -a data/files/ PI_USER@taddletick-pi:/mnt/nas/taddletick/files/   # if you uploaded files
```

On the Pi:

```sh
cd ~/taddletick
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U tracker -d tracker --clean --if-exists --no-owner < taddletick.dump
docker compose -f docker-compose.prod.yml restart app worker
```

## Everyday operations

| Task | Command (in `~/taddletick` on the Pi) |
|---|---|
| Update to the latest code | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| See logs | `docker compose -f docker-compose.prod.yml logs -f app worker` |
| Restart | `docker compose -f docker-compose.prod.yml restart` |
| List backups | `ls /mnt/nas/taddletick/backups` |
| Restore a backup | `docker compose -f docker-compose.prod.yml exec -T db pg_restore -U tracker -d tracker --clean --if-exists --no-owner < /mnt/nas/taddletick/backups/taddletick-YYYYMMDD-HHMM.dump` |

Backups run once a day (first one at startup) and are kept for `BACKUP_KEEP_DAYS`.
