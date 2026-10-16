const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const { test, expect } = require('@playwright/test');
const { createSite, trackedPage, generate, credentials, assertNoAPINetwork } = require('./helpers.cjs');

let site;
test.beforeAll(async () => { site = await createSite(); });
test.afterAll(async () => { await site?.close(); });

for (const format of ['Letter', 'A4']) {
  for (const side of ['front', 'back']) {
    test(`${format} ${side}: one printable page with intact artwork and credentials`, async ({ browser }, testInfo) => {
      const { context, page, requests } = await trackedPage(browser, { offline: true });
      try {
        await page.goto(site.file);
        await generate(page);
        const expected = await credentials(page);
        await page.locator(`button[data-print-side="${side}"]`).click();
        await expect.poll(() => page.evaluate(() => window.__prints.length)).toBe(1);
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.printSide || '')).toBe('');
        // PDF emulation uses the same selection and CSS as the real print action.
        await page.evaluate(selected => { document.documentElement.dataset.printSide = selected; }, side);
        await page.emulateMedia({ media: 'print' });
        const artwork = page.locator(`#wallet-${side}`);
        const geometry = await artwork.boundingBox();
        expect(geometry.width).toBeCloseTo(250 * 96 / 25.4, 0);
        expect(geometry.height).toBeCloseTo((250 * 971 / 2962) * 96 / 25.4, 0);
        await expect(page.locator(`#wallet-${side === 'front' ? 'back' : 'front'}`)).toBeHidden();
        if (side === 'front') {
          for (const selector of ['#cleartext-address-1', '#cleartext-address-2', '#cleartext-secret-1', '#cleartext-secret-2']) {
            const label = page.locator(selector);
            const box = await label.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(geometry.x);
            expect(box.y).toBeGreaterThanOrEqual(geometry.y);
            expect(box.x + box.width).toBeLessThanOrEqual(geometry.x + geometry.width + 0.5);
            expect(box.y + box.height).toBeLessThanOrEqual(geometry.y + geometry.height + 0.5);
            expect(await label.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(8 * 96 / 72);
          }
        }
        const pdf = testInfo.outputPath(`${format.toLowerCase()}-${side}.pdf`);
        fs.mkdirSync(path.dirname(pdf), { recursive: true });
        await page.pdf({ path: pdf, format, landscape: true, printBackground: true, displayHeaderFooter: false, margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } });
        const info = execFileSync(process.env.PDFINFO || 'pdfinfo', [pdf], { encoding: 'utf8' });
        expect(info).toMatch(/Pages:\s+1\b/);
        const [, pageWidth, pageHeight] = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
        // Chromium rounds A4 CSS/point conversions; allow < 0.5 mm of rounding.
        const expectedSize = format === 'Letter' ? [792, 612] : [841.89, 595.28];
        expect(Math.abs(Number(pageWidth) - expectedSize[0])).toBeLessThan(1.4);
        expect(Math.abs(Number(pageHeight) - expectedSize[1])).toBeLessThan(1.4);
        const raster = pdf.replace(/\.pdf$/, '');
        execFileSync(process.env.PDFTOPPM || 'pdftoppm', ['-singlefile', '-r', '300', '-png', pdf, raster]);
        const png = PNG.sync.read(fs.readFileSync(`${raster}.png`));
        if (side === 'front') {
          const values = [];
          for (let index = 0; index < 2; index++) {
            const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' });
            expect(Boolean(decoded), 'each QR must decode from the actual rasterized PDF').toBe(true);
            values.push(decoded.data);
            const corners = [decoded.location.topLeftCorner, decoded.location.topRightCorner, decoded.location.bottomLeftCorner, decoded.location.bottomRightCorner];
            const left = Math.max(0, Math.floor(Math.min(...corners.map(point => point.x))) - 20);
            const right = Math.min(png.width, Math.ceil(Math.max(...corners.map(point => point.x))) + 20);
            const top = Math.max(0, Math.floor(Math.min(...corners.map(point => point.y))) - 20);
            const bottom = Math.min(png.height, Math.ceil(Math.max(...corners.map(point => point.y))) + 20);
            // Mask the first QR only in memory so the second can be decoded independently.
            for (let y = top; y < bottom; y++) png.data.fill(255, (y * png.width + left) * 4, (y * png.width + right) * 4);
          }
          expect(values.includes(expected.address), 'printed address QR contains the complete address').toBe(true);
          expect(values.includes(expected.seed), 'printed seed QR contains the complete seed').toBe(true);
        }
        await assertNoAPINetwork(page);
        expect(requests).toEqual([]);
      } finally { await context.close(); }
    });
  }
}
