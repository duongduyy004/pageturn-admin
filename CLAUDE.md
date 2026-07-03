# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

React + TypeScript admin dashboard for PageTurn, built with Vite. Talks to `pageturn-api` over REST.

## Commands

```bash
npm run dev        # vite dev server on port 5174
npm run build      # tsc -b (project-reference typecheck) && vite build
npm run preview    # preview a production build
```

There is no lint or test script, and no ESLint/Prettier config in the repo — match the existing style by eye (no semicolons, single quotes, ~2-space indent).

`vite.config.ts` is the source of truth for build config; `vite.config.js`/`vite.config.d.ts` in the repo root are stale compiled duplicates — edit only the `.ts` file.

Requires `VITE_API_BASE_URL` in `.env` (defaults to `http://localhost:8080` if unset) — the API must be running for the dashboard to do anything useful.

## Architecture

Small, flat **pages + shared-lib** structure — not feature-sliced. Pages own their own data fetching and forms directly.

- `src/main.tsx` — entry point; wraps the app in `QueryClientProvider` and `AuthProvider`, renders `RouterProvider`
- `src/router.tsx` — all routes defined in one file with TanStack Router's `createRoute`/`createRouter` (code-based, not file-based routing): root layout route wrapping `Layout`, with `/`, `/login`, `/books`, `/users` as children
- `src/pages/` — one component per route (`DashboardPage`, `LoginPage`, `BooksPage`, `UsersPage`)
- `src/components/` — `Layout.tsx` (sidebar shell + auth gate: renders bare `Outlet` on `/login`, a sign-in prompt if unauthenticated, otherwise nav + `Outlet`); `DataTable.tsx` (generic reusable table on `@tanstack/react-table`)
- `src/lib/api.ts` — typed API client (see below)
- `src/lib/auth.tsx` — `AuthContext`/`AuthProvider`, session persisted to `localStorage` under `pageturn-admin-session` (`accessToken`, `refreshToken`, `user`)
- `src/lib/types.ts` — shared TS types/DTOs

### State management

- **Server state**: TanStack React Query exclusively (`useQuery`/`useMutation`), global defaults `staleTime: 30_000`, `retry: 1`. Query keys are arrays like `['users', { page, q, role, active }]` — include all filter params in the key.
- **Auth/session**: the custom `AuthContext`, not React Query.
- **Local/UI state**: plain `useState` in page components (filters, pagination, selection).

### API client (`src/lib/api.ts`)

A single `request<T>()` wraps native `fetch` (no axios): sets JSON `Content-Type` unless the body is `FormData`, attaches `Authorization: Bearer <token>` when a token is passed explicitly by the caller, unwraps the backend's `ApiResponse<T>` envelope, and throws `ApiError` (with `status`/`details`) on non-OK responses. There is **no automatic token-refresh interceptor** — every `api.*` call requires the caller to pass the token pulled from `useAuth()`. The `api` object exposes one typed function per endpoint (`login`, `me`, `listUsers`, `getUser`, `updateUser`, `listBooks`, `getBook`, `createBook`, `updateBook`, `deleteBook`) hitting `/api/v1/auth/*` and `/api/v1/admin/*` on the backend.

### Forms

`react-hook-form` throughout — `register`/`handleSubmit`/`formState.errors`, with inline `<small>` error messages.
