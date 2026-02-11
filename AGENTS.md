# Repository Guidelines

## Project Structure & Module Organization
- `frontend/`: React + Vite client app. Main code is in `frontend/src/` (`App.jsx`, `main.jsx`, `index.css`), with build/config files at the folder root (`vite.config.js`, `tailwind.config.js`, `eslint.config.js`).
- `backend/`: Express API server entrypoint is `backend/index.js`; environment examples live in `backend/.env.example`.
- `Knowledge/`: static reference assets (images).
- Avoid editing generated/dependency folders (`frontend/dist/`, `frontend/node_modules/`, `backend/node_modules/`).

## Build, Test, and Development Commands
- Frontend setup: `cd frontend && npm install`
- Frontend dev server: `npm run dev` (Vite local server)
- Frontend production build: `npm run build` (outputs to `frontend/dist/`)
- Frontend lint: `npm run lint` (ESLint flat config)
- Frontend preview build: `npm run preview`
- Backend setup: `cd backend && npm install`
- Backend dev server: `npm run dev` (nodemon auto-reload)
- Backend start: `npm start` (plain Node runtime)

## Coding Style & Naming Conventions
- Follow existing file-local style:
  - Frontend (`*.jsx`, `*.js`) currently uses ES modules and no semicolons.
  - Backend (`index.js`) uses CommonJS with semicolons.
- Use 2-space indentation and keep functions/components focused.
- React components: `PascalCase` (`App.jsx`); variables/functions/hooks: `camelCase`; env vars: `UPPER_SNAKE_CASE`.
- Run `cd frontend && npm run lint` before opening a PR.

## Testing Guidelines
- Current state: no automated test suite is configured yet (`backend` test script intentionally fails placeholder).
- For new tests, add framework-specific scripts in `package.json` and keep test files near code or under a `tests/` folder using `*.test.js` / `*.test.jsx` naming.
- In PRs, include manual verification steps for:
  - `GET /health` and `GET /api/health`
  - Frontend API connectivity from `frontend/src/App.jsx`

## Commit & Pull Request Guidelines
- Git history is minimal (`init project`), so use clear, imperative commit subjects (example: `Add backend health response details`).
- Keep commits scoped to one concern.
- PRs should include:
  - Purpose and summary of changes
  - Commands run (lint/build/dev checks)
  - Screenshots for UI changes
  - Linked issue/task when applicable

## Security & Configuration Tips
- Do not commit secrets; create local `backend/.env` from `backend/.env.example`.
- Review `frontend/vite.config.js` proxy target before local integration testing (it currently points to a deployed backend URL).
