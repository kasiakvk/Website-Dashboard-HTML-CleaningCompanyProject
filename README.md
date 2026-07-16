# AGU Clean Services Project

This workspace now connects the core brand assets, the landing page, and the operating documents for launch.

## Main files

- `Aga_Clean_Services.html`: landing page with service list, pricing, launch channels, and contact stack.
- `Aga_Clean_Services_v1.1.html`: alternate warm-template landing page with the same content and language support.
- `frontend/index.html`: frontend dashboard powered by the local backend API.
- `backend/server.js`: Node backend serving API routes and static project files.
- `backend/content.json`: shared business content for the frontend dashboard API.
- `styles.css`: shared visual system for the website.
- `styles-v1.1.css`: alternate warm template stylesheet for `Aga_Clean_Services_v1.1.html`.
- `site.js`: small client-side behavior for footer year and demo enquiry handling.
- `extract_docx_text.ps1`: PowerShell converter from `.docx` to `.md`.
- `AGA Clean Services logo design.png`: primary brand logo used by the site.
- `Modern cleaning service logo design.png`: supporting brand artwork used in the hero panel.
- `brand-structure-aga-clean-services.md`: root-level Markdown version of the brand brief.

## Markdown pack

- `docs/project-map.md`: quick structure of the project.
- `docs/brand-guide.md`: brand positioning and messaging base.
- `docs/service-pricing.md`: final service list and price sheet.
- `docs/ad-copy.md`: ready-to-post ads for Facebook, Gumtree, Marketplace and flyers.
- `docs/launch-plan.md`: first 14-day rollout strategy and outreach focus.

## Publish checklist

1. Replace `07xxxxx` with the real phone or WhatsApp number.
2. Add a real email inbox or a direct WhatsApp link to the contact form.
3. Publish the Google Business Profile and connect reviews.
4. Add real before/after photography when available.
5. Post the ad copy from `docs/ad-copy.md` into Facebook groups, Gumtree and Marketplace.

## DOCX to Markdown

Use the converter in the project root:

```powershell
.\extract_docx_text.ps1
.\extract_docx_text.ps1 -InputDocx ".\BRAND STRUCTURE ⭐ AGA Clean Services.docx"
.\extract_docx_text.ps1 -InputDocx ".\BRAND STRUCTURE ⭐ AGA Clean Services.docx" -OutputMd ".\brand-output.md"
```

## Run locally

Start the local server:

```powershell
npm install
npm run dev
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/ADMIN/dashboard.html`
- `http://localhost:3000/ADMIN/quotes.html`

## Run with Docker Desktop

Build and start the website container:

```powershell
docker compose up --build
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/ADMIN/dashboard.html`
- `http://localhost:3000/ADMIN/quotes.html`

Stop the container:

```powershell
docker compose down
```

## Gmail API setup

1. In Google Cloud, enable the Gmail API.
2. Configure the OAuth consent screen.
3. Create an OAuth client for a web application.
4. Add this redirect URI exactly:

```text
http://localhost:3000/api/admin/gmail/callback
```

5. Copy:

`ASSETS/backend/data/gmail-oauth-client.example.json`

to:

`ASSETS/backend/data/gmail-oauth-client.json`

6. Replace the placeholder values with your real Google OAuth `clientId` and `clientSecret`.
7. Start the app and open:

```text
http://localhost:3000/ADMIN/quotes.html
```

8. Click `Connect Gmail Account` and sign in with the Gmail account you want to use.

Notes:

- Real inbox and sent mailbox access uses Gmail API OAuth scopes for readonly mail access and sending mail.
- Without `gmail-oauth-client.json`, the Gmail page will stay in `Not Configured` state.

## Main routes

- `/` -> public website home
- `/about.html` -> about page
- `/services.html` -> services page
- `/contact.html` -> contact page
- `/ADMIN/dashboard.html` -> admin login and dashboard
- `/ADMIN/quotes.html` -> quote requests inbox and Gmail outbox
- `/api/content` -> shared JSON content
- `/api/contact` -> local enquiry capture
- `/api/quote` -> local quote request capture
- `/api/admin/login` -> admin login
- `/api/admin/quote-mailbox` -> admin quote mailbox data
