# AGU Clean Services site map

Public entrypoint:
- `index.html` -> redirects to `pages/index.html`

Current page set:
- `pages/index.html`
- `pages/about.html`
- `pages/about-me.html`
- `pages/services.html`
- `pages/prices.html`
- `pages/reviews.html`
- `pages/contact.html`
- `pages/faq.html`
- `pages/privacy.html`
- `pages/terms.html`
- `pages/domestic-cleaning.html`
- `pages/deep-cleaning.html`
- `pages/end-of-tenancy.html`
- `pages/airbnb-cleaning.html`
- `pages/commercial-cleaning.html`
- `pages/dashboard.html`

Implemented source structure:
1. Shared header and footer extracted into `frontend/components/`
2. Key inline content blocks moved into `frontend/sections/`
3. Direct source CSS and JS now live inside `frontend/`

Recommended next split:
1. Replace repeated page markup with a static include/build step
2. Normalize footer variants to one canonical component API
3. Retire `pages/styles.css` and `pages/app.js` after confirming nothing else references them
