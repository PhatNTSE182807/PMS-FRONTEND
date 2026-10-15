# Workspace Instructions

- This project uses React 19 with TypeScript, Vite and npm. New code is `.ts`/`.tsx`; the legacy `.jsx` screens are migrated incrementally (`allowJs`).
- Keep application code in `src/` and follow the layering in the README: pages/components → hooks (React Query) → api services → axiosClient. Components never call HTTP directly.
- DTOs live in `src/types` and mirror the backend contracts; every service supports mock mode via `isMockService()`.
- The admin dashboard uses Tailwind CSS scoped to `.admin-root`; the legacy cyber theme lives in the `legacy` cascade layer.
- Run `npm run lint` and `npm run build` (which type-checks) to validate changes.
