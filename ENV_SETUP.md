# Environment Setup (Development + Production)

This project uses two environments:
- Development: local `.env` files in each app.
- Production: environment variables configured in Vercel dashboards.

## Backend (`backend/`)

### Development
1. Create `backend/.env` from `backend/.env.example`.
2. Run `npm run dev` or `npm start`.
3. `backend/index.js` loads `backend/.env` when `NODE_ENV` is not `production`.

### Production (Vercel)
Set these in Vercel environment variables for the backend project:
- `PORT`
- `MONGODB_URI`
- `GOOGLE_CLIENT_ID`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `SESSION_TTL`
- `SESSION_COOKIE_NAME`
- `SESSION_COOKIE_MAX_AGE_MS`
- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_DOMAIN` (optional)

Notes:
- Do not commit production secrets.
- In production (`NODE_ENV=production`), backend does not rely on a local `.env` file.

## Frontend (`frontend/`)

### Development
1. Create `frontend/.env` from `frontend/.env.example`.
2. Set:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_API_PROXY_TARGET` (usually `http://localhost:5000`)
3. Run `npm run dev`.
4. Vite proxy forwards `/api/*` requests to `VITE_API_PROXY_TARGET`.

### Production (Vercel)
Set these in Vercel environment variables for the frontend project:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_API_BASE_URL` (your deployed backend URL)

Notes:
- In production builds, API calls use `VITE_API_BASE_URL`.
- If `VITE_API_BASE_URL` is not set, frontend falls back to relative `/api/*` paths.

## Security and Git Tracking
- Both apps ignore `.env*` except `.env.example`.
- Keep only example env files in git.
