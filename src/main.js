import "./styles.css";

import { contact, filters, profile, projects, photography } from "./data.js";

const app = document.querySelector("#app");

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

clearInitialHash();

let activeFilter = "all";
let hasEntered = false;
let mediaObserver = null;
let resizeFrame = 0;
const initialScrollResetDuration = 2800;
let initialScrollResetFrame = 0;
let initialScrollResetUntil = 0;

startInitialScrollReset();
render();
bindEvents();
syncThemeButton();
setupCurrentMedia();
startInitialScrollReset();
["wheel", "touchstart", "keydown", "pointerdown"].forEach((eventName) => {
  window.addEventListener(eventName, cancelInitialScrollReset, { capture: true, once: true });
});
window.addEventListener("DOMContentLoaded", startInitialScrollReset);
window.addEventListener("load", startInitialScrollReset);
window.addEventListener("pageshow", startInitialScrollReset);
window.addEventListener("beforeunload", resetScrollPosition);
window.addEventListener("resize", scheduleMediaSetup, { passive: true });

function startInitialScrollReset() {
  initialScrollResetUntil = Math.max(
    initialScrollResetUntil,
    window.performance.now() + initialScrollResetDuration,
  );
  clearInitialHash();
  resetScrollPosition();

  if (!initialScrollResetFrame) {
    initialScrollResetFrame = window.requestAnimationFrame(maintainInitialScrollReset);
  }
}

function maintainInitialScrollReset() {
  initialScrollResetFrame = 0;

  if (window.performance.now() > initialScrollResetUntil) return;

  clearInitialHash();
  resetScrollPosition();
  initialScrollResetFrame = window.requestAnimationFrame(maintainInitialScrollReset);
}

function cancelInitialScrollReset() {
  initialScrollResetUntil = 0;

  if (initialScrollResetFrame) {
    window.cancelAnimationFrame(initialScrollResetFrame);
    initialScrollResetFrame = 0;
  }
}

function clearInitialHash() {
  if (window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

function resetScrollPosition() {
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";

  try {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, 0);
  }

  root.scrollTop = 0;
  root.scrollLeft = 0;

  if (document.body) {
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }

  document.querySelectorAll(".work-detail, .feed-card__media-set").forEach((element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });

  root.style.scrollBehavior = previousScrollBehavior;
}

function render() {
  app.innerHTML = `
    <div class="portfolio-shell">
      ${renderEntryGate()}
      <header class="site-header" aria-label="Portfolio navigation">
        <nav class="filter-nav" aria-label="Primary navigation">
          ${filters.map(renderFilterButton).join("")}
        </nav>
        <div class="header-actions">
          <button class="text-button" type="button" data-theme-toggle>LIGHTS OFF</button>
          <a href="#photography" data-scroll-target="photography">PHOTOGRAPHY</a>
          <a href="#about" data-scroll-target="about">ABOUT</a>
          <a href="#contact" data-scroll-target="contact">CONTACT</a>
          <span>${profile.period}</span>
        </div>
      </header>

      ${renderWorkView()}
      ${renderPhotography()}

      <section class="about" id="about" aria-labelledby="about-title">
        <div>
          <p class="section-label">ABOUT</p>
          <h2 id="about-title">CREATIVE PROFESSIONAL BASED IN BARCELONA.</h2>
        </div>
        <p>${profile.intro}</p>
        <div class="about__blank" aria-hidden="true"></div>
      </section>

      <section class="contact" id="contact" aria-labelledby="contact-title">
        <div>
          <p class="section-label">CONTACT</p>
          <h2 id="contact-title">LET'S WORK TOGETHER.</h2>
        </div>
        <p>${profile.availability}</p>
        <div class="contact-links">
          ${Object.values(contact).map(renderContactLink).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderEntryGate() {
  if (hasEntered) return "";

  return `
    <div
      class="entry-gate"
      data-entry-gate
      data-enter-site
      role="button"
      tabindex="0"
      aria-label="Open portfolio"
    >
      <div class="entry-gate__layout" aria-hidden="true">
        <img class="entry-gate__photo" src="/photos/intro-2.jpg" alt="" />
        <span class="entry-gate__name">${profile.name} PORTFOLIO</span>
      </div>
    </div>
  `;
}

function renderWorkView() {
  const visibleProjects = getVisibleProjects();

  return `
    <section class="intro" aria-labelledby="page-title">
      <div class="intro__identity">
        <p>${profile.location}</p>
        <h1 id="page-title">${profile.name}</h1>
      </div>
    </section>

    <section class="work" aria-label="Selected work">
      <div class="project-feed" aria-label="Selected work feed">
        ${renderProjectCards(visibleProjects)}
      </div>
    </section>
  `;
}

function renderPhotography() {
  return `
    <section class="photography" id="photography" aria-labelledby="photography-title">
      <div class="photography__heading">
        <p class="section-label">STILLS / PERSONAL WORK</p>
        <h2 id="photography-title">PHOTOGRAPHY</h2>
      </div>
      ${photography.length ? `<div class="photography__grid">${photography.map((photo) => `
        <figure>
          <img src="${photo.src}" alt="${photo.alt}" loading="lazy" />
          ${photo.caption ? `<figcaption>${photo.caption}</figcaption>` : ""}
        </figure>`).join("")}</div>` : '<p class="photography__empty">A selection of photographs. Coming soon.</p>'}
    </section>
  `;
}

function bindEvents() {
  app.addEventListener("click", (event) => {
    const enterButton = event.target.closest("[data-enter-site]");
    if (enterButton) {
      enterPortfolio();
      return;
    }

    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
      setFilter(filterButton.dataset.filter);
      return;
    }

    const anchorLink = event.target.closest("[data-scroll-target]");
    if (anchorLink) {
      event.preventDefault();
      scrollToSection(anchorLink.dataset.scrollTarget);
      return;
    }

    const themeToggle = event.target.closest("[data-theme-toggle]");
    if (themeToggle) {
      document.documentElement.dataset.theme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      syncThemeButton();
    }
  });

  app.addEventListener("keydown", (event) => {
    const enterTarget = event.target.closest("[data-enter-site]");
    if (!enterTarget || !["Enter", " "].includes(event.key)) return;

    event.preventDefault();
    enterPortfolio();
  });
}

function enterPortfolio() {
  if (hasEntered) return;

  hasEntered = true;
  document.documentElement.dataset.entered = "true";
  const gate = document.querySelector("[data-entry-gate]");
  gate?.classList.add("is-exiting");
  setupCurrentMedia();

  window.setTimeout(() => {
    gate?.remove();
    setupCurrentMedia();
  }, 520);
}

function scrollToSection(sectionId) {
  const target = document.querySelector(`#${sectionId}`);
  if (!target) return;

  const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;
  const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function setFilter(nextFilter) {
  activeFilter = nextFilter;
  refreshView({ resetScroll: true });
}

function refreshView({ resetScroll = false } = {}) {
  render();
  syncThemeButton();
  setupCurrentMedia();

  if (resetScroll) {
    window.requestAnimationFrame(resetScrollPosition);
  }
}

function syncThemeButton() {
  const themeToggle = document.querySelector("[data-theme-toggle]");
  if (!themeToggle) return;

  const isDark = document.documentElement.dataset.theme === "dark";
  themeToggle.textContent = isDark ? "LIGHTS ON" : "LIGHTS OFF";
}

function getVisibleProjects() {
  const visibleProjects =
    activeFilter === "all"
      ? projects
      : projects.filter((project) => projectMatchesFilter(project, activeFilter));

  return [...visibleProjects].sort((firstProject, secondProject) => {
    return (firstProject.sortOrder ?? 999) - (secondProject.sortOrder ?? 999);
  });
}

function projectMatchesFilter(project, filterId) {
  return [project.category, ...(project.secondaryCategories ?? [])].includes(filterId);
}

function renderFilterButton(filter) {
  const isActive = filter.id === activeFilter;
  return `
    <button
      class="${isActive ? "is-active" : ""}"
      type="button"
      data-filter="${filter.id}"
      aria-pressed="${isActive}"
    >${filter.label}</button>
  `;
}

function renderProjectCards(visibleProjects) {
  return visibleProjects
    .map(
      (project, index) => `
        <article class="feed-card">
          <header class="feed-card__header">
            <span class="feed-card__avatar" aria-hidden="true">${getInitials(project.client)}</span>
            <div class="feed-card__title">
              <h2>${project.title}</h2>
              <p>${project.client} / ${project.year}</p>
            </div>
            <span class="feed-card__category">${String(index + 1).padStart(2, "0")}</span>
          </header>
          ${renderMediaSet(project.media, project.title, "feed")}
          <div class="feed-card__body">
            <p class="feed-card__caption"><strong>${project.role}</strong>${project.description}</p>
            <dl class="feed-card__meta">
              <div>
                <dt>TYPE</dt>
                <dd>${project.displayCategory}</dd>
              </div>
              <div>
                <dt>PLACE</dt>
                <dd>${project.location}</dd>
              </div>
            </dl>
            ${renderCreditLine(project.credits)}
            ${renderProjectLinks(project.links)}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderMediaSet(media, title, context) {
  const mediaItems = normalizeMedia(media);

  if (!mediaItems.length) return "";

  const setClass = context === "feed" ? "feed-card__media-set" : "project-media-set";
  const figureClass = context === "feed" ? "feed-card__media" : "project-media";
  const videoClass = context === "feed" ? "feed-card__video" : "project-media__video";
  const imageClass = context === "feed" ? "feed-card__image" : "project-media__image";
  const setModifier =
    mediaItems.length > 1 ? ` ${setClass}--multiple` : ` ${setClass}--single`;

  return `
    <div class="${setClass}${setModifier}" aria-label="${title} media">
      ${mediaItems
        .map((mediaItem, index) =>
          renderMediaItem(mediaItem, {
            figureClass,
            imageClass,
            label: `${title} preview ${index + 1}`,
            videoClass,
          }),
        )
        .join("")}
    </div>
  `;
}

function renderMediaItem(media, options) {
  if (media.type === "video") {
    return `
      <figure class="${options.figureClass}" aria-label="${options.label}">
        <video
          class="${options.videoClass} looping-video"
          muted
          loop
          playsinline
          preload="metadata"
          poster="${getVideoPosterSrc(media.src)}"
          disablepictureinpicture
          tabindex="-1"
          data-auto-video
          data-preview-start="${media.previewStart ?? 0}"
        >
          <source src="${media.src}"${media.mimeType ? ` type="${media.mimeType}"` : ""} />
        </video>
      </figure>
    `;
  }

  if (media.type === "image") {
    return `
      <figure class="${options.figureClass}" aria-label="${options.label}">
        <img class="${options.imageClass}" src="${media.src}" alt="${options.label}" loading="lazy" />
      </figure>
    `;
  }

  return "";
}

function getVideoPosterSrc(src) {
  return src.replace(/\.mp4($|\?)/i, ".jpg$1");
}

function normalizeMedia(media) {
  if (!media) return [];
  return Array.isArray(media) ? media : [media];
}

function setupCurrentMedia() {
  if (mediaObserver) {
    mediaObserver.disconnect();
    mediaObserver = null;
  }

  const videos = Array.from(document.querySelectorAll("[data-auto-video]")).filter(isElementVisible);
  if (!videos.length) return;

  if (!("IntersectionObserver" in window)) {
    videos.forEach(playLoopingVideo);
    return;
  }

  videos.forEach((video) => {
    video.dataset.loopingVisible = "false";
    video.pause();
  });

  mediaObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
          video.dataset.loopingVisible = "true";
          playLoopingVideo(video);
          return;
        }

        video.dataset.loopingVisible = "false";
        video.pause();
      });
    },
    { threshold: [0, 0.2, 0.6] },
  );

  videos.forEach((video) => {
    mediaObserver.observe(video);
  });
}

function scheduleMediaSetup() {
  if (resizeFrame) return;

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0;
    setupCurrentMedia();
  });
}

function isElementVisible(element) {
  return Boolean(element.getClientRects().length && element.offsetWidth && element.offsetHeight);
}

function playLoopingVideo(video) {
  video.dataset.loopingVisible = "true";
  video.autoplay = true;
  video.controls = false;
  video.defaultMuted = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("autoplay", "");
  video.setAttribute("loop", "");
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("preload", "auto");

  const primePreviewTime = () => {
    if (video.dataset.previewPrimed) return;

    const previewStart = Number(video.dataset.previewStart || 0);
    if (!previewStart) {
      video.dataset.previewPrimed = "true";
      return;
    }

    const maxStartTime = Number.isFinite(video.duration)
      ? Math.max(0, video.duration - 0.2)
      : previewStart;

    try {
      video.currentTime = Math.min(previewStart, maxStartTime);
    } catch {
      // Some browsers reject currentTime changes before enough video data is buffered.
    }

    video.dataset.previewPrimed = "true";
  };

  if (!video.dataset.loopingPrepared) {
    video.addEventListener("pause", () => {
      if (
        !video.ended &&
        document.visibilityState === "visible" &&
        video.dataset.loopingVisible !== "false"
      ) {
        window.setTimeout(() => playLoopingVideo(video), 80);
      }
    });
    video.dataset.loopingPrepared = "true";
  }

  const requestPlay = () => {
    if (document.visibilityState === "hidden" || video.dataset.loopingVisible === "false") return;

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      primePreviewTime();
    }

    const playRequest = video.play();

    if (playRequest?.catch) {
      playRequest.catch(() => {});
    }
  };

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestPlay();
  } else {
    video.addEventListener("loadedmetadata", primePreviewTime, { once: true });
    video.addEventListener("loadeddata", requestPlay, { once: true });
    video.addEventListener("canplay", requestPlay, { once: true });
  }
}

function renderCreditLine(credits = []) {
  if (!credits.length) return "";

  return `
    <div class="credit-line" aria-label="Credits">
      ${credits.map((credit) => `<span>${credit}</span>`).join("")}
    </div>
  `;
}

function renderProjectLinks(links = []) {
  if (!links.length) return "";

  return `
    <div class="detail-links">
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

function renderContactLink(item) {
  return `
    <a href="${item.url}" target="_blank" rel="noreferrer">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </a>
  `;
}

function getInitials(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}
