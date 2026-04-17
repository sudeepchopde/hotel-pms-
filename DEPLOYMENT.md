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

Example unit (uses venv Python if desired):

```ini
[Service]
WorkingDirectory=/home/satsangi/Hotel sathi/hotel-pms-
EnvironmentFile=/home/satsangi/Hotel sathi/hotel-pms-/.env
ExecStart=/home/satsangi/Hotel sathi/hotel-pms-/.venv/bin/python3 main.py
```

Or keep:

```ini
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Both are valid; only one process should listen on 8000.

---

## 9. Cloudflare Tunnel (no router port forwarding)

Use this when the app runs on a **home LAN** (e.g. `192.168.x.x`) and you do **not** want to forward ports 80/443 on your router. Traffic goes **out** from your PC to Cloudflare; browsers hit Cloudflare’s edge, then the tunnel.

### Prerequisites

1. A **Cloudflare** account ([dash.cloudflare.com](https://dash.cloudflare.com)).
2. **`hotelsatsangi.com`** added to Cloudflare and using **Cloudflare nameservers** (in Hostinger, change the domain’s nameservers to the pair Cloudflare shows). Until the zone is on Cloudflare, tunnel hostnames for that domain are awkward; the standard path is **DNS at Cloudflare** for this domain.
3. **Nginx** (or the app) listening on **`127.0.0.1:80`** or **`localhost:80`** — the tunnel will connect to `http://localhost:80`. Your existing nginx reverse proxy to `127.0.0.1:8000` is fine.

### A. Install `cloudflared` (Ubuntu)

`cloudflared` is **not** in Ubuntu’s default repos. **`E: Unable to locate package cloudflared`** means you ran `apt install` without adding Cloudflare’s APT source first.

**Run these three steps in order** (copy the whole block):

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

Verify: `cloudflared --version`

**Fallback (no repo):** download the `.deb` for your CPU from [cloudflared releases](https://github.com/cloudflare/cloudflared/releases) (e.g. `cloudflared-linux-amd64.deb` on typical PCs), then:

```bash
sudo dpkg -i cloudflared-linux-amd64.deb
```

### B. Create the tunnel (Zero Trust UI — recommended)

1. Open **[Cloudflare Zero Trust](https://one.dash.cloudflare.com/)** → **Networks** → **Tunnels**.
2. **Create a tunnel** → name it e.g. `hotel-pms` → **Save tunnel**.
3. Choose **Debian** / copy the install token if shown, or use **Configure** → **Public hostname**:
   - **Subdomain:** `pms`
   - **Domain:** `hotelsatsangi.com`
   - **Service type:** `HTTP`
   - **URL:** `localhost:80` (nginx) **or** `localhost:8000` (direct to FastAPI; prefer nginx if you use it).
4. Save. Cloudflare will create/update **DNS** for `pms` to point at the tunnel (often a **CNAME** to `xxxx.cfargotunnel.com`).

### C. Run the connector on this machine

After the UI gives you a **token** or **config**:

```bash
sudo cloudflared service install <TOKEN_FROM_DASHBOARD>
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

If you use a **config file** instead:

```yaml
# /etc/cloudflared/config.yml (example — paths vary)
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: pms.hotelsatsangi.com
    service: http://localhost:80
  - service: http_status:404
```

Then:

```bash
sudo cloudflared --config /etc/cloudflared/config.yml tunnel run
```

Use `systemd` unit from Cloudflare’s docs or `cloudflared service install` so it starts on boot.

### D. DNS cleanup

- **Remove** any **A record** for `pms` pointing to your home **public IP** (`49.37.x.x`) if you added one — it conflicts with the tunnel’s **CNAME**.
- Let the tunnel (or Zero Trust) own **`pms.hotelsatsangi.com`** as **Proxied** (orange cloud).

### E. Verify

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://pms.hotelsatsangi.com/
```

You should get **HTTP 200** (or 30x). Browsers use **HTTPS** on Cloudflare automatically.

### Notes

- **No port forwarding** on the home router for 80/443 to this machine.
- **UFW** can stay restrictive; outbound HTTPS to Cloudflare must be allowed (default allow).
- Optional: restrict tunnel access in Zero Trust (**Access** policies) for staff-only login.
