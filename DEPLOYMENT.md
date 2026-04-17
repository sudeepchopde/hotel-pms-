# Hotel PMS — Ubuntu deployment (nginx + HTTPS)

Project path (quote spaces):

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-"
```

## 0. Public IP and DNS (do this first)

On **this server**, get your public IPv4:

```bash
curl -4 ifconfig.me
```

In **Hostinger DNS** (or your registrar), create an **A record**:

- **Name / host:** `pms` (for `pms.hotelsatsangi.com`; follow Hostinger’s UI if it expects `@` or full name)
- **Points to:** the IP from `curl -4 ifconfig.me`
- **TTL:** 300–600 seconds while testing

Wait until DNS propagates (check from your laptop):

```bash
dig +short pms.hotelsatsangi.com A
```

It should return the same IP as `curl -4 ifconfig.me` on the server.

---

## 1. Python virtualenv and dependencies

`venv` needs the `ensurepip` package on Ubuntu:

```bash
sudo apt update
sudo apt install -y python3.10-venv python3-pip
```

Recreate the venv and install requirements:

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-"
rm -rf .venv
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

If you prefer the system Python (no venv), use `pip3 install --user -r requirements.txt` instead — the systemd example below can stay on `/usr/bin/python3`.

---

## 2. Node: install deps and build frontend

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22
cd "/home/satsangi/Hotel sathi/hotel-pms-"
npm install
npm run build
```

Confirm `dist/index.html` exists.

If you don’t use nvm, install Node 18+ from Ubuntu or NodeSource and run `npm install` / `npm run build` from the project folder.

---

## 3. Run the FastAPI app on `0.0.0.0:8000`

`main.py` ends with `uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))`.

**Manual run:**

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-"
# optional: . .venv/bin/activate
python3 main.py
```

**Or** (equivalent; what systemd often uses):

```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### If port 8000 is already in use

```bash
sudo ss -ltnp | grep ':8000'
# or
sudo lsof -i :8000
```

Stop the duplicate listener (e.g. `sudo systemctl stop hotel-pms-backend`) or pick another port and set `PORT=8001` — **nginx below must proxy to the same port**.

---

## 4. nginx reverse proxy (HTTP → app)

Install nginx:

```bash
sudo apt install -y nginx
```

Create a site file:

```bash
sudo nano /etc/nginx/sites-available/pms.hotelsatsangi.com
```

Paste (adjust `proxy_pass` if you use a port other than 8000):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name pms.hotelsatsangi.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

Enable and test:

```bash
sudo ln -sf /etc/nginx/sites-available/pms.hotelsatsangi.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. HTTPS with Certbot

**Only after** DNS `pms` points to this machine and port **80** is reachable from the internet:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pms.hotelsatsangi.com
```

Certbot will modify the nginx server block for TLS and renewals.

---

## 6. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

This opens **80** and **443**. If you only opened HTTP before certbot, `Nginx Full` covers both.

---

## 7. If certbot fails — checklist

| Symptom | Likely cause |
|--------|----------------|
| `Failed to bind to port 80` | Another service on 80, or nginx not running |
| Challenge fails / timeout | **DNS A record** not pointing to this server’s public IP yet |
| Wrong page (e.g. Hostinger default) | DNS still points to **shared hosting** IP, not this Ubuntu box — fix A record to `curl -4 ifconfig.me` |
| Connection refused from outside | **UFW** or cloud security group blocking 80/443 |
| Works on server `curl localhost` but not from browser | Firewall or wrong public IP |

Verify from your laptop:

```bash
curl -I http://pms.hotelsatsangi.com
```

---

## 8. Optional: systemd with `python3 main.py`

Paths with spaces must be **quoted** in the unit file. Example:

```ini
[Unit]
Description=Hotel PMS backend
After=network.target

[Service]
Type=simple
User=satsangi
WorkingDirectory=/home/satsangi/Hotel sathi/hotel-pms-
EnvironmentFile=-/home/satsangi/Hotel sathi/hotel-pms-/.env
ExecStart=/home/satsangi/Hotel sathi/hotel-pms-/.venv/bin/python3 /home/satsangi/Hotel sathi/hotel-pms-/main.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

If `WorkingDirectory` or `ExecStart` paths break parsing, move the project to a path **without spaces** (e.g. `/opt/hotel-pms`) or use systemd’s quoted-argument form per your distro’s docs.

**Alternative** (no spaces in `ExecStart` if using uvicorn from project dir):

```ini
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
WorkingDirectory=/home/satsangi/Hotel sathi/hotel-pms-
```

Both are valid; only one process should listen on 8000.

---

## 9. No port forwarding / CGNAT

If your ISP does not allow inbound connections to your public IP, Let’s Encrypt HTTP-01 and public `https://pms.…` **will not work** on that link. Options: **VPS with a real public IP**, **Cloudflare Tunnel**, or **LAN-only** access with HTTP / self-signed HTTPS.
