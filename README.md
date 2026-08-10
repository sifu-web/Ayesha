# Ayesha...💗

A private, premium cloud gallery and media backup app — built to feel like a boutique
product, run entirely from a phone, and store every photo and video safely on
Cloudinary.

This is a personal / family-use application. It is not intended for public,
multi-tenant deployment.

---

## 1. What's inside

- **Frontend** — React 18 + Vite + Tailwind CSS. Dark glassmorphism UI, animated
  loading screen, responsive mobile-first gallery with infinite scroll and search.
- **Backend** — Node.js + Express REST API. JWT authentication in httpOnly cookies,
  role-based access control, rate limiting, input validation, audit logging.
- **Database** — SQLite via `better-sqlite3` (a single file, zero server process —
  ideal for Termux). Can be swapped for PostgreSQL later without touching the API
  contract (see §8).
- **Storage** — Cloudinary holds every photo and video. Nothing binary ever touches
  the phone's disk once uploaded.

```
ayesha-app/
├── backend/
│   ├── src/
│   │   ├── config/         # db.js, cloudinary.js
│   │   ├── controllers/    # auth, users, media, stats
│   │   ├── middleware/     # auth, csrf, rateLimiter, validate, errorHandler
│   │   ├── routes/         # auth, users, media, stats, audit
│   │   ├── utils/          # tokens, audit logger
│   │   └── server.js
│   ├── data/                # ayesha.db lives here (auto-created)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Login, Home, Gallery, Dashboard, Users, Settings
│   │   ├── components/      # Navbar, UploadModal, MediaCard, Lightbox, StorageRing…
│   │   ├── context/         # AuthContext (session + inactivity auto-logout)
│   │   ├── api/axios.js
│   │   └── styles/index.css
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## 2. Default administrator account

| Username | Password |
|----------|----------|
| `Ayesha` | `143`    |

This account is created automatically the first time the backend starts (seeded
into SQLite). **Change the password immediately** from Settings after your first
login, or edit `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` in `backend/.env`
before the very first run.

---

## 3. Prerequisites

- A [Cloudinary](https://cloudinary.com) account (the free tier is enough to start).
  You'll need your **Cloud Name**, **API Key**, and **API Secret** from the
  Cloudinary dashboard.
- Node.js 18+ (Termux instructions below install this for you).

---

## 4. Running entirely on Android with Termux

No PC required. Every command below is typed directly into Termux.

### 4.1 Install Termux prerequisites

```bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git python build-essential
termux-setup-storage
```

`build-essential`/`python` are required so `better-sqlite3` can compile its native
binding on-device.

### 4.2 Get the project onto your phone

If you received this project as a zip, extract it into your Termux home:

```bash
cd ~
# unzip ayesha-app.zip   (if it's a zip you copied in)
cd ayesha-app
```

Or, if it's in a git repository:

```bash
git clone <your-repo-url> ayesha-app
cd ayesha-app
```

### 4.3 Backend setup

```bash
cd ~/ayesha-app/backend
cp .env.example .env
nano .env     # fill in CLOUDINARY_* values and a strong JWT_SECRET, then Ctrl+O, Enter, Ctrl+X
npm install
npm start
```

You should see:

```
✔ Default administrator account created: Ayesha
  ╭──────────────────────────────────────────╮
  │        Ayesha...💗  — API Server          │
  │  Running on http://localhost:5000          │
  ╰──────────────────────────────────────────╯
```

Leave this running. Open a **second Termux session** (swipe from the left edge of
the Termux app → "New session") for the frontend.

### 4.4 Frontend setup (second Termux session)

```bash
cd ~/ayesha-app/frontend
cp .env.example .env
# .env already points to http://localhost:5000/api which is correct for on-device use
npm install
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open it in Chrome
on the same phone. Log in with the default administrator credentials above.

### 4.5 Keeping it running in the background

To stop Android from killing Termux while the servers run:

```bash
termux-wake-lock
```

To run both processes without juggling two sessions, use `tmux`:

```bash
pkg install -y tmux
tmux new -s ayesha
# inside tmux: Ctrl+B then " to split, run backend in one pane, frontend in the other
# Ctrl+B then D to detach and keep it running in the background
```

---

## 5. Production build (single server, one Termux session)

For everyday personal use you can build the frontend once and have the Express
backend serve the static files — only one process to keep alive.

```bash
# 1. Build the frontend
cd ~/ayesha-app/frontend
npm install
npm run build          # outputs frontend/dist

# 2. Point the backend at the built frontend
cd ~/ayesha-app/backend
npm install
npm start
```

The backend already serves the API under `/api`. To also serve the built frontend
from the same process, add this near the bottom of `backend/src/server.js` (above
`app.use(notFound)`), then rebuild:

```js
const path = require('path');
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
```

Then just run `npm start` in `backend/` and visit `http://localhost:5000`.

---

## 6. Environment variables reference

### backend/.env

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `NODE_ENV` | `development` or `production` |
| `CLIENT_URL` | Exact origin of the frontend (used for CORS + CSRF origin check) |
| `JWT_SECRET` | Long random string — the signing key for session tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `2h` |
| `INACTIVITY_LOGOUT_MINUTES` | Frontend auto-logout timer |
| `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` | Seeded on first run only |
| `DATABASE_PATH` | Path to the SQLite file |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | From your Cloudinary dashboard |
| `CLOUDINARY_FOLDER` | Folder name inside Cloudinary to keep uploads organized |
| `CLOUDINARY_PLAN_STORAGE_BYTES` | Your plan's total storage, used for the dashboard's "Total/Available Storage" figures |

### frontend/.env

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API, e.g. `http://localhost:5000/api` |

---

## 7. Security features

- **Password hashing** — bcrypt, 12 salt rounds.
- **JWT sessions** in httpOnly, `SameSite=Strict` cookies — inaccessible to
  client-side JavaScript, not sent cross-site.
- **CSRF protection** — origin/referer verification on every state-changing
  request, layered with `SameSite=Strict` cookies.
- **XSS protection** — React's automatic escaping on the frontend, `helmet` HTTP
  headers, and `express-validator` sanitization on the backend.
- **Rate limiting** — tighter limits on `/api/auth/login`, general limits across
  the API, separate bucket for uploads.
- **Protected routes** — every media/user/stats endpoint requires a valid session;
  admin-only actions are additionally role-checked server-side (never trust the
  UI alone).
- **Input validation** — `express-validator` on every mutating endpoint.
- **Audit logs** — logins, logouts, uploads, deletes, and user management actions
  are all recorded with timestamp, actor, and IP, visible on the admin dashboard.
- **Automatic inactivity logout** — the frontend clears the session after a
  configurable idle period.

---

## 8. Switching to PostgreSQL later

The app ships with SQLite because it needs zero setup on a phone. If you later
deploy to a host with PostgreSQL available, replace `backend/src/config/db.js`
with a `pg` connection pool and translate the `CREATE TABLE` statements (the
schema in that file is intentionally plain, standard SQL — no SQLite-only syntax
beyond `AUTOINCREMENT`, which maps directly to Postgres `SERIAL`/`IDENTITY`).
Controllers use plain parameterized SQL strings, so the swap is mechanical.

---

## 9. Deploying off-device (optional)

Once you're happy running it locally, you can host it permanently:

1. **Backend** → any Node host that supports a persistent process and disk for
   SQLite (Render, Railway, a small VPS). Set all the environment variables from
   §6 in the host's dashboard. If your host's filesystem is ephemeral, point
   `DATABASE_PATH` at a mounted persistent volume, or migrate to PostgreSQL (§8).
2. **Frontend** → any static host (Vercel, Netlify, Cloudflare Pages, or the
   backend's own Express static serving from §5). Set `VITE_API_URL` to your
   deployed backend's public URL.
3. Update `CLIENT_URL` in the backend's environment to the deployed frontend's
   exact origin (including `https://`) so CORS and CSRF checks pass.
4. Ensure both frontend and backend are served over **HTTPS** in production —
   the session cookie is marked `secure` when `NODE_ENV=production`, so it will
   only be sent over HTTPS.

---

## 10. API reference (summary)

All routes are prefixed with `/api`.

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Log in, sets session cookie |
| POST | `/auth/logout` | Authenticated | Clears session |
| GET | `/auth/me` | Authenticated | Current user |
| POST | `/auth/change-password` | Authenticated | Change own password |
| GET | `/users` | Admin | List users |
| POST | `/users` | Admin | Create user |
| PUT | `/users/:id` | Admin | Edit user |
| DELETE | `/users/:id` | Admin | Delete user |
| GET | `/media` | Authenticated | List media (`type`, `search`, `sort`, `page`, `limit`) |
| POST | `/media/upload` | Admin | Upload up to 100 files (`files`, `quality`) |
| GET | `/media/:id/download` | Authenticated | Get a signed download URL |
| DELETE | `/media/:id` | Admin | Delete a file |
| GET | `/stats` | Admin | Dashboard storage & file statistics |
| GET | `/audit` | Admin | Recent audit log entries |
| POST | `/auth/key-login` | Public | Log in with a generated access key (view-only session) |
| GET | `/keys` | Admin | List generated access keys with live status |
| POST | `/keys` | Admin | Generate a new access key (`durationType`: `one_time`, `1_hour`, `1_day`, `1_week`, `1_month`) |
| DELETE | `/keys/:id` | Admin | Delete/revoke an access key |

---

## 11. Key Generator (view-only access keys)

From **Dashboard → Key Generator** (or the profile menu), the administrator can
generate a secure random key with one of five lifespans: **One Time**, **1
Hour**, **1 Day**, **1 Week**, or **1 Month**. Anyone with a valid key can sign
in from the "Access Key" tab on the login screen to get a **view-only**
session — they can browse Photos and Videos, but cannot upload, delete,
download, generate keys, or reach the admin dashboard.

Each key shows its creation time, expiration time, a live remaining-time
countdown, and its status (Active / Used / Expired / Revoked). A One Time key
stops working as soon as it's used once; timed keys stop working the moment
they expire — this is enforced on the server on every request, not just at
login, so a key deleted or expired by the admin invalidates any session
using it immediately.

---

Made with 💗 for Ayesha.
