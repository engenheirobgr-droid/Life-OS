# Vercel Push Setup (Life OS)

Configure these Environment Variables in Vercel (Project -> Settings -> Environment Variables):

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` (example: `mailto:you@example.com`)
- `CRON_SECRET` (random strong string)
- `LIFEOS_ADMIN_API_KEY` (random strong string)
- `DEFAULT_TZ` (example: `America/Bahia`)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with `\n` preserved)

## GitHub Actions scheduler (used instead of Vercel Cron)

Create these repository secrets in GitHub (`Settings -> Secrets and variables -> Actions`):

- `LIFEOS_CRON_URL` = `https://<seu-deploy>.vercel.app/api/cron-habit-reminders`
- `LIFEOS_CRON_SECRET` = same value used in Vercel `CRON_SECRET`

Workflow file already included:

- `.github/workflows/habit-reminders-cron.yml`

It runs every 5 minutes and can be triggered manually in GitHub Actions (`Run workflow`).

## Generate VAPID keys

Run once locally:

```bash
npx web-push generate-vapid-keys
```

Use the generated `publicKey` and `privateKey` in Vercel env vars.

## Cron auth

`Authorization: Bearer <CRON_SECRET>`

## Test endpoint

Manual push test endpoint:

`POST /api/push-test`

Header required:

`x-lifeos-admin-key: <LIFEOS_ADMIN_API_KEY>`
