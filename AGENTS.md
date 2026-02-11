# Repository Guidelines

## Project Structure & Module Organization
This repository is split into two apps:
- `backend/`: Express + MongoDB API (entrypoint: `backend/index.js`), with route logic in `index.js`, auth middleware in `backend/middleware/`, data models in `backend/models/`, and shared helpers in `backend/utils/`.
- `frontend/`: React + Vite client (entrypoint: `frontend/src/main.jsx`), with pages in `frontend/src/pages/`, reusable UI/auth guards in `frontend/src/components/`, auth state in `frontend/src/context/`, and HTTP helpers in `frontend/src/services/`.
- `Knowledge/`: reference images used for context.

## Build, Test, and Development Commands
Run commands from each app directory.
- Backend:
  - `npm install`: install API dependencies.
  - `npm run dev`: start API with `nodemon` (default `http://localhost:5000`).
  - `npm start`: run API with Node for production-like local checks.
- Frontend:
  - `npm install`: install UI dependencies.
  - `npm run dev`: start Vite dev server (default `http://localhost:5173`).
  - `npm run build`: create production bundle in `frontend/dist/`.
  - `npm run preview`: serve the production build locally.
  - `npm run lint`: run ESLint across frontend files.

## Coding Style & Naming Conventions
- Follow existing style per package:
  - `backend/`: CommonJS (`require/module.exports`), semicolons, 2-space indent.
  - `frontend/`: ESM + React function components, no semicolons, 2-space indent.
- Naming:
  - React components/pages: `PascalCase` files (example: `SalesmanPage.jsx`).
  - Utilities/services/hooks: `camelCase` exports (example: `apiFetch`, `useAuth`).
  - Keep model names singular and `PascalCase` (example: `User.js`).

## Testing Guidelines
Automated tests are not configured yet (`backend` test script is a placeholder). For new features:
- Add frontend tests near source as `*.test.jsx` or under `frontend/src/__tests__/`.
- Add backend tests as `*.test.js` under `backend/` (for routes, auth, and model validation).
- At minimum, run `frontend/npm run lint`, `frontend/npm run build`, and a manual API + UI smoke test before opening a PR.

## Commit & Pull Request Guidelines
- Current history is short (`init project`, `feat: phase 1`, `phase 2`); use clear, imperative messages and prefer Conventional Commit prefixes (for example, `feat: add admin status filters`, `fix: validate planning rows`).
- PRs should include:
  - What changed and why.
  - Any environment or schema changes.
  - Screenshots/GIFs for UI changes (`/login`, `/salesman`, `/admin` flows).
  - Linked issue/task ID when available.

## Security & Configuration Tips
- Copy `.env.example` in both `backend/` and `frontend/` to local `.env`.
- Never commit `.env` or secrets (`JWT_SECRET`, OAuth credentials, DB URI).
- Keep `CORS_ORIGIN` and cookie settings aligned between local and deployed environments.
