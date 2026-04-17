# Complete setup: Pi-hole (LAN DNS) + NPM (HTTPS) + Cloudflare Tunnel (remote)

This is the **full checklist** for running the Hotel PMS with:

- **LAN:** Pi-hole resolves `pms.hotelsatsangi.com` → server IP → **Nginx Proxy Manager** → app  
- **Remote:** **Cloudflare Tunnel** → same hostname → app on `localhost`

Parts that only **you** can do in a browser (Cloudflare, NPM, router) are marked **[Manual]**.

---

## A. One-time: server prep

### A1. Free port 53 for Pi-hole

Follow **`SETUP_PIHOLE_NPM.md` §1** — set **`DNSStubListener=no`**, restart **`systemd-resolved`**, fix **`/etc/resolv.conf`**.

### A2. Free ports 80 / 443 for NPM

Stop system nginx if it still holds **80**:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### A3. Docker stack

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-/infra"
cp -n .env.example .env
nano .env
```

Set at least:

- **`PIHOLE_LOCAL_IPV4`** = your LAN IP (e.g. `192.168.31.90` from `hostname -I`)
- **`PIHOLE_WEBPASSWORD`** = strong password

```bash
docker compose up -d
./verify-stack.sh
```

---

## B. Pi-hole **[Manual]**

1. Open **`http://<SERVER_LAN_IP>:8080/admin`**
2. **Local DNS → DNS Records** (or **Local DNS Records**)
3. Add:
   - **Domain:** `pms.hotelsatsangi.com`
   - **IP:** `<SERVER_LAN_IP>` (same as `PIHOLE_LOCAL_IPV4`)

4. Optional — point **this server** at Pi-hole:

   ```bash
   echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
   ```

   (Or set DNS `127.0.0.1` in NetworkManager/netplan so it survives reboot.)

---

## C. PMS app on the host (must be running)

Your FastAPI app should listen on **`0.0.0.0:8000`** (e.g. systemd **`hotel-pms-backend`** or `python3 main.py`).

Check:

```bash
ss -ltnp | grep ':8000'
```

NPM will forward to **`host.docker.internal:8000`** (already in `docker-compose.yml`).

---

## D. Nginx Proxy Manager **[Manual]**

1. Open **`http://<SERVER_LAN_IP>:81`**
2. First login: change default email/password when prompted.
3. **Hosts → Proxy Hosts → Add Proxy Host**
   - **Domain names:** `pms.hotelsatsangi.com`
   - **Scheme:** `http`
   - **Forward hostname / IP:** `host.docker.internal`
   - **Forward port:** `8000`
   - **Block Common Exploits:** on  
   - **Websockets Support:** on (if your app uses WS)
4. **Save**
5. **SSL** tab on the same host:
   - **SSL Certificate:** Request a new certificate with Let’s Encrypt
   - **Force SSL:** on
   - **HTTP/2 Support:** on  
   - **Use a DNS Challenge** → provider **Cloudflare**
   - **Credentials:** API token with **Zone → DNS → Edit** (and **Zone → Read**) on `hotelsatsangi.com`
   - Agree to Let’s Encrypt ToS → **Save**

After issuance, open **`https://pms.hotelsatsangi.com`** from a PC that uses **Pi-hole** as DNS.

---

## E. Cloudflare Tunnel (remote access) **[Manual]**

1. **Zero Trust** → **Networks** → **Tunnels** → your tunnel (e.g. `hotel-pms`).
2. **Public hostname** (Published application):
   - **Subdomain:** `pms`
   - **Domain:** `hotelsatsangi.com`
   - **Service:** **`http://localhost:80`** if something listens on host **80**, **or** **`http://localhost:8000`** if only FastAPI (no host nginx).

   **Critical:** use **`http://`**, not **`https://`**, for local HTTP services.

3. **Install connector** on this server (if not already):

   ```bash
   sudo cloudflared service install <TOKEN_FROM_DASHBOARD>
   sudo systemctl enable --now cloudflared
   ```

4. **Public DNS (Cloudflare zone):** the tunnel should create a **CNAME** for `pms` → `*.cfargotunnel.com`.  
   **Do not** add a conflicting **A** record for `pms` in Cloudflare pointing at your home IP if you use tunnel for public DNS.

5. **Split DNS:**
   - **Internet / phones on mobile data:** use **Cloudflare** public DNS → tunnel.
   - **Hotel LAN with Pi-hole:** Pi-hole returns **LAN IP** → **NPM** (steps B + D).

---

## F. Router **[Manual]**

- **DHCP → DNS server:** `<SERVER_LAN_IP>` (Pi-hole).
- Reconnect Wi‑Fi on devices so they pick up Pi-hole.

---

## G. Verification

On the server:

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-/infra"
./verify-stack.sh
```

On a **LAN** PC using Pi-hole:

```bash
nslookup pms.hotelsatsangi.com
curl -sI --connect-timeout 10 https://pms.hotelsatsangi.com/
```

On **mobile data** (tunnel):

```bash
curl -sI --connect-timeout 15 https://pms.hotelsatsangi.com/
```

---

## H. Conflicts to avoid

| Issue | Fix |
|--------|-----|
| **Port 80 in use** | Stop **system nginx**; only **NPM** should bind **80/443** on the host. |
| **Port 53 in use** | **`DNSStubListener=no`** (see **SETUP_PIHOLE_NPM.md**). |
| **Tunnel TLS error** | Tunnel service must be **`http://localhost:PORT`**, not `https://` to plain HTTP. |
| **NPM can’t reach app** | App on **`0.0.0.0:8000`**; NPM forward **`host.docker.internal:8000`**. |

---

## I. What cannot be automated from the repo

- Creating **Cloudflare API tokens** and pasting them into **NPM** and **Tunnel** UI  
- **Router DHCP** DNS  
- **First-time** NPM / Pi-hole **password** changes  

Use this runbook in order: **A → B → C → D → E → F → G**.
