import { gsap } from "gsap";

import {
  contactInfo,
  eventProjects,
  sectionInfo,
  videoProjects,
  webProjects,
} from "./data.js";

export function createUI({ loader, loaderText, landing, label, panel }) {
  let backHandler = null;

  panel.addEventListener("click", (event) => {
    const backButton = event.target.closest("[data-back-to-desk]");
    if (backButton) {
      backHandler?.();
    }
  });

  return {
    setLoadingProgress(progress) {
      const percent = Math.round(progress * 100);
      loader?.style.setProperty("--progress", `${percent}%`);
      if (loaderText) loaderText.textContent = `LOADING DESK ${percent}%`;
    },
    hideLoader() {
      if (!loader) return;
      gsap.to(loader, {
        autoAlpha: 0,
        y: 10,
        duration: 0.5,
        ease: "power2.out",
        onComplete: () => loader.setAttribute("hidden", ""),
      });
    },
    hideLanding() {
      return new Promise((resolve) => {
        gsap.to(landing, {
          autoAlpha: 0,
          y: -18,
          duration: 0.45,
          ease: "power2.out",
          onComplete: resolve,
        });
      });
    },
    showLanding() {
      return new Promise((resolve) => {
        gsap.to(landing, {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          onComplete: resolve,
        });
      });
    },
    showObjectLabel(name, position) {
      if (!label || !position) return;
      label.textContent = sectionInfo[name]?.label ?? name.toUpperCase();
      label.classList.add("is-visible");
      this.updateObjectLabel(position);
    },
    updateObjectLabel(position) {
      if (!label || !position) return;
      label.style.transform = `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)`;
    },
    hideObjectLabel() {
      label?.classList.remove("is-visible");
    },
    showSection(name) {
      const info = sectionInfo[name];
      if (!info) return;

      panel.innerHTML = renderSection(name);
      panel.style.setProperty("--section-accent", info.accent);
      panel.className = `section-panel section-panel--${info.id} is-visible`;
      panel.removeAttribute("aria-hidden");
      panel.scrollTop = 0;
    },
    hideSection() {
      panel.classList.remove("is-visible");
      panel.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (!panel.classList.contains("is-visible")) {
          panel.innerHTML = "";
          panel.className = "section-panel";
        }
      }, 350);
    },
    onBack(callback) {
      backHandler = callback;
    },
  };
}

function renderSection(objectName) {
  const info = sectionInfo[objectName];

  return `
    <div class="section-panel__chrome">
      <button class="section-panel__back" type="button" data-back-to-desk>Back to desk</button>
      <p class="section-kicker">${info.title}</p>
      <h2>${info.subtitle}</h2>
    </div>
    ${renderSectionBody(info.id)}
  `;
}

function renderSectionBody(sectionId) {
  if (sectionId === "video") return renderVideoProjects();
  if (sectionId === "events") return renderEventProjects();
  if (sectionId === "web") return renderWebProjects();
  if (sectionId === "contact") return renderContact();
  return "";
}

function renderVideoProjects() {
  return `
    <div class="project-grid project-grid--video">
      ${videoProjects
        .map(
          (project) => `
            <article class="project-card">
              ${project.thumbnail ? `<img class="project-card__image" src="${project.thumbnail}" alt="" loading="lazy" />` : ""}
              <div class="project-card__body">
                <p class="project-card__meta">${project.year} / ${project.client}</p>
                <h3>${project.title}</h3>
                ${project.description ? `<p class="project-card__description">${project.description}</p>` : ""}
                ${renderProjectLinks(project)}
                ${renderCredits(project.credits)}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderProjectLinks(project) {
  const links = project.links ?? (
    project.externalLink ? [{ label: "View project", url: project.externalLink }] : []
  );

  if (!links.length) return "";

  return `
    <div class="project-links">
      ${links
        .map(
          (link) => `
            <a href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEventProjects() {
  return `
    <div class="timeline">
      ${eventProjects
        .map(
          (event) => `
            <article class="timeline__item">
              <div class="timeline__marker"></div>
              <p class="project-card__meta">${event.year} / ${event.location}</p>
              <h3>${event.eventName}</h3>
              <p>${event.description}</p>
              <a href="${event.externalLink}" target="_blank" rel="noreferrer">Event link</a>
              ${renderCredits(event.credits)}
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWebProjects() {
  return `
    <div class="browser-grid">
      ${webProjects
        .map(
          (project) => `
            <article class="browser-card">
              <div class="browser-card__bar">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <img class="project-card__image" src="${project.thumbnail}" alt="" loading="lazy" />
              <div class="browser-card__body">
                <h3>${project.projectName}</h3>
                <p>${project.shortDescription}</p>
                ${renderTechnologies(project.technologies)}
                <a href="${project.liveUrl}" target="_blank" rel="noreferrer">Open live URL</a>
                ${renderCredits(project.credits)}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTechnologies(technologies = []) {
  if (!technologies.length) return "";

  return `
    <div class="tech-list">
      ${technologies.map((tech) => `<span>${tech}</span>`).join("")}
    </div>
  `;
}

function renderContact() {
  const cards = [contactInfo.email, contactInfo.instagram, contactInfo.linkedin, contactInfo.whatsapp];

  return `
    <div class="contact-block">
      <div class="contact-block__copy">
        <p>${contactInfo.intro}</p>
        <p>${contactInfo.availability}</p>
      </div>
      <div class="contact-grid">
        ${cards
          .map(
            (item) => `
              <a class="contact-card" href="${item.url}" target="_blank" rel="noreferrer">
                <span>${item.label}</span>
                <strong>${item.value}</strong>
              </a>
            `,
          )
          .join("")}
      </div>
      <div class="contact-actions">
        <a class="primary-cta" href="${contactInfo.cta.url}">${contactInfo.cta.label}</a>
      </div>
    </div>
  `;
}

function renderCredits(credits = []) {
  return `
    <ul class="credits">
      ${credits.map((credit) => `<li>${credit}</li>`).join("")}
    </ul>
  `;
}
