# FaceCheck-in

A facial-recognition attendance management system, built as a final-year major project. Members check in automatically at an organization's kiosk; admins get real-time attendance, analytics, and AI-generated insights.

## Features

- **Face-recognition attendance** — kiosk auto-detects and marks attendance for up to 5 faces per capture, no manual action needed.
- **Multi-org identity** — a single person can belong to multiple organizations under one email/login, reusing their facial enrollment across orgs (no re-enrolling).
- **Admin tools** — manage members and categories, per-member check-in time + grace period (late-entry tracking), organization branding (logo), CSV export, spoof-review flagging with evidence images.
- **Analytics dashboard** — date-filterable attendance trends, category breakdowns, flagged-match rates, late-entry stats, leaderboards, and an AI-generated (Gemini) plain-English summary broken into expandable sections.
- **Auth** — JWT access/refresh rotation, password reset via email (Brevo), kiosk devices authenticate with an org-scoped secret instead of a login.

## Architecture

Three independently deployable services:

```
┌─────────────┐        ┌──────────────┐        ┌───────────────────┐
│  frontend   │ ─────▶ │   backend    │ ─────▶ │    ml-service      │
│ React+Vite  │  REST  │ Node/Express │  REST  │  Python/FastAPI    │
│  (Vercel)   │        │  (Render)    │        │ (HF Spaces/Render) │
└─────────────┘        └──────┬───────┘        └────────────────────┘
                               │
                        ┌──────▼───────┐   ┌────────────┐   ┌────────────┐
                        │ MongoDB Atlas │   │ Cloudinary │   │   Brevo    │
                        └──────────────┘   └────────────┘   └────────────┘
```

- **frontend/** — React 19 + Vite + Tailwind v4. Handles UI and webcam/image capture only; no business logic.
- **backend/** — Express 5 + Mongoose 9. Owns all auth, business logic, and database reads/writes.
- **ml-service/** — Stateless FastAPI microservice. Pure image-in/embedding-out (RetinaFace detection + ArcFace 512-d embeddings via InsightFace's `buffalo_l` bundle); no database access. Cosine-similarity matching happens in the backend, not here.

## Repository structure

```
FaceCheck-in/
├── backend/          # Express API — deploy separately (Render/Railway/etc.)
├── frontend/         # React app — deploy separately (Vercel/Netlify/etc.)
├── ml-service/       # FastAPI ML microservice — deploy separately (HF Spaces/Render/etc.)
├── .gitignore
└── README.md         # this file
```

Each service has its own `package.json`/`requirements.txt` and is meant to be deployed independently — see [Deployment](#deployment) below.

## Tech stack

| Service | Stack |
|---|---|
| frontend | React 19, React Router 7, Axios, Vite, Tailwind CSS v4, Recharts |
| backend | Node.js, Express 5 (ESM), Mongoose 9, JWT, bcrypt, Multer, Cloudinary SDK, @getbrevo/brevo, Gemini API |
| ml-service | Python, FastAPI, Uvicorn, InsightFace, ONNX Runtime, OpenCV |
| Database | MongoDB (Atlas in production) |
| Email | Brevo (transactional: password reset, invites, set-password) |
| Media storage | Cloudinary (org logos, avatars, flagged-review images) |
| AI summaries | Google Gemini API |

## Local development

Prerequisites: Node.js 18+, Python 3.10+, a MongoDB instance (local or Atlas), and accounts for Cloudinary/Brevo/Gemini.

### 1. ml-service

```bash
cd ml-service
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. backend

```bash
cd backend
npm install
cp .env.example .env            
npm run dev                     
```

`backend/.env`:


- add your own env vars as given -
```
PORT=8080
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ML_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
BREVO_API_KEY=
SENDER_MAIL=                    # must be a Brevo-verified sender
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.0-flash   # optional, defaults shown
```

### 3. frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                     # runs on port 5173 by default
```

`frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

## Deployment

The three services deploy independently to different platforms. Since they all live in one GitHub repo, **each platform must be told to build from its own subfolder only** — otherwise a platform may try to build the whole monorepo (wrong dependencies, wrong start command) or one service's deploy could get triggered by an unrelated change in another service's folder.

Recommended split:

| Service | Suggested platform | Root/base directory setting |
|---|---|---|
| frontend | Vercel | Project → Settings → **Root Directory** → `frontend` |
| backend | Render (Web Service) | New Web Service → **Root Directory** → `backend` |
| ml-service | Hugging Face Spaces (Docker SDK) or Render | See note below |

**Vercel / Render:** both let you point a single project at a specific subdirectory of a monorepo (`Root Directory` on Vercel, `Root Directory` under Build settings on Render). Set the build/start commands relative to that subfolder (e.g. Render backend: build `npm install`, start `npm start`, root directory `backend`). Auto-deploy triggers only fire on changes within that subfolder, so pushing frontend changes won't redeploy the backend and vice versa.

**ml-service on Hugging Face Spaces:** Spaces expect a Dockerfile at the *root* of the Space's own git repo, and don't support pointing at a subfolder of an external monorepo the way Vercel/Render do. Two options:
1. Push `ml-service/` to its own separate GitHub repo (simplest), and connect that repo to the Space.
2. Keep everything in one repo and use `git subtree split` to push just the `ml-service/` subtree to the Space's remote whenever it changes:
   ```bash
   git subtree push --prefix ml-service space main
   ```
   (`space` here is a git remote pointing at your HF Space's git URL.)

If you deploy ml-service to Render instead, the same "Root Directory: ml-service" approach as the backend works and you can skip the subtree step entirely.

**Env vars:** none of the three `.env` files are committed (see `.gitignore`). Add each service's variables directly in its hosting platform's dashboard, using production values (production `MONGODB_URI`, the deployed `ML_SERVICE_URL`/`CLIENT_URL`/`VITE_API_BASE_URL` instead of `localhost`, etc.).

**Cookies/CORS for cross-origin production:** since frontend and backend will be on different domains in production, update:
- Backend CORS origin → the deployed frontend URL (not `*`)
- Refresh-token cookie options → `sameSite: "none", secure: true`

## Access model

| Action | Who | Auth |
|---|---|---|
| Enroll face / manage own avatar | Member or Admin | Personal JWT |
| Mark attendance (primary) | Anyone at the kiosk | Org kiosk secret (headers, no login) |
| Mark attendance (fallback) | Admin only | Personal JWT + admin role |
| View/export attendance, manage members/org/logo | Admin only | Personal JWT + admin role |

## License

Academic project — no license specified.