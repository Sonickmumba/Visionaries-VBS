# Visionaries Village Banking

Full-stack village banking application for Visionaries cycle-based savings, loans, declarations, penalties, common interest, monthly closing, ledger traceability, and reporting.

## Stack

- Backend: Node.js, Express.js, PostgreSQL
- Frontend: React + JavaScript + Vite
- Local database: PostgreSQL 16 through Docker Compose

## Prerequisites

- Node.js 20 or newer
- npm
- Docker Desktop or another Docker Compose compatible runtime

## Local Setup

From a fresh clone:

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run setup:local
npm run dev
```

The setup command installs backend/frontend dependencies, starts PostgreSQL, runs migrations, seeds demo data, and runs a seed smoke check.

App URLs:

- Backend API: `http://localhost:4000`
- Backend health check: `http://localhost:4000/health`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`

## Demo Logins

Admin:

```text
admin@example.com
password123
```

Member:

```text
mary@example.com
password123
```

Seed data creates the active `2026 Main Cycle`, 12 cycle months, the failure-to-declare penalty type, and five enrolled demo members.

## Common Commands

```bash
npm run db:up          # start PostgreSQL
npm run db:wait        # wait until PostgreSQL accepts connections
npm run db:down        # stop PostgreSQL and remove the compose network
npm run db:logs        # follow PostgreSQL logs
npm run migrate        # run backend SQL migrations
npm run seed           # create/update demo users, cycle, months, members
npm run db:smoke       # verify seeded local data is usable
npm run dev            # run backend and frontend together
npm run dev:backend    # backend only
npm run dev:frontend   # frontend only
npm test               # full backend + frontend test suite
npm run test:regression
```

## Environment

Backend settings live in `backend/.env`; frontend settings live in `frontend/.env`.

Default local backend database URL:

```text
postgres://postgres:postgres@localhost:5432/village_banking
```

Authentication uses Passport with server-side PostgreSQL sessions and an HttpOnly `vb_sid` cookie. Set a strong `SESSION_SECRET` in production and run migrations so the `user_sessions` table exists.

Payment proof uploads use signed direct uploads to Cloudinary. The backend signs each upload, the browser uploads straight to Cloudinary, and PostgreSQL stores only declaration attachment metadata. Configure these values in `backend/.env`:

```text
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_PROOF_FOLDER=village-banking/payment-proofs
PAYMENT_PROOF_MAX_BYTES=5242880
```

If port `5432` is already used, change the host port in `docker-compose.yml` and update `DATABASE_URL` in `backend/.env`.

## Fresh Setup Check

To verify a new machine:

```bash
npm run db:up
npm run db:wait
npm run migrate
npm run seed
npm run db:smoke
npm test
```

`npm run db:smoke` fails if the demo admin, demo member, active cycle, members, months, memberships, or penalty type are missing.

## Troubleshooting

If the backend cannot connect to PostgreSQL, check Docker is running and inspect logs:

```bash
npm run db:logs
```

If you need to recreate the local database volume, stop Compose and remove the named volume from Docker Desktop, then run the setup commands again.
