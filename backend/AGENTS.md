# Repository Guidelines

## Project Structure & Module Organization
This repository is a Node.js Express backend using CommonJS and MongoDB (Mongoose).
- `index.js`: application bootstrap, middleware setup, auth flow, and route handlers.
- `models/`: Mongoose models and schema definitions.
- `middleware/`: request guards (authentication and role authorization).
- `utils/`: pure helpers for sessions, week/date logic, and report-row normalization.
- `utils/*.test.js`: unit tests for utility logic.
- `.env.example`: baseline environment variables. Keep this updated when config changes.

## Build, Test, and Development Commands
- `npm install`: install runtime and development dependencies.
- `npm run dev`: run local server with `nodemon` and auto-reload.
- `npm start`: run server in production-style mode (`node index.js`).
- `npm test`: run tests using Node’s built-in test runner (`node --test`).

Recommended local sequence:
```bash
cp .env.example .env
npm install
npm run dev
npm test
```

## API Routes Overview
The API is currently organized around health checks, auth, salesman workflows, and admin visibility.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | Public | Basic service message |
| GET | `/health` | Public | Simple process health check |
| GET | `/api/health` | Public | Health with DB ready-state metadata |
| POST | `/api/auth/google` | Public | Google token login/signup |
| GET | `/api/auth/me` | Authenticated | Return current session user |
| POST | `/api/auth/logout` | Authenticated | Clear current session |
| GET | `/api/salesman/current-week` | `salesman` or `admin` | Fetch/create current week report |
| PUT | `/api/salesman/planning` | `salesman` or `admin` | Update weekly planning rows |
| PUT | `/api/salesman/actual-output` | `salesman` or `admin` | Update actual output rows |
| PUT | `/api/salesman/current-status` | `salesman` or `admin` | Update status + note |
| GET | `/api/admin/salesmen-status` | `admin` | Aggregate status view across salesmen |

Access control is enforced with `requireAuth` and `requireRole(...)` from `middleware/auth.js`.

## Database Structure (Collections)
MongoDB collections are backed by Mongoose models in `models/`.

### `users` collection (`models/User.js`)
| Field | Type | Rules |
|---|---|---|
| `googleId` | String | unique, sparse, trimmed |
| `email` | String | required, unique, lowercase, trimmed |
| `name` | String | default `''`, trimmed |
| `picture` | String | default `''`, trimmed |
| `role` | String | enum: `salesman`, `admin`; default `salesman`; indexed |
| `createdAt`/`updatedAt` | Date | auto-managed timestamps |

### `weeklyreports` collection (`models/WeeklyReport.js`)
Top-level document keys:
| Field | Type | Rules |
|---|---|---|
| `salesmanId` | ObjectId (`User`) | required, indexed |
| `weekKey` | String | required, indexed |
| `weekStartDateUtc` | Date | required |
| `weekEndDateUtc` | Date | required |
| `planningRows` | Array<PlanningRow> | default `[]` |
| `actualOutputRows` | Array<ActualOutputRow> | default `[]` |
| `planningSubmittedAt` | Date | nullable |
| `actualOutputUpdatedAt` | Date | nullable |
| `currentStatus` | String | enum: `not_started`, `in_progress`, `blocked`, `completed`; indexed |
| `statusNote` | String | default `''`, max 1000 |
| `statusUpdatedAt` | Date | nullable |
| `createdAt`/`updatedAt` | Date | auto-managed timestamps |

Indexes:
- unique compound index: `{ salesmanId: 1, weekKey: 1 }`

Embedded `planningRows` object fields:
`date`, `isoWeek`, `customerName`, `locationArea`, `customerType`, `contactType`, `jsvWithWhom`.

Embedded `actualOutputRows` object fields:
`date`, `isoWeek`, `visited`, `notVisitedReason`, `enquiriesReceived`, `shipmentsConverted`.

### `statusupdates` collection (`models/StatusUpdate.js`)
| Field | Type | Rules |
|---|---|---|
| `salesmanId` | ObjectId (`User`) | required, indexed |
| `weekKey` | String | required, indexed |
| `status` | String | enum: `not_started`, `in_progress`, `blocked`, `completed`; required, indexed |
| `note` | String | default `''`, max 1000 |
| `createdAt`/`updatedAt` | Date | auto-managed timestamps |

## Coding Style & Naming Conventions
- Use 2-space indentation and semicolons (match existing files).
- Use CommonJS imports/exports (`require`, `module.exports`).
- Use `camelCase` for functions/variables and `PascalCase` for model names/files.
- Keep validation and normalization logic in `utils/` when reusable.

## Testing Guidelines
- Test framework: `node:test` with `node:assert/strict`.
- Place tests as `*.test.js` near related utility modules.
- Name tests by behavior, not implementation details.
- Run `npm test` before committing and before opening a PR.

## Commit & Pull Request Guidelines
Current history includes milestone commits (`feat: ...`, `phase ...`). Prefer clear Conventional Commit style going forward:
- `feat: add admin weekly summary endpoint`
- `fix: validate planning row contactType`
- `chore: update env template`

PR checklist:
- Explain what changed and why.
- List env/config updates (and update `.env.example`).
- Include test evidence (`npm test` result).
- Include request/response examples for changed endpoints.

## Security & Configuration Tips
- Do not commit `.env`, tokens, or private keys.
- Validate `CORS_ORIGIN`, Google OAuth settings, JWT/session cookie settings, and Mongo URI per environment.
- Keep role checks explicit for admin-only endpoints.
