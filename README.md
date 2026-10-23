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

🗺️ 4. System Architecture & Logical Flow

High-Level Pipeline

Client UI (Next.js 15 App Router)
       │
       ▼
Next.js Middleware / Auth Check (NextAuth JWT)
       │
       ▼
Server Actions / Business Logic Layer (Zod Validated)
       │
       ▼
Prisma ORM Pipeline
       │
       ▼
PostgreSQL Managed Database (3NF Schema)


Logical User Flow

Authentication: Users log in via secure credentials; NextAuth issues a signed JWT containing explicit role claims (ADMIN, MANAGER, STAFF, EXECUTIVE).

Authorization: Next.js edge middleware intercepts incoming requests, verifying the user's RBAC claims against target routes and server action primitives.

Execution: Validated operations trigger Prisma ORM queries to update PostgreSQL asset records, write an immutable AuditLog entry, and revalidate the UI in real time via Next.js cache primitives.

🌟 5. Key Features & Capabilities

🔒 Granular RBAC: Four distinct role tiers (Admin, Manager, Staff, Executive) enforcing endpoint and action-level permissions.

⚡ Real-Time Tracking: Instant inventory stock level recalculation, low-stock alerts, and activity feed sync.

🛡️ Immutable Audit Logging: Every check-out, restock, status adjustment, and user creation action is permanently logged with timestamps and user references.

📊 Executive KPI Dashboard: Real-time financial analytics summarizing total fleet valuation, active unit counts, and critical reorder thresholds.

🗄️ Normalized Schema: Optimized PostgreSQL 3NF relational design leveraging compound indexes on SKUs and statuses for high-frequency queries.

⚙️ 6. Getting Started Locally (Quickstart)

Prerequisites

Node.js 18.x or higher installed locally.

A running PostgreSQL database instance.

Installation Steps

Clone the Repository:

git clone https://github.com/YourUsername/assetpulse-inventory.git
cd assetpulse-inventory


Install Dependencies:

npm install


Configure Environment Variables:
Create a .env file in the root directory and add your connection keys:

DATABASE_URL="postgresql://postgres:password@localhost:5432/assetpulse_db?schema=public"
NEXTAUTH_SECRET="your_super_secret_cryptographic_key"
NEXTAUTH_URL="http://localhost:3000"


Initialize Database Schema:

npx prisma db push


Run the Application:

npm run dev


Open http://localhost:3000 to access the AssetPulse dashboard.

📄 License

Distributed under the MIT License. See LICENSE for more information.

Author: Developed by Mkhethwa Mavuso — Senior Full-Stack Architect & Enterprise Systems Engineer.
