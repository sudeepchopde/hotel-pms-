# Hotel Sathi PMS — Server Commands

## Service Status

```bash
# Check status of both services
sudo systemctl status hotel-pms-backend hotel-pms-frontend

# Check backend only
sudo systemctl status hotel-pms-backend

# Check frontend only
sudo systemctl status hotel-pms-frontend
```

## Start / Stop / Restart (systemd)

```bash
# Start both
sudo systemctl start hotel-pms-backend hotel-pms-frontend

# Stop both
sudo systemctl stop hotel-pms-backend hotel-pms-frontend

# Restart both
sudo systemctl restart hotel-pms-backend hotel-pms-frontend

# Enable auto-start on boot
sudo systemctl enable hotel-pms-backend hotel-pms-frontend

# Disable auto-start on boot
sudo systemctl disable hotel-pms-backend hotel-pms-frontend
```

## View Logs

```bash
# Live backend logs
journalctl -u hotel-pms-backend -f

# Live frontend logs
journalctl -u hotel-pms-frontend -f

# Last 50 lines of backend logs
journalctl -u hotel-pms-backend -n 50 --no-pager

# Last 50 lines of frontend logs
journalctl -u hotel-pms-frontend -n 50 --no-pager
```

## Manual Start (without systemd)

### Backend (FastAPI/Uvicorn)

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend (Vite Dev Server)

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22
cd "/home/satsangi/Hotel sathi/hotel-pms-"
npm run dev
```

### Frontend (Production Build)

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22
cd "/home/satsangi/Hotel sathi/hotel-pms-"
npm run build
```

## Access URLs

| From             | Frontend                      | Backend API                    |
|------------------|-------------------------------|--------------------------------|
| This machine     | http://localhost:3000          | http://localhost:8000          |
| Other computers  | http://192.168.31.58:3000     | http://192.168.31.58:8000     |
| API Docs         |                               | http://localhost:8000/docs     |

## Database

```bash
# Check PostgreSQL connection
cd "/home/satsangi/Hotel sathi/hotel-pms-"
python3 check_connection.py

# Open psql shell
psql "postgresql://pms_user:satsangi123@localhost:5432/pms_db"

# Import a SQL dump
psql "postgresql://pms_user:satsangi123@localhost:5432/pms_db" < dump_file.sql
```

## Firewall (if needed)

```bash
sudo ufw allow 3000
sudo ufw allow 8000
sudo ufw status
```

## Git Push

```bash
cd "/home/satsangi/Hotel sathi/hotel-pms-"
git add .

## Git Pull

cd "/home/satsangi/Hotel sathi/hotel-pms-"
git pull
git commit -m "your message"
git push origin main
```
