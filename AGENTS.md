# Repository Guidelines

## Project Structure & Module Organization
This repository has two JavaScript apps plus test documentation:
- `backend/`: Express + Mongoose API (`index.js`, `models/`, `middleware/`, `utils/`, `scripts/`).
- `frontend/`: React + Vite client (`src/pages/`, `src/components/`, `src/context/`, `src/services/`).
- `test/`: manual test checklists/guides for staged features.
- `ENV_SETUP.md`: environment setup for local and Vercel deployments.

Keep backend business logic in `backend/utils/` and UI logic in `frontend/src/` modules close to where it is used.

## Build, Test, and Development Commands
Backend (`backend/`):
- `npm install`: install dependencies.
- `npm run dev`: run API with nodemon.
- `npm start`: run API with Node.
- `npm test`: run unit tests (`node --test`).

Frontend (`frontend/`):
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server.
- `npm run build`: produce production bundle.
- `npm run preview`: preview built bundle.
- `npm run lint`: run ESLint.

## Coding Style & Naming Conventions
- Use 2-space indentation.
- Backend uses CommonJS (`require/module.exports`) and semicolons.
- Frontend uses ES modules and functional React components.
- Naming: `PascalCase` for components/models, `camelCase` for functions/variables, `useX` for hooks.
- Follow lint rules in `frontend/eslint.config.js`; avoid unused vars unless intentionally prefixed.

## Testing Guidelines
- Backend tests live beside utils as `*.test.js` and run via `npm test` in `backend/`.
- Frontend currently relies on lint + manual verification; use `test/` checklists for regression coverage.
- Before PR: run backend tests, frontend lint, and verify key flows (login, weekly report updates, admin views).

## Commit & Pull Request Guidelines
Git history favors Conventional Commit prefixes (`feat:`, `fix:`). Continue that style with concise, scoped subjects (example: `feat: add stage 3 admin summary endpoint`).

PRs should include:
- what changed and why,
- linked issue/task (if available),
- test evidence (`backend npm test`, `frontend npm run lint`),
- screenshots for UI changes,
- `.env.example` updates for new config.

## Security & Configuration Tips
Never commit secrets. Keep `.env` local and update only `.env.example`. Validate `CORS_ORIGIN`, OAuth, JWT/session cookie, and MongoDB settings per environment using `ENV_SETUP.md`.
