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

Recommended next split:
1. Extract shared header and footer into `frontend/components/`
2. Move inline content blocks into `frontend/sections/`
3. Replace the temporary bridge to hidden `.css/` and `.js/` folders with direct source files inside `frontend/`
