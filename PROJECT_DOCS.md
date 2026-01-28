# SyncGuard PMS - Project Documentation

## Overview
Hotel Property Management System (PMS) with real-time booking management, guest profiles, compliance forms, and notification center.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Neon) |
| Hosting | Vercel (frontend) |
| Icons | Lucide React |

---

## Database Configuration

### Local Development
```bash
# In .env.local (not committed to git)
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

### Vercel/Production
- Database: **Neon PostgreSQL** (serverless)
- Connection URL is set in Vercel environment variables
- SSL required (`sslmode=require`)

### Database Models (`backend/db_models.py`)
| Model | Table | Purpose |
|-------|-------|---------|
| `PropertySettingsDB` | property_settings | Hotel name, address, GST, API keys |
| `RoomTypeDB` | room_types | Room categories with pricing |
| `BookingDB` | bookings | Reservations with guest details |
| `GuestProfileDB` | guest_profiles | Returning guest information |
| `NotificationDB` | notifications | System notifications |

---

## Project Structure

```
pms/
├── App.tsx                 # Main app with navigation
├── api.ts                  # Frontend API functions
├── types.ts                # TypeScript interfaces
├── main.py                 # FastAPI backend (root)
├── components/
│   ├── FrontDeskView.tsx   # Room grid calendar view
│   ├── GuestProfilePage.tsx # Guest details & folio
│   ├── NewBookingModal.tsx # Create/edit bookings
│   ├── NotificationsPanel.tsx # Bell icon panel
│   ├── PropertySetupPage.tsx # Hotel settings
│   └── ...
├── backend/
│   ├── database.py         # SQLAlchemy connection
│   ├── db_models.py        # Database models
│   ├── models.py           # Pydantic schemas
│   ├── billing_utils.py    # PDF invoice generation
│   └── init_db.py          # Table creation
└── Billing/                # Generated PDFs stored here
```

---

## Key API Endpoints (main.py)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/PUT | `/api/property` | Hotel settings |
| GET/POST | `/api/bookings` | List/create bookings |
| PUT | `/api/bookings/{id}` | Update booking (triggers notifications) |
| GET/POST | `/api/notifications` | Notification CRUD |
| GET | `/api/room-types` | Room categories |
| POST | `/api/checkout/{id}` | Generate invoice/receipt |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | Optional | AI features (OCR, document scanning) |
| `VITE_GEMINI_API_KEY` | Optional | Frontend AI access |

---

## Running Locally

```bash
# Install frontend dependencies
npm install

# Start frontend dev server (http://localhost:5173)
npm run dev

# In another terminal, start backend (http://localhost:8000)
cd backend
pip install -r requirements.txt  # First time only
python -m uvicorn main:app --reload --port 8000
```

---

## Deployment (Vercel)

1. Push to `main` branch → auto-deploys
2. Environment variables configured in Vercel dashboard
3. Backend runs as Python serverless function
4. Database: Neon PostgreSQL (free tier)

GitHub Repo: `sudeepchopde/hotel-pms-`

---

## Key Features

### 1. Front Desk View
- Room grid with drag-and-drop
- Status colors: Available (gray), Booked (blue), CheckedIn (green), etc.
- Calendar navigation

### 2. Guest Profile
- Personal details, ID documents
- Folio (charges), Payments
- Co-guests (accessory guests)
- Form B/C compliance

### 3. Notifications Center
- Bell icon in sidebar with unread badge
- Auto-triggers: New booking, Check-in, Check-out, Cancellation
- Filter tabs: All, Reservations, Check-In/Out, Payments, System

### 4. Billing
- PDF invoice/receipt generation (`backend/billing_utils.py`)
- GST calculation (different rates for room, food, other)
- Stored in `Billing/` folder

---

## Common Patterns

### Adding a new API endpoint
1. Add Pydantic model in `backend/models.py`
2. Add DB model in `backend/db_models.py` (if needed)
3. Add endpoint in `main.py`
4. Add frontend function in `api.ts`
5. Add TypeScript type in `types.ts`

### Adding a new component
1. Create `components/MyComponent.tsx`
2. Import in `App.tsx`
3. Add navigation item if needed (in `DEFAULT_NAV_ITEMS`)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection error | Check `DATABASE_URL` in `.env.local` |
| Port 8000 in use | Kill existing Python process or change port |
| Build fails | Run `npm run build` to see TypeScript errors |
| Vercel deploy fails | Check Vercel logs, ensure env vars are set |

---

*Last updated: 2026-01-28*
