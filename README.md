# Report Workflow Hackathon

Next.js 15 application for report and assistance workflows. The frontend pages and backend API routes run in one Node.js 22 service on port `8000`.

## What It Includes

- `Senior Application Assistant` (`/assistant`): guided bilingual flow for senior-friendly assistance intake, form matching, draft review, consent, volunteer follow-up, and SMS preview.
- `Form Fill` (`/fill`): WhatsApp-style form-filling chatbot with text and voice input, session storage, optional Gemini AI, form matching, and completion notification hooks.
- `Navigator` (`/navigate`): chatbot-assisted report search that asks guided questions, extracts keywords, and returns matching reports.
- `Form Viewer` (`/view`): PDF workspace for upload, preview, page extraction, page deletion, merge, download, and PVC/local save.
- `User Management` (`/user-management`): simple user/admin list and add-user flow backed by local/PVC JSON.
- `Health API` (`/api/health`): lightweight endpoint for local checks and Docker healthchecks.

The app works without external API keys. When `GEMINI_API_KEY`, Twilio, or SendGrid values are missing, the backend uses mock AI responses and logs notification messages for development.

## Requirements

- Node.js `22.x`
- npm `10+`
- Docker Desktop, optional for container runs

## Environment

Create local environment settings from the example when you want optional integrations:

```bash
copy .env.example .env.local
```

Important variables:

```text
PORT=8000
HOSTNAME=0.0.0.0
PVC_ROOT=storage/pvc
GEMINI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@government-assistance.my
```

`PVC_ROOT` controls where runtime PDFs, users, and sessions are stored. In Docker it defaults to `/app/storage/pvc` and should be backed by a volume.

## Run Locally

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:8000
```

Check the API:

```bash
curl http://localhost:8000/api/health
```

Production-style local run:

```bash
npm run build
npm start
```

## Docker

Build the production image:

```bash
docker build -t report-workflow-hackthon:latest .
```

Run without provider keys:

```bash
docker run --rm -p 8000:8000 -v report-pvc:/app/storage/pvc report-workflow-hackthon:latest
```

Run with local environment variables:

```bash
docker run --rm -p 8000:8000 --env-file .env.local -v report-pvc:/app/storage/pvc report-workflow-hackthon:latest
```

Check the running container:

```bash
curl http://localhost:8000/api/health
```

Push example:

```bash
docker tag report-workflow-hackthon:latest <registry>/<namespace>/report-workflow-hackthon:latest
docker push <registry>/<namespace>/report-workflow-hackthon:latest
```

Docker notes:

- The image uses `node:22-alpine`.
- The runtime runs as a non-root `nextjs` user.
- `/app/storage/pvc` is declared as a volume.
- The image has a healthcheck that calls `/api/health`.
- `.env*` files are ignored by Docker except `.env.example`, so secrets are not copied into the build context.

## Scripts

```text
npm run dev        Start Next.js on port 8000.
npm run typecheck  Run TypeScript without emitting files.
npm run build      Build the standalone Next.js production server.
npm start          Start the standalone production server on port 8000.
```

## Project Layout

```text
app/                         Next.js App Router pages and API routes.
app/page.tsx                 Dashboard.
app/assistant/               Senior application assistant page.
app/fill/                    Fill chatbot page.
app/navigate/                Navigator chatbot page.
app/view/                    PDF workspace page.
app/user-management/         User/admin management page.
app/api/                     Backend HTTP routes.

backend/                     Server-side workflow helpers.
backend/ai-service.ts        Optional Gemini integration with mock fallback.
backend/form-matcher.ts      Assistance form matching rules.
backend/notifications.ts     Twilio/SendGrid hooks with development logging.
backend/fill/                Fill chatbot and session manager.
backend/navigate/            Navigator chatbot logic.
backend/elderly/             Senior assistant form catalog and draft builder.
backend/pdf.ts               PDF upload, merge, extract, and delete helpers.
backend/storage.ts           PVC/local storage helpers.

components/                  Shared UI components.
fill/                        Fill workflow frontend.
navigate/                    Navigator workflow frontend.
view/                        PDF workspace frontend.
user-management/             User management frontend.
storage/pvc/                 Runtime data, ignored by Git.
```

## Main API Routes

```text
GET  /api/health
POST /api/auth/login

POST /api/elderly/forms/search
POST /api/elderly/application

GET  /api/fill/questions
POST /api/fill/session
POST /api/fill/chat
POST /api/fill/forms/search
GET  /api/fill/forms/[formId]?sessionId=<sessionId>
POST /api/fill/complete
POST /api/fill/insights

GET  /api/navigate/questions
POST /api/navigate/search
POST /api/navigate/insights

GET  /api/pdf/files
POST /api/pdf/upload
POST /api/pdf/merge
POST /api/pdf/extract-pages
POST /api/pdf/delete-pages
GET  /api/pdf/files/[filename]
GET  /api/pdf/files/[filename]?download=1

GET  /api/users
POST /api/users
GET  /api/reports/[id]
GET  /api/favorites
POST /api/favorites
```

## Verification

Current verified commands:

```bash
npm run typecheck
npm run build
```

Both commands should pass before Docker builds or deployment.
