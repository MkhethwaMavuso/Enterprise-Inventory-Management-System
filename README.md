# Enterprise-Inventory-Management-System
Solving inventory and Asset management for SMEs using easy to streamline technology.

🚀 AssetPulse — Enterprise Inventory & Asset Management System

A high-performance, secure full-stack asset management system built for real-time tracking, granular role-based access, and zero-latency auditing using Next.js 15, TypeScript, Prisma, and PostgreSQL.

🎯 1. The Problem Statement

The Core Pain Point: Manual spreadsheet tracking and fragmented inventory tooling lead to untracked asset allocation, stock discrepancies, delayed procurement cycles, and a total lack of verifiable audit trails across enterprise departments.

The Business Impact: Unmonitored hardware and software assets incur substantial administrative overhead, unexpected replacement costs, compliance risks, and critical operational downtime during IT lifecycle migrations.

The Target Persona: Built specifically for IT System Administrators, Operations Managers, Procurement Leads, and Executive Stakeholders who demand immediate, accurate visibility over company assets.

💡 2. The Solution Statement

The Technical Approach: AssetPulse delivers a centralized, cloud-ready enterprise web platform leveraging Next.js Server Actions, Prisma ORM, and PostgreSQL. It automates asset lifecycle workflows, enforces strict multi-tier Role-Based Access Control (RBAC), and logs all status modifications instantly.

Core Value Proposition: Sub-millisecond server-side data fetching, atomic database updates, immutable audit logs, and a sleek dark slate developer-first interface designed for zero training time.

🛠️ 3. Tech Stack & Architecture

Frontend: Next.js 15 (App Router, Server Components) / React 18 / TypeScript / Tailwind CSS / Shadcn UI / Lucide Icons

Backend & API: Node.js / Next.js Server Actions & API Routes / Zod Validation

Database & Persistence: PostgreSQL / Prisma ORM / Relational 3NF Schema with Foreign Key Constraints

Security & Auth: NextAuth.js / JWT Sessions / bcrypt password hashing / CORS & Middleware Enforced RBAC

Infrastructure & Tooling: Vercel Edge Deployment / Docker / Git & GitHub CI/CD Pipeline

# AssetPulse

AssetPulse is a monorepo for serialized asset tracking and bulk inventory management. It uses Next.js 15, an Express REST API, Prisma, and PostgreSQL.

## Requirements

- Node.js 20.11 or newer and npm 10+
- PostgreSQL 15+

## Local development

1. Copy `apps/server/.env.example` to `apps/server/.env` and set `DATABASE_URL` and a random `JWT_SECRET` (at least 32 characters). Copy `apps/client/.env.example` to `apps/client/.env.local`.
2. Install dependencies with `npm install`.
3. Generate the Prisma client and apply the initial migration: `npm run db:generate` then `npm run db:migrate`.
4. Create an initial administrator using the procedure below, then start both applications with `npm run dev`.

The frontend is at http://localhost:3000 and the API is at http://localhost:4000. To create the first user, run `npm run user:create -w @assetpulse/server -- --email admin@example.com --password 'change-this-password' --first-name Asset --last-name Admin --role ADMIN`.

## Commands

- `npm run dev`: run the web app and API concurrently
- `npm run build`: build the shared database package, API, and web app
- `npm run db:migrate`: create/apply a local Prisma migration
- `npm run db:deploy`: apply checked-in migrations in deployment
- `npm run db:studio`: open Prisma Studio

For deployment, configure `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN` on Render. Deploy the Next.js app on Netlify with `NEXT_PUBLIC_API_URL` set to the Render API URL. Run `npm run db:deploy` as the Render pre-deploy command. The API listens on Render's `PORT`.

The audit log is append-only through the API. Use a database role without update/delete permissions on `AuditLog` for stronger database-enforced immutability in production.

See [LICENSE](LICENSE) for license information.
⚡ Real-Time Tracking: Instant inventory stock level recalculation, low-stock alerts, and activity feed sync.
