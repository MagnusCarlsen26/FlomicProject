# Massive UI Overhaul Plan

## Summary
Deliver a single-pass frontend redesign across login, salesman, and admin pages using a premium glass/gradient visual system, expressive motion, and a new top-navigation shell. Keep all existing API contracts and business flows intact. Add light and dark themes with persistent user preference and full responsive behavior.

## Locked Product Decisions
- Visual direction: Glass + Gradient
- Energy level: Expressive
- Scope: All pages + shared design system, full structural redesign
- Navigation: Top navigation shell
- Data handling: Balanced (retain usable dense tables, improve presentation)
- Backend boundary: Frontend-only (no API/schema changes)
- Palette: Cyan + Amber
- Theme support: Light + Dark
- Delivery: Single comprehensive pass

## Important API / Interface Changes
- External/public backend API: No changes
- Frontend dependencies:
  - Add `framer-motion` for orchestration of expressive animations
- Internal UI interfaces added:
  - `ThemeProvider` and `useTheme` with `theme: 'light' | 'dark' | 'system'` and persisted selection
  - Reusable layout primitives (`AppShell`, `TopNav`, `PageSurface`, `GlassCard`, `StatTile`, `FilterBar`)
  - Motion wrappers (`PageEnter`, `StaggerGroup`, `RevealCard`) honoring reduced-motion

## Implementation Blueprint

### 1. Foundation: Tokens, Typography, Theme Engine
- Update `index.css` with full design tokens via CSS variables for both themes:
  - Background layers, glass surface, borders, text hierarchy, accent gradients, status colors
- Add typography pairing (display + body) in global styles
- Extend `tailwind.config.js`:
  - Semantic colors from CSS vars, custom shadows, backdrop blur, spacing/rounding scale
- Add theme management:
  - `ThemeContext.jsx`
  - `useTheme.jsx`
  - Persist theme in `localStorage`, initialize on first paint, support system fallback

### 2. Shared UI Primitive Layer
- Create a reusable design layer under `frontend/src/components/ui/`:
  - `GlassCard.jsx`, `Button.jsx`, `Input.jsx`, `Select.jsx`, `Badge.jsx`, `Alert.jsx`, `DataTableFrame.jsx`
- Normalize interaction states:
  - Focus rings, hover/press behavior, disabled treatment, dark/light parity
- Replace repeated raw utility-class blocks in pages with these primitives

### 3. New Top Navigation Shell
- Add `AppShell.jsx` and `TopNav.jsx`:
  - Brand area, route tabs, user identity, theme toggle, logout
- Role-aware nav items:
  - Salesman: workspace
  - Admin: insights + salesmen status
- Integrate shell in `App.jsx` routing wrappers so page content mounts inside a consistent structure
- Mobile behavior:
  - Collapsible top bar, horizontally scrollable nav tabs, sticky action row

### 4. Login Experience Redesign
- Rebuild `LoginPage.jsx` as a visually rich welcome/auth screen:
  - Split visual hero + auth card, animated gradient glow, cleaner message hierarchy
- Preserve current Google flow and retry behavior unchanged
- Keep error messaging semantics identical, restyle with new alert system

### 5. Salesman Workspace Redesign
- Refactor `SalesmanPage.jsx`:
  - Hero summary strip (week range, lock status, last save/submission)
  - Sectioned content with stronger hierarchy and sticky action controls
  - Planning and actual output presented in elevated glass panels with improved table framing
- Preserve all edit/save/submit behavior and payload shape exactly

### 6. Admin Insights Redesign
- Refactor `AdminInsightsPage.jsx`:
  - Command bar with search/week filters in premium filter container
  - KPI cards redesigned as expressive tiles with subtle animated entry
  - Charts and productivity tables in consistent surfaced modules
- Update chart styling in `InsightsCharts.jsx`:
  - Theme-aware chart palette (light/dark), improved grid/tooltip/legend contrast

### 7. Admin Salesman Status Redesign
- Refactor `AdminSalesmenStatusPage.jsx`:
  - Improved list hierarchy, clearer expandable salesperson blocks
  - Planning/actual subsections separated with visual anchors and status badges
- Keep existing data density but modernize spacing, typography, and interaction affordances

### 8. Motion System (Expressive but Controlled)
- Add motion utilities in `frontend/src/components/motion/` powered by `framer-motion`:
  - Page enter transitions, staggered card reveals, subtle control animations
- Respect accessibility:
  - Disable/soften motion when `prefers-reduced-motion` is enabled
- Avoid decorative animation on dense table internals to preserve performance

### 9. Theme-Aware Data and States
- Ensure all status states (success, warning, error, info) are tokenized and theme-safe
- Ensure table borders, zebra effects, and hover states are readable in both themes
- Ensure Recharts colors and tooltip containers adapt to current theme token set

## File-Level Change Map

### Update
- `index.css`
- `tailwind.config.js`
- `main.jsx`
- `App.jsx`
- `LoginPage.jsx`
- `SalesmanPage.jsx`
- `AdminInsightsPage.jsx`
- `AdminSalesmenStatusPage.jsx`
- `InsightCard.jsx`
- `AdminSectionTabs.jsx`
- `InsightsCharts.jsx`
- `LocationProductivityTable.jsx`
- `SalespersonProductivityTable.jsx`

### Add
- `ThemeContext.jsx`
- `useTheme.jsx`
- `AppShell.jsx`
- `TopNav.jsx`
- `frontend/src/components/ui/*` (primitive set)
- `frontend/src/components/motion/*` (animation wrappers)
- `themeTokens.js` (if needed for chart/runtime token reads)

## Test Cases and Scenarios

### Static Checks
- `npm run lint`
- `npm run build`

### Functional Regression (Manual)
- Login page renders and Google auth trigger still works
- Role routing unchanged (`/salesman`, `/admin/insights`, `/admin/salesmen-status`)
- Salesman save/submit/update actions behave exactly as before
- Admin filters and refresh/polling continue working

### Theme Validation
- Light/dark toggle works and persists across refresh
- All alerts, badges, tables, charts are legible in both themes

### Responsive Validation
- `320px`, `768px`, `1024px`, `1440px` layouts remain usable
- Top nav remains operable on mobile

### Motion and Accessibility
- Expressive animations present under normal settings
- Reduced-motion preference suppresses heavy transitions
- Keyboard focus visibility preserved across controls

## Acceptance Criteria
- UI feels materially more premium/energetic while retaining current workflows
- Shared visual language is consistent across all pages/components
- No backend/API changes required
- Both themes are complete and production-usable
- No regressions in auth, data editing, filter, refresh, or role access flows

## Assumptions and Defaults
- Dependency choice defaulted to `framer-motion` based on your “anything you like” response
- Existing copy/content semantics are kept unless needed for hierarchy clarity
- No i18n expansion in this pass
- No change to API payload shape, query params, or backend endpoints
