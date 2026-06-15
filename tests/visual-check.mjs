import { chromium, devices } from "@playwright/test";

const baseURL = process.env.TEST_URL ?? "http://127.0.0.1:5173";

const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 960 }, object: "sony" },
  { name: "mobile", viewport: devices["iPhone 14"].viewport, object: "macbook", isMobile: true },
];

const browser = await chromium.launch();

for (const config of viewports) {
  const page = await browser.newPage({
    viewport: config.viewport,
    isMobile: Boolean(config.isMobile),
    hasTouch: Boolean(config.isMobile),
  });

  page.on("pageerror", (error) => {
    throw error;
  });

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__portfolioDebug), null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const width = canvas.width;
    const height = canvas.height;
    const sampleWidth = Math.min(width, 320);
    const sampleHeight = Math.min(height, 220);
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
    context.readPixels(
      Math.floor((width - sampleWidth) / 2),
      Math.floor((height - sampleHeight) / 2),
      sampleWidth,
      sampleHeight,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );

    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 24) lit += 1;
    }

    return {
      lit,
      total: pixels.length / 4,
      width,
      height,
    };
  });

  if (pixels.width < config.viewport.width || pixels.height < config.viewport.height) {
    throw new Error(`${config.name}: canvas backing store is smaller than expected`);
  }

  if (pixels.lit / pixels.total < 0.03) {
    throw new Error(`${config.name}: canvas appears blank`);
  }

  const position = await page.evaluate((objectName) => {
    return window.__portfolioDebug.getObjectScreenPosition(objectName);
  }, config.object);

  if (!position || position.x < 0 || position.y < 0) {
    throw new Error(`${config.name}: ${config.object} was not projected into the viewport`);
  }

  if (config.isMobile) {
    await page.touchscreen.tap(position.x, position.y);
  } else {
    await page.mouse.move(position.x, position.y);
    await page.mouse.click(position.x, position.y);
  }

  await page.waitForSelector(".section-panel.is-visible", { timeout: 5000 });
  await page.close();
}

await browser.close();
console.log("Visual checks passed for desktop and mobile.");
