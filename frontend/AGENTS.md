# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite + React frontend.
- `src/main.jsx`: app bootstrap and root render.
- `src/App.jsx`: top-level routing shell.
- `src/pages/`: route-level screens (`AdminPage.jsx`, `LoginPage.jsx`, `SalesmanPage.jsx`).
- `src/components/`: reusable UI and route guards (for example `ProtectedRoute.jsx`).
- `src/context/`: auth/state context (`AuthContext.jsx`, `useAuth.jsx`).
- `src/services/`: API client code (`api.js`).
- `src/constants/`: shared static config.
- `public/`: static public assets.
- `dist/`: production build output (generated, do not edit).

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server with HMR.
- `npm run build`: create a production bundle in `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint for `.js/.jsx` files.

## Coding Style & Naming Conventions
- Use ES modules and functional React components.
- Follow ESLint config in `eslint.config.js` (React Hooks + React Refresh rules enabled).
- Indentation: 2 spaces; keep lines readable and components focused.
- Naming:
  - Components/pages: `PascalCase` (`LoginPage.jsx`).
  - Hooks: `useX` (`useAuth.jsx`).
  - Utilities/constants: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for true constants.
- Do not edit generated output in `dist/`.

## Testing Guidelines
There is currently no automated test suite configured in `package.json`.
- Minimum requirement for changes: run `npm run lint` and verify impacted flows manually in `npm run dev`.
- When adding tests, colocate them near source files as `*.test.jsx` or `*.test.js`.

## Commit & Pull Request Guidelines
Recent commits use short, imperative subjects, often prefixed with `feat:`.
- Prefer consistent conventional prefixes: `feat:`, `fix:`, `refactor:`, `chore:`.
- Keep commit scope small and focused.
- PRs should include:
  - clear summary of what changed and why,
  - related issue/ticket (if available),
  - screenshots or short video for UI changes,
  - local verification steps (for example: `npm run lint`, manual login flow).

## Security & Configuration Tips
- Keep secrets only in `.env`; never commit real credentials.
- Update `.env.example` when adding new environment variables.
- Review `src/services/api.js` changes carefully, as they affect all backend communication.
