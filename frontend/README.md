AGU Clean Services frontend structure

This folder is the organized frontend source area for the public website.

Structure:
- `css/` shared stylesheets used by the public pages
- `js/` shared frontend scripts
- `components/` reusable HTML fragments for future extraction
- `sections/` section-level markup notes or partials
- `assets/` frontend-specific static files
- `config/` project notes for routing and page mapping

Current integration:
- Root `index.html` redirects to `pages/index.html`
- Files in `pages/` remain the public entry points
- `pages/styles.css` now points to `frontend/css/styles.css`
- `pages/app.js` now points to `frontend/js/app.js`

This keeps the website working while giving the project a cleaner frontend layout.
