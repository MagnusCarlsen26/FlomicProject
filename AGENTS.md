# Repository Guidelines

## Project Structure & Module Organization
This repo is split into two apps:
- `backend/`: Express + MongoDB API (`index.js`, `models/`, `middleware/`, `utils/`, `scripts/`).
- `frontend/`: Vite + React client (`src/pages/`, `src/components/`, `src/context/`, `src/services/`, `src/constants/`).
- `ENV_SETUP.md`: environment-variable setup for local and Vercel deployments.

Keep shared behavior close to where it is used. Backend utility tests live in `backend/utils/*.test.js`.

## Build, Test, and Development Commands
Run commands from each app directory.

- Backend:
  - `cd backend && npm install`
  - `npm run dev` to start with `nodemon`.
  - `npm start` for production-style local run.
  - `npm test` to run Node test runner (`node --test`).
- Frontend:
  - `cd frontend && npm install`
  - `npm run dev` to start Vite with HMR.
  - `npm run build` to generate `frontend/dist/`.
  - `npm run preview` to preview production build.
  - `npm run lint` to run ESLint.

## Coding Style & Naming Conventions
- Use 2-space indentation in JS/JSX files.
- Backend uses CommonJS (`require`/`module.exports`); frontend uses ES modules.
- Naming:
  - `PascalCase` for React components and Mongoose model files (for example, `WeeklyReport.js`).
  - `camelCase` for functions/variables (`adminInsights`, `weekKey`).
  - Hook files start with `use` (for example, `useAuth.jsx`).
- Follow `frontend/eslint.config.js`; run lint before opening a PR.

## Testing Guidelines
- Backend: write tests with `node:test` + `node:assert/strict`, colocated as `*.test.js` beside utilities.
- Frontend: no automated tests configured yet; at minimum run `npm run lint` and manually verify changed flows in `npm run dev`.
- Focus tests on behavior (status transitions, report-row normalization, auth/session logic).

## Commit & Pull Request Guidelines
Recent history favors short conventional prefixes (`feat:`, `fix:`, `deploy:`). Prefer:
- `feat: add admin status filter`
- `fix: validate planning row payload`

For PRs, include:
- What changed and why.
- Linked issue/task (if any).
- Verification steps run (`backend: npm test`, `frontend: npm run lint`).
- Screenshots/video for UI changes.

## Security & Configuration Tips
- Never commit `.env` files or secrets; only commit `.env.example`.
- Update env examples when adding config keys.
- Review auth/role checks in `backend/middleware/auth.js` for protected routes.
