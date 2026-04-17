# Pi-hole + Nginx Proxy Manager (Docker) for Hotel PMS

This stack gives you:

- **Pi-hole**: local DNS (e.g. `pms.hotelsatsangi.com` → your server’s LAN IP).
- **Nginx Proxy Manager (NPM)**: reverse proxy with HTTPS using **Let’s Encrypt** and **Cloudflare DNS-01** (no inbound port 80 from the internet required for issuance, but you still need NPM reachable on 80/443 for clients).

Ports:

| Service | Host ports |
|---------|------------|
| Pi-hole DNS | **53** TCP/UDP |
| Pi-hole web UI | **8080** → container 80 |
| NPM HTTP/HTTPS | **80**, **443** |
| NPM admin UI | **81** |

---

## 1. Free port 53 (Pi-hole vs `systemd-resolved`)

On Ubuntu, **`systemd-resolved`** often binds **`127.0.0.53:53`**, which can block Pi-hole from using port **53**.

### Option A — Recommended: keep `systemd-resolved`, disable stub on 53

This stops the local stub listener so **nothing** listens on port 53 until Pi-hole starts.

1. Edit config:

   ```bash
   sudo nano /etc/systemd/resolved.conf
   ```

2. Under `[Resolve]`, set (uncomment or add):

   ```ini
   [Resolve]
   DNSStubListener=no
   ```

3. Restart:

   ```bash
   sudo systemctl restart systemd-resolved
   ```

4. Ensure **`/etc/resolv.conf`** is managed correctly. Often Ubuntu uses a symlink:

   ```bash
   ls -l /etc/resolv.conf
   ```

   If it points to `stub-resolv.conf`, switch to the **non-stub** file (after `DNSStubListener=no`):

   ```bash
   sudo ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
   ```

5. **After Pi-hole is running**, point this server’s DNS at Pi-hole (see section 4).

### Option B — Fully disable `systemd-resolved` (only if you know you want this)

Use when you want the OS to **not** run a local resolver at all.

1. Stop and disable:

   ```bash
   sudo systemctl disable --now systemd-resolved
   ```

2. Replace **`/etc/resolv.conf`** with a static file (temporary until Pi-hole exists):

   ```bash
   sudo rm -f /etc/resolv.conf
   echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf
   ```

3. **After Pi-hole is up**, change to:

   ```bash
   echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
   ```

4. Make it resilient to reboots: some admins use **`resolvconf`** or a small script; otherwise repeat the `127.0.0.1` line after boot or use **Option A** instead.

**Verify port 53 is free before Docker:**

```bash
sudo ss -lunp | grep ':53'
```

You should **not** see `127.0.0.53:53` after Option A with `DNSStubListener=no`.

---

## 2. Install Docker (if needed)

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
```

---

## 3. Start Pi-hole + NPM

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-/infra"
cp .env.example .env
nano .env   # set PIHOLE_WEBPASSWORD and PIHOLE_LOCAL_IPV4
docker compose up -d
docker compose ps
```

- **Pi-hole admin**: `http://<SERVER_LAN_IP>:8080/admin`
- **NPM admin**: `http://<SERVER_LAN_IP>:81`  
  Default login: `admin@example.com` / `changeme` (change on first login).

---

## 4. Point the server at Pi-hole (this machine)

On the **Ubuntu host** running Docker, set DNS to **127.0.0.1** (Pi-hole on host port 53):

```bash
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
```

If **`/etc/resolv.conf`** is overwritten on reboot, use **systemd-networkd** or **netplan** to set DNS `127.0.0.1` on your interface, or keep **`DNSStubListener=no`** and manage **`/etc/resolv.conf`** per your distro docs.

**Other LAN clients** (laptops, phones): set **DHCP DNS** to this server’s **LAN IP** so they use Pi-hole automatically.

---

## 5. Pi-hole: local name for `pms.hotelsatsangi.com`

1. Open Pi-hole: **Local DNS** → **DNS Records** (or **Local DNS** → **DNS Records** depending on version).
2. Add:
   - **Domain**: `pms.hotelsatsangi.com`
   - **IP**: your Ubuntu server’s **LAN IP** (same host running NPM), e.g. `192.168.1.100`
3. Save.

Now any client using Pi-hole as DNS resolves `pms.hotelsatsangi.com` to that IP.

---

## 6. NPM: proxy host + HTTPS (Cloudflare DNS-01)

### 6.1 Cloudflare API token (for Let’s Encrypt DNS-01)

1. Cloudflare dashboard → **My Profile** → **API Tokens** → **Create Token**.
2. Use template **“Edit zone DNS”** or create custom with:
   - **Zone** → **DNS** → **Edit**
   - **Zone** → **Zone** → **Read**  
   Scope: **hotelsatsangi.com** (or **All zones** if you prefer).
3. Create token and **copy** it once (starts with something like a long random string).

### 6.2 In NPM

1. Login to NPM (`http://<SERVER_IP>:81`).
2. **SSL Certificates** → **Add SSL Certificate** → **Let’s Encrypt**.
3. Enable **Use a DNS Challenge**.
4. **DNS Provider**: **Cloudflare**.
5. Paste **Credentials File Content** — NPM expects the token in the format Cloudflare’s provider uses; for NPM’s Cloudflare plugin this is typically:

   ```text
   dns_cloudflare_api_token=YOUR_CLOUDFLARE_API_TOKEN_HERE
   ```

   (Exact field label may say “API Token”; paste the token value in the box NPM provides for Cloudflare.)

6. **Domain names**: `pms.hotelsatsangi.com`
7. Agree to Let’s Encrypt TOS → **Save**.

After the cert issues, add a **Proxy Host**:

- **Domain names**: `pms.hotelsatsangi.com`
- **Scheme**: `http`
- **Forward hostname / IP**: `host.docker.internal` **or** the **Docker bridge gateway IP** **or** your **host LAN IP** — whichever reaches your PMS app.
- **Forward port**: port where **FastAPI/nginx** listens (e.g. **8000** if only uvicorn, or **80** if something on host listens on 80 **outside** NPM).

**Important:** Nothing else should bind **host** ports **80/443** except NPM containers. Your existing system nginx on 80 would conflict — stop it or use different host ports for NPM (not recommended for simplicity).

---

## 7. Firewall (UFW)

```bash
sudo ufw allow 53/tcp
sudo ufw allow 53/udp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 81/tcp
sudo ufw allow 8080/tcp
sudo ufw reload
```

---

## 8. Relation to Cloudflare Tunnel

If you **also** use **Cloudflare Tunnel** for remote access, **do not** point the **same** `pms` name to both **Pi-hole local IP** and **public tunnel** on the same client. Typical split:

- **Internal (Pi-hole users)**: `pms.hotelsatsangi.com` → LAN IP via Pi-hole + NPM HTTPS.
- **Remote**: different hostname or VPN.

---

## Troubleshooting

| Issue | Check |
|--------|--------|
| Pi-hole won’t start (port 53) | `DNSStubListener=no`, restart `systemd-resolved`, `ss -lunp \| grep 53` |
| NPM 80 in use | `sudo ss -ltnp \| grep ':80 '` — stop conflicting service |
| Let’s Encrypt DNS fails | Token has **DNS Edit** on correct zone; Cloudflare nameservers active for the zone |
| Clients don’t use Pi-hole | DHCP DNS = server IP; or static DNS on device |
