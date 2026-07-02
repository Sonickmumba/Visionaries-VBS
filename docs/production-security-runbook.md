# Production Security Runbook

## Required Environment

Set these before running with `NODE_ENV=production`:

- `DATABASE_URL`
- `SESSION_SECRET` with at least 32 random characters
- `FRONTEND_ORIGIN` using the deployed HTTPS app origin
- `RESEND_API_KEY`
- `EMAIL_FROM` using a verified sender domain
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `REDIS_URL` when Redis-backed notifications or fanout are enabled

Enable admin MFA with:

- `ADMIN_MFA_REQUIRED=true`
- `ADMIN_MFA_TTL_MINUTES=10`

## Authentication Controls

- Sessions are stored server-side and cookies are `HttpOnly`.
- Login regenerates the session before attaching the user.
- Unsafe requests require a session-bound CSRF token.
- Auth rate limits use Redis when `REDIS_URL` is available and fall back to local memory for development.
- Admin MFA uses a short-lived emailed code when `ADMIN_MFA_REQUIRED=true`.

## Upload Controls

- Payment proof uploads are signed and use authenticated Cloudinary assets.
- The backend verifies the uploaded asset with Cloudinary before saving the attachment record.
- Store Cloudinary credentials only in the backend environment.

## Monitoring

Review `audit_logs` for:

- `LOGIN`
- `SECURITY_CSRF_REJECTED`
- `SECURITY_RATE_LIMITED`
- admin override and reversal actions

Recommended production alerts:

- More than 10 failed logins for one account within 15 minutes.
- Any CSRF rejection from an authenticated session.
- Sudden rate-limit spikes by IP or email.
- Any admin override, reversal, or month unlock.

## Backups and Disaster Recovery

Minimum PostgreSQL policy:

- Daily encrypted full backup.
- Continuous WAL archiving where the host supports point-in-time recovery.
- Backup retention of at least 30 days.
- Monthly restore drill to a non-production database.
- Export and store schema migration files with every release.

Recovery objectives:

- RPO: 24 hours or better without WAL archiving, under 15 minutes with WAL archiving.
- RTO: 4 hours for database restore plus application redeploy.

## Pre-Production Security Test

Before launch:

- Run dependency audits for backend and frontend.
- Run the backend regression suite and financial accuracy suite.
- Run an authenticated OWASP ZAP baseline scan against staging.
- Manually test role boundaries for Admin, Auditor, and Member.
- Verify cookies are `Secure`, `HttpOnly`, and scoped to the production domain.
- Verify CORS rejects unknown origins.
- Verify Cloudinary direct upload cannot be confirmed with a forged `publicId`.
- Verify admin MFA blocks admin login until a valid code is submitted.
