# Repository Guidelines

## Project Structure & Module Organization
This project is organized as a full-stack JavaScript repo with separate apps:
- `backend/`: Express + Mongoose API (`index.js`, `models/`, `middleware/`, `utils/`, `scripts/`).
- `frontend/`: React + Vite client (`src/pages/`, `src/components/`, `src/context/`, `src/services/`).
- `test/`: manual regression checklists and staged feature validation notes.
- `ENV_SETUP.md`: local and Vercel environment setup details.

Keep backend business logic in `backend/utils/` and place frontend UI logic close to usage in `frontend/src/`.

## Build, Test, and Development Commands
Backend (run in `backend/`):
- `npm install`: install backend dependencies.
- `npm run dev`: start API with nodemon for local development.
- `npm start`: run API with Node in non-watch mode.
- `npm test`: execute backend unit tests using `node --test`.

Frontend (run in `frontend/`):
- `npm install`: install frontend dependencies.
- `npm run dev`: launch Vite development server.
- `npm run build`: create production build artifacts.
- `npm run preview`: preview the built app locally.
- `npm run lint`: run ESLint checks.

## Coding Style & Naming Conventions
Use 2-space indentation across JS/JSX files.
- Backend style: CommonJS (`require`, `module.exports`) and semicolons.
- Frontend style: ES modules and functional React components.
- Naming: `PascalCase` for components/models, `camelCase` for variables/functions, `useX` for hooks.
- Follow `frontend/eslint.config.js`; avoid unused variables unless intentionally prefixed.

## Testing Guidelines
Backend tests should live next to source modules as `*.test.js` and run via `npm test` in `backend/`.
Frontend relies on linting plus manual flow checks in `test/`.
Before opening a PR, verify key flows such as login, weekly report updates, and admin dashboards.

## Commit & Pull Request Guidelines
Use Conventional Commit prefixes seen in project history (`feat:`, `fix:`, etc.), with concise scopes.
PRs should include:
- What changed and why.
- Linked issue/task (if available).
- Test evidence (e.g., `backend npm test`, `frontend npm run lint`).
- Screenshots for UI changes.
- `.env.example` updates when config changes.

## Security & Configuration Tips
Never commit secrets or real `.env` values. Keep sensitive values local and update only `.env.example`.
Validate `CORS_ORIGIN`, OAuth, JWT/session cookie, and MongoDB settings per environment using `ENV_SETUP.md`.
