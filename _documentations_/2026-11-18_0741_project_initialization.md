# Project Initialization & Architecture Baseline

- **Date / Timestamp:** 2026-11-18 07:41:00 +07:00
- **Project Name:** `webapps_asesor`
- **Location:** `D:\PRIVATES\Documents\Kimi\Workspaces\webapps_asesor`
- **Lead / Staff Engineer:** Senior Full-Stack Engineer

---

## 1. Project Stack Summary

| Technology | Version / Specification | Role |
| :--- | :--- | :--- |
| **Framework** | Next.js `16.4.6` (App Router) | Core Full-Stack React Framework |
| **Runtime** | Node.js `v24.22.1` / npm `11.17.0` | Execution Environment & Package Management |
| **UI Library** | React `19.3.0` | Component Architecture |
| **Type System** | TypeScript `^5` | Strict static typing (`strict: true`) |
| **Styling** | Tailwind CSS `4.3.3` (`@tailwindcss/turbopack`) | Utility-first styling engine |
| **Linter** | ESLint `^9` (`eslint-config-next`) | Code style and AST validation |
| **Bundler / Dev Server** | Turbopack | High-performance bundling and HMR |

---

## 2. Directory Layout

```text
webapps_asesor/
├── _documentations_/    # Central repository for all project docs with timestamps
├── _backups_/           # Checkpoints after stable releases (git-ignored)
├── public/              # Static public assets
├── src/
│   └── app/             # Next.js App Router (pages, layouts, route handlers)
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── .env.example         # Template for environment configuration
├── .env.local           # Local secrets & env (git-ignored)
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Engineering Conventions & Policies

1. **Change Protocol**: Make ONE change at a time. Scope stays tiny and modular (single component, file, or function per iteration).
2. **Security**: Zero plain-text secrets in repository. All keys routed through validated environment variables with strict runtime checks.
3. **Documentation**: Every architectural change or feature is documented under `_documentations_/` with a timestamped filename.
4. **Validation & Quality**: Mandatory `npm run build` and `npm run lint` verification before checkpointing.
