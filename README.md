# Ayesha...💗

A private, premium cloud gallery and media backup app — built to feel like a boutique
product and store every photo and video safely on Cloudinary.

This is a personal / family-use application. It is not intended for public,
multi-tenant deployment.

---

## 1. What's inside

- **Frontend** — React 18 + Vite + Tailwind CSS. Dark glassmorphism UI, animated
  loading screen, responsive mobile-first gallery with infinite scroll and search.
- **Backend** — Node.js + Express REST API. JWT authentication in httpOnly cookies,
  role-based access control, rate limiting, input validation, audit logging.
- **Database** — PostgreSQL via `pg`. Works with any hosted Postgres (Neon, Render,
  Supabase, a VPS, etc.) so your data survives host restarts/redeploys — a local
  file would not, since most free Node hosts wipe local disk on every restart.
- **Storage** — Cloudinary holds every photo, video, and diary voice note. Uploads
  go straight from the browser to Cloudinary; nothing binary passes through the
  backend, and nothing is written to local disk.

```
ayesha-app/
├── backend/
│   ├── src/
│   │   ├── config/         # db.js (Postgres), cloudinary.js
│   │   ├── controllers/    # auth, users, media, stats, keys, diary
│   │   ├── middleware/     # auth, csrf, rateLimiter, validate, errorHandler
│   │   ├── routes/         # auth, users, media, stats, audit, keys, diary
│   │   ├── db/              # seed.js (standalone schema/seed runner)
│   │   ├── utils/          # tokens, audit logger
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Login, Home, Gallery, Diary, Songs, Dashboard, Users, Keys, Settings
│   │   ├── components/      # Navbar, UploadModal, MediaCard, Lightbox, StorageRing, DiaryEditor…
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
| `Ayesha` | `mangomango` |

This account is created automatically the first time the backend starts (seeded
into the database). **Change the password immediately** from Settings after your
first login, or set `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` in
`backend/.env` before the very first run.

> If you already have a running deployment (a database that was seeded before
> this update), the new default password only applies to a **fresh** database —
> it will not retroactively change an existing admin account's password. Log in
> with the old password and change it from **Settings** instead.

---

## 3. Prerequisites

- A [Cloudinary](https://cloudinary.com) account (the free tier is enough to start).
  You'll need your **Cloud Name**, **API Key**, and **API Secret** from the
  Cloudinary dashboard.
- A PostgreSQL database. Any free hosted Postgres works well — e.g.
  [Neon](https://neon.tech) or [Supabase](https://supabase.com) — or your own
  Postgres instance. You'll need its connection string.
- Node.js 18+.

---

## 4. Local setup

Two processes: the backend API and the Vite dev server for the frontend.

### 4.1 Backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, and the CLOUDINARY_* values, then save.
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

Leave this running.

### 4.2 Frontend (second terminal)

```bash
cd frontend
cp .env.example .env
# .env already points to http://localhost:5000/api, which is correct for local use.
npm install
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open it in your
browser and log in with the default administrator credentials above.

---

## 5. Production build (single server)

For everyday personal use you can build the frontend once and have the Express
backend serve the static files — only one process to run.

```bash
# 1. Build the frontend
cd frontend
npm install
npm run build          # outputs frontend/dist

# 2. Point the backend at the built frontend
cd ../backend
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
| `NODE_ENV` | `development` or `production`. Only set `production` once both frontend and backend are deployed over HTTPS — the session cookie is marked `Secure` and `SameSite=None` in that mode, which browsers refuse to send over plain `http://localhost`. |
| `CLIENT_URL` | Exact origin of the frontend (used for CORS + CSRF origin check) |
| `JWT_SECRET` | Long random string — the signing key for session tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `2h` |
| `INACTIVITY_LOGOUT_MINUTES` | Frontend auto-logout timer |
| `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` | Seeded on first run only |
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://user:password@host/dbname?sslmode=require` |
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
- **JWT sessions** in httpOnly cookies — inaccessible to client-side JavaScript.
  `SameSite=None; Secure` in production (required for a cross-origin frontend/backend
  deployment over HTTPS), `SameSite=Lax` in local development.
- **CSRF protection** — exact-origin verification on every state-changing request
  (comparing scheme+host+port, not a string prefix), layered with the cookie policy
  above and a custom `X-Requested-With` header from the frontend.
- **XSS protection** — React's automatic escaping on the frontend, `helmet` HTTP
  headers, and `express-validator` sanitization on the backend.
- **Rate limiting** — tighter limits on `/api/auth/login` and `/api/auth/key-login`,
  general limits across the API, a separate bucket for uploads.
- **Protected routes** — every media/user/stats/diary endpoint requires a valid
  session; admin-only actions are additionally role-checked server-side (never trust
  the UI alone).
- **Input validation** — `express-validator` on every mutating endpoint.
- **Audit logs** — logins, logouts, uploads, deletes, edits, and user/key management
  actions are all recorded with timestamp, actor, and IP, visible on the admin
  dashboard.
- **Automatic inactivity logout** — the frontend clears the session after a
  configurable idle period, and the app never auto-restores a session on reload —
  every fresh page load requires logging in again.
- **Direct-to-Cloudinary uploads** — the backend only issues a short-lived, scoped
  upload signature and re-verifies the resulting asset with Cloudinary's Admin API
  before writing a database row; it never trusts client-supplied file metadata and
  never buffers file bytes itself.

---

## 8. Deploying off-device (optional)

1. **Backend** → any Node host that supports a persistent process (Render, Railway,
   a small VPS). Set all the environment variables from §6 in the host's dashboard,
   pointing `DATABASE_URL` at your hosted Postgres instance.
2. **Frontend** → any static host (Vercel, Netlify, Cloudflare Pages, or the
   backend's own Express static serving from §5). Set `VITE_API_URL` to your
   deployed backend's public URL.
3. Update `CLIENT_URL` in the backend's environment to the deployed frontend's
   exact origin (including `https://`) so CORS and CSRF checks pass.
4. Set `NODE_ENV=production` and ensure both frontend and backend are served over
   **HTTPS** — the session cookie is marked `Secure` when `NODE_ENV=production`, so
   it will only be sent over HTTPS.

---

## 9. API reference (summary)

All routes are prefixed with `/api`.

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Log in, sets session cookie |
| POST | `/auth/logout` | Authenticated | Clears session |
| POST | `/auth/clear-session` | Public | Clears any leftover session cookie (used on every fresh app load) |
| GET | `/auth/me` | Authenticated | Current user |
| POST | `/auth/change-password` | Authenticated | Change own password |
| POST | `/auth/key-login` | Public | Log in with a generated access key (view-only session) |
| GET | `/users` | Admin | List users |
| POST | `/users` | Admin | Create user |
| PUT | `/users/:id` | Admin | Edit user |
| DELETE | `/users/:id` | Admin | Delete user |
| GET | `/media` | Authenticated | List media (`type`, `search`, `sort`, `page`, `limit`) |
| POST | `/media/upload-signature` | Admin | Get a signed Cloudinary upload URL |
| POST | `/media/confirm` | Admin | Confirm an upload and write its DB row |
| GET | `/media/:id/download` | Admin | Get a signed download URL |
| DELETE | `/media/:id` | Admin | Delete a file |
| GET | `/diary` | Admin | List diary entries (`search`, `page`, `limit`) |
| GET | `/diary/:id` | Admin | Get a single diary entry |
| POST | `/diary` | Admin | Create a diary entry |
| PUT | `/diary/:id` | Admin | Edit a diary entry |
| DELETE | `/diary/:id` | Admin | Delete a diary entry |
| POST | `/diary/voice-upload-signature` | Admin | Get a signed Cloudinary upload URL for a voice note |
| GET | `/songs` | Admin | List songs & voice recordings (`kind`, `search`) |
| POST | `/songs/upload-signature` | Admin | Get a signed Cloudinary upload URL for a song/voice |
| POST | `/songs/confirm` | Admin | Confirm an upload and write its DB row |
| PUT | `/songs/:id` | Admin | Rename a song/voice recording |
| DELETE | `/songs/:id` | Admin | Delete a song/voice recording |
| GET | `/stats` | Admin | Dashboard storage & file statistics |
| GET | `/audit` | Admin | Recent audit log entries |
| GET | `/keys` | Admin | List generated access keys with live status |
| POST | `/keys` | Admin | Generate a new access key (`durationType`: `one_time`, `1_hour`, `1_day`, `1_week`, `1_month`) |
| DELETE | `/keys/:id` | Admin | Delete/revoke an access key |

---

## 10. Key Generator (view-only access keys)

From **Dashboard → Key Generator** (or the profile menu), the administrator can
generate a secure random key with one of five lifespans: **One Time**, **1
Hour**, **1 Day**, **1 Week**, or **1 Month**. Anyone with a valid key can sign
in from the "Access Key" tab on the login screen to get a **view-only**
session — they can browse Photos and Videos, but cannot upload, delete,
download, generate keys, reach the admin dashboard, or see the Diary.

Each key shows its creation time, expiration time, a live remaining-time
countdown, and its status (Active / Used / Expired / Revoked). A One Time key
stops working as soon as it's used once; timed keys stop working the moment
they expire — this is enforced on the server on every request, not just at
login, so a key deleted or expired by the admin invalidates any session
using it immediately.

---

## 11. Diary (admin only)

A private, dated diary separate from the photo/video gallery — accessible only to
administrator accounts (key-user sessions never see it). Each entry has a title,
free-text content, a date, a customizable tag color and text color, and an optional
voice note recorded directly in the browser and uploaded straight to Cloudinary in
its own subfolder, so it never mixes into the gallery's photo/video counts or
storage stats shown elsewhere. Voice notes are recorded with noise cancellation
(see §12) so they sound clear.

---

## 12. Songs (admin only)

A private music/voice space, separate from the gallery and diary — also
administrator-only. From **Home → Songs** (or the profile menu) you can:

- **Upload songs from your phone.** Pick one or more audio files; each is
  uploaded straight to Cloudinary (same direct-to-storage pattern as photos/
  videos), and the file name it was saved under on your phone is kept as its
  name (you can rename it afterward).
- **Record your own voice.** Recordings go through a noise-cancellation
  pipeline before they're saved: the microphone stream requests the browser's
  own noise suppression / echo cancellation / auto-gain, and is additionally
  routed through a high-pass filter (cuts low rumble/handling noise) and a
  dynamics compressor (evens out volume) — so the *saved* file is the cleaned
  signal, not the raw mic input. The same pipeline is used for diary voice
  notes.
- **Rename** any song or voice recording with a clearly labeled ✏️ button.
- **Play** any track — a mini player appears at the bottom of every page (not
  just the Songs page) so it keeps playing while you browse Photos, Videos,
  or the Diary.
- **Background play.** Each time you start playing a track, background play
  starts *off*: if you switch away from the tab/app, playback pauses, and
  resumes automatically when you come back. Tapping "Background play" in the
  mini player turns it *on* for the current track, so it keeps playing even
  while the tab/app is in the background. Either way, fully closing the
  tab/app stops playback.

---

Made with 💗 for Ayesha.
