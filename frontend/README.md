AGU Clean Services frontend structure

This folder is the organized frontend source area for the public website.

Structure:

- `css/` direct shared stylesheet source used by the public pages
- `js/` direct shared frontend script source
- `components/` canonical shared HTML fragments such as header and footer
- `sections/` extracted section-level HTML source blocks from the static pages
- `assets/` frontend-specific static files
- `config/` project notes for routing and page mapping

Current integration:

- Root `index.html` redirects to `pages/index.html`
- Files in `pages/` remain the public entry points
- `pages/*.html` now link directly to `../frontend/css/styles.css`
- `pages/*.html` now load `../frontend/js/app.js`
- `pages/styles.css` and `pages/app.js` remain only as legacy bridge files and are no longer required by the public pages

This keeps the website working while making `frontend/` the real source area for shared presentation code.
