# CampusFlow — React frontend

A Smart College Operations Platform frontend built with **React 18, JavaScript/JSX, Vite, React Router v6, Recharts, Lucide icons, and plain CSS**.

## Run locally

Use Node.js 22.12 or later:

```sh
npm install
npm run dev
```

Open the local address printed in the terminal. For a production build:

```sh
npm run build
npm run preview
```

Run the seating, CSV, and insight checks with `npm test`.

## Connect the complaints service

Start the backend in a separate terminal from the repository root:

```powershell
Set-Location backend
uv sync
uv run uvicorn app:app --reload
```

Then start the frontend as above. It connects to `http://127.0.0.1:8000` by
default. Set `VITE_API_BASE_URL` in a frontend `.env` file to use a different
backend URL. The complaints page loads saved records and submits new complaints
through the API; other CampusFlow features continue to use browser-local demo
data.

## What is included

- Mock login, role-specific navigation, student-account switching, dashboard, search, notifications, profile, and responsive layouts.
- OD/leave forms, proof filenames, advisor review, HOD approval, required comments, revision and resubmission, history, and ERP CSV export.
- Anonymous complaint forms, category-based routing, priorities, SLA countdown, officer assignment, staff-only notes, public timelines, escalation, and resolution.
- Exam room builder, CSV upload/drop zone, missing-field and duplicate checks, 120-student sample roster, department-aware allocation, adjacency warnings, room grids, seat details, history, CSV and print/PDF export.
- CampusRent listings, search and filters, date/price validation, rental requests, owner acceptance, simulated payment, handover, returns, reviews, and local participant messages.
- Project creation, team workspaces, mentor requests, acceptance/rejection, milestones, progress updates, documents as filenames, categorized faculty feedback and review history.
- Lab seat map, slot booking, simulated QR check-in, automatic reservation expiry, end session, hardware reporting and repair resolution.
- Student directory, profile charts, attendance, skills, evidence-based local copilot, events, reports and settings.

## Try the five workflows

1. **OD:** Student Aarav → OD & leave → Apply. Switch to Faculty → open request → approve with comment. Switch to Admin → approve → ERP & exports. Switch back to Student to see the final status.
2. **Complaint:** Student → Complaints → submit. Admin → open complaint → assign officer, update priority/status and public message. Student sees public updates without officer or internal notes.
3. **Seating:** Admin → Exam seating → use demo roster or upload CSV → configure rooms → generate. Click seats, regenerate, export or print. Save as PDF through the browser print dialog.
4. **Rental:** Student Aarav → CampusRent → list an item. Switch student account to Diya → request it. Aarav → My rentals → accept. Diya → simulated payment → confirm. Aarav → handover. Diya → returned. Aarav → complete. Diya → review.
5. **Mentoring:** Student → ProjectHub → create a project → request Dr. Priya Raman. Faculty → ProjectHub → accept mentorship. Student → milestones and progress updates. Faculty → Updates & reviews → review. Student → corrections/update → mark Completed at 100%.

The Faculty demo defaults to Dr. Priya Raman. All data persists in `campusflow_v1`; the demo session is `campusflow_session`. Reset demo data under Settings.

## Deliberate frontend simulations

Complaint loading and submission use the FastAPI service; the complaint
assignment/status/timeline controls remain browser-local demo actions. Other
CampusFlow features also use browser-local demo data. Roles are demo views, not
security boundaries, and the prototype does not provide production anonymity,
real authentication, real payment, QR scanning, or ERP connectivity.
Notifications and participant messages never leave the browser. Uploaded
documents and product photos retain filenames only; product illustrations are
bundled vector icons. Student trends and skills use sample values and are
marked illustrative. The lab check-in timer starts immediately at reservation
time to make expiry easy to demonstrate.

The supplied reference archive was inspected for its React component, form, table, and chat patterns. CampusFlow complaint records use the backend service; other screens continue to use the local demo data.

## Project structure

```text
src/
  App.jsx               application state, shell, routes, dashboard
  main.jsx              React entry
  styles.css            responsive design system and print styles
  components/ui.jsx     reusable forms, dialogs, cards, timelines
  data/seed.js          correlated mock records
  logic.js              CSV, seating and rule-based insight logic
  pages/                feature screens
tests/                  meaningful data/algorithm checks
public/favicon.svg     CampusFlow brand icon
```

`vercel.json` includes a static Vite build configuration and SPA fallback. No Vercel account or GitHub repository is required to run the frontend.

## Limits

Browser storage is per browser/device and is not synchronized between users. Use the in-app role/account switches for demonstrations. Product photos and uploaded proofs are not stored as binary data. Seating tries to avoid left/right and vertical department adjacency and reports unavoidable conflicts; it cannot guarantee a conflict-free layout for an imbalanced roster. Print/PDF uses the browser print dialog. The optional read-only WebMCP summary is enabled only in compatible browsers.
