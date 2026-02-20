# Repository Guidelines

## Project Structure & Module Organization
This repository contains two JavaScript apps and supporting test docs:
- `backend/`: Express + Mongoose API (`index.js`, `models/`, `middleware/`, `utils/`, `scripts/`).
- `frontend/`: React + Vite app (`src/pages/`, `src/components/`, `src/context/`, `src/services/`).
- `test/`: manual regression checklists for staged feature validation.
- `ENV_SETUP.md`: environment and deployment setup notes.

Keep backend business logic in `backend/utils/` and colocate frontend logic in the nearest `frontend/src/` feature module.

## Build, Test, and Development Commands
Backend (`backend/`):
- `npm install`: install dependencies.
- `npm run dev`: start API with nodemon.
- `npm start`: run API with Node.
- `npm test`: run backend unit tests with Node’s test runner.

Frontend (`frontend/`):
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server.
- `npm run build`: create production bundle.
- `npm run preview`: preview production build locally.
- `npm run lint`: run ESLint checks.

## Coding Style & Naming Conventions
- Use 2-space indentation.
- Backend uses CommonJS (`require`, `module.exports`) and semicolons.
- Frontend uses ES modules and functional React components.
- Naming rules: `PascalCase` for components/models, `camelCase` for functions/variables, `useX` for hooks.
- Follow lint rules in `frontend/eslint.config.js`; avoid unused variables unless intentionally prefixed.

## Testing Guidelines
- Backend tests live alongside utilities as `*.test.js` (example: `backend/utils/adminInsights.test.js`).
- Run backend tests with `cd backend && npm test`.
- Frontend relies on linting and manual verification using files in `test/`.
- Before opening a PR, verify core flows: login, weekly report updates, and admin views.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style from project history (for example: `feat: add stage 3 admin summary endpoint`).
- PRs should include:
  - what changed and why,
  - linked issue/task,
  - test evidence (for example: `backend npm test`, `frontend npm run lint`),
  - screenshots for UI changes,
  - `.env.example` updates for config changes.

## Security & Configuration Tips
Never commit secrets. Keep `.env` local and update only `.env.example`. Validate `CORS_ORIGIN`, OAuth, JWT/session cookie, and MongoDB configuration per environment before deployment.
