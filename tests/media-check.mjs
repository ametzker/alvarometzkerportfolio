import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    await page.addInitScript(() => {
      window.entryPlayback = [];
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        window.entryPlayback.push({ active: navigator.userActivation.isActive, src: this.querySelector('source')?.src });
        return originalPlay.call(this);
      };
    });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('.feed-card__avatar').first().textContent(), 'S');
    assert.equal(await page.evaluate(() => window.entryPlayback.length), 0, 'No playback before entering');
    await page.locator('[data-enter-site]').click();
    assert.equal(await page.evaluate(() => window.entryPlayback[0]?.active), true, 'Entry click must start playback with user activation');
    await page.locator('[data-entry-gate]').waitFor({ state: 'detached' });
    const videos = page.locator('video');
    assert.equal(await videos.count(), 8);
    for (let index = 0; index < await videos.count(); index++) {
      const video = videos.nth(index);
      await video.scrollIntoViewIfNeeded();
      await page.waitForFunction(index => {
        const v = document.querySelectorAll('video')[index];
        const poster = v.parentElement.querySelector('.video-preview__poster');
        return poster.complete && poster.naturalWidth > 0 && !v.paused && v.readyState >= 2
          && v.parentElement.classList.contains('is-playing');
      }, index, { timeout: 15000 });
      const time = await video.evaluate(v => v.currentTime);
      await page.waitForTimeout(300);
      assert.notEqual(await video.evaluate(v => v.currentTime), time, 'Video time should advance');
    }
    await page.close();
    console.log(`All 8 posters load and videos play at ${width}px.`);
  }
  const page = await browser.newPage();
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
  });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-enter-site]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.video-preview__poster')].every(img =>
    img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === '1'));
  console.log('All posters remain visible when autoplay is blocked.');
  await page.close();
} finally {
  await browser.close();
}
