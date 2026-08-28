import { chromium, devices } from "@playwright/test";

const baseURL = process.env.TEST_URL ?? "http://127.0.0.1:5173";

const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 960 } },
  { name: "mobile", viewport: devices["iPhone 14"].viewport, isMobile: true },
];

const browser = await chromium.launch();

for (const config of viewports) {
  const page = await browser.newPage({
    viewport: config.viewport,
    isMobile: Boolean(config.isMobile),
    hasTouch: Boolean(config.isMobile),
  });

  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-enter-site]", { timeout: 10000 });
  await page.click("[data-enter-site]");
  await page.waitForFunction(() => !document.querySelector("[data-entry-gate]"), null, {
    timeout: 2000,
  });
  await page.waitForSelector(config.isMobile ? ".feed-card" : ".project-row", { timeout: 10000 });

  const initialReport = await page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent,
    rows: document.querySelectorAll(".project-row").length,
    feedCards: document.querySelectorAll(".feed-card").length,
    hasGalleryButton: Boolean(document.querySelector('[data-view="gallery"]')),
    hasCanvas: Boolean(document.querySelector("canvas")),
    visibleVideos: Array.from(document.querySelectorAll("[data-auto-video]")).filter(
      (video) => video.getClientRects().length && video.offsetWidth && video.offsetHeight,
    ).length,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  if (initialReport.title !== "ALVARO METZKER") {
    throw new Error(`${config.name}: portfolio title did not render`);
  }

  if (initialReport.rows < 4) {
    throw new Error(`${config.name}: project index rendered too few rows`);
  }

  if (initialReport.feedCards < 4) {
    throw new Error(`${config.name}: mobile feed rendered too few cards`);
  }

  if (initialReport.hasGalleryButton) {
    throw new Error(`${config.name}: gallery tab is still present`);
  }

  if (initialReport.hasCanvas) {
    throw new Error(`${config.name}: legacy 3D canvas is still present`);
  }

  if (initialReport.visibleVideos < 1) {
    throw new Error(`${config.name}: no visible autoplay media rendered`);
  }

  if (initialReport.overflowX) {
    throw new Error(`${config.name}: page has horizontal overflow`);
  }

  await page.click('[data-filter="commercial"]');
  if (!config.isMobile) {
    await page.click('[data-project-id="sopmod-v2-spot"]');
  }
  await page.click("[data-theme-toggle]");

  const interactionReport = await page.evaluate(() => ({
    activeTitle: document.querySelector(".detail-heading h2")?.textContent,
    firstFeedTitle: document.querySelector(".feed-card h2")?.textContent,
    activeFilter: document.querySelector('[data-filter="commercial"]')?.getAttribute("aria-pressed"),
    theme: document.documentElement.dataset.theme,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  const renderedCommercialTitle = config.isMobile
    ? interactionReport.firstFeedTitle
    : interactionReport.activeTitle;

  if (renderedCommercialTitle !== "SOPMOD V2 SPOT") {
    throw new Error(`${config.name}: selected project detail did not update`);
  }

  if (interactionReport.activeFilter !== "true") {
    throw new Error(`${config.name}: active filter state did not update`);
  }

  if (interactionReport.theme !== "dark") {
    throw new Error(`${config.name}: theme toggle did not switch to dark mode`);
  }

  if (interactionReport.overflowX) {
    throw new Error(`${config.name}: interaction created horizontal overflow`);
  }

  if (errors.length) {
    throw new Error(`${config.name}: ${errors.join("; ")}`);
  }

  await page.close();
}

await browser.close();
console.log("Visual checks passed for desktop and mobile.");
