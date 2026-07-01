async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function createCard(title, description, link) {
  const article = document.createElement("article");
  article.className = "card";
  article.innerHTML = `
    <h3>${title}</h3>
    <p>${description}</p>
    ${link ? `<p><a href="${link.href}">${link.label}</a></p>` : ""}
  `;
  return article;
}

async function render() {
  const content = await getJson("/api/content");

  document.getElementById("brand-tagline").textContent = content.brand.tagline;
  document.getElementById("brand-areas").textContent =
    `${content.brand.areas.join(" • ")} • Call / WhatsApp: ${content.brand.phone}`;

  const linksGrid = document.getElementById("links-grid");
  content.links.forEach((item) => {
    linksGrid.appendChild(
      createCard(item.label, "Open a connected project page using the same brand content.", item)
    );
  });

  const servicesGrid = document.getElementById("services-grid");
  content.services.forEach((service) => {
    servicesGrid.appendChild(createCard(service.title, service.description));
  });

  const pricingTable = document.getElementById("pricing-table");
  pricingTable.innerHTML = `
    <div class="pricing-row"><span>Service</span><span>Price</span></div>
    ${content.pricing
      .map((item) => `<div class="pricing-row"><span>${item.service}</span><span>${item.price}</span></div>`)
      .join("")}
  `;

  const launchGrid = document.getElementById("launch-grid");
  content.launchPlan.forEach((item, index) => {
    launchGrid.appendChild(createCard(`Step ${index + 1}`, item));
  });
}

async function handleContactSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formStatus = document.getElementById("form-status");
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch("/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  formStatus.textContent = result.ok ? result.message : result.error;

  if (result.ok) {
    form.reset();
  }
}

render().catch((error) => {
  const heading = document.getElementById("brand-tagline");
  heading.textContent = "Frontend failed to load API content";
  console.error(error);
});

document.getElementById("contact-form").addEventListener("submit", (event) => {
  handleContactSubmit(event).catch((error) => {
    document.getElementById("form-status").textContent = error.message;
  });
});
