# Village Banking Web Application

Full-stack implementation scaffold for the village banking system.

## Stack

- Backend: Node.js, Express.js, PostgreSQL
- Frontend: React + JavaScript + Vite

## Quick Start

```bash
npm install
npm run install:all
cp backend/.env.example backend/.env
createdb village_banking
npm run migrate --prefix backend
npm run seed --prefix backend
npm run dev
```

Backend: `http://localhost:4000`  
Frontend: `http://localhost:5173`

Demo admin:

```text
admin@example.com
password123
```

Demo member:

```text
mary@example.com
password123
```
