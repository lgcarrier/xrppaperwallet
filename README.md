# XRP Paper Wallet

A small, offline-first tool for generating an XRP Ledger classic address and
Ed25519 family seed, with QR codes and printable front/back artwork. It runs
directly from `index.html`; no installation, build, account, or server is needed.

**Use the downloaded tool while fully offline whenever possible.** The
[hosted generator](https://xrppaperwallet.com/) remains available, but using it
online carries more risk: the page may be changed before it reaches you, and
other browser software may observe your activity. Local generation also depends
on the integrity of the downloaded files, browser, operating system, and printer.

## Recommended offline workflow

1. [Download the latest GitHub ZIP](https://github.com/lgcarrier/xrppaperwallet/archive/refs/heads/master.zip)
   and extract it. Keep the extracted folders together; `index.html` needs its
   local scripts, stylesheet, and images. Review the source and
   [dependency checksums](vendor/README.md) while still online if appropriate.
2. Disconnect the computer from the internet, including Wi-Fi and Ethernet.
   Prefer an air-gapped computer where possible. A `file://` address alone does
   **not** prove the computer is disconnected.
3. Open the extracted `index.html` in a clean, up-to-date browser, without
   untrusted extensions. A private window does not make a compromised browser
   or computer safe.
4. Select **Generate wallet**, read the confirmation, and generate the wallet.
   The classic address can be shared to receive XRP. The family seed is secret
   and controls the funds; both fields also have QR codes.
5. Print the front and back as described below, or carefully write down both
   values. Verify every character, and verify a recovery before transferring a
   significant amount. Never use a wallet printed in documentation or test output.
6. Keep multiple copies in different secure physical locations. For larger
   holdings, consider a suitable metal backup. Protect backups from theft,
   photography, fire, and water. Close the page when finished; closing it is not
   a guarantee that the device, printer, or operating system has erased all traces.

Never share or photograph the seed. Never enter it on an arbitrary website.
Recover only using trusted wallet software under your control, obtained from
its official source. Read the
[XRPL offline account setup tutorial](https://xrpl.org/docs/tutorials/best-practices/key-management/offline-account-setup)
before storing funds offline.

## Funding and reserves

Generating a key pair does not create an account on the ledger. An ordinary new
Mainnet account becomes active after a validated incoming XRP payment meets the
current base reserve: **1 XRP (1,000,000 drops)**. The owner reserve is currently
**0.2 XRP (200,000 drops)** per reserve-counted object; some objects have special
reserve rules. The base reserve is a minimum balance requirement, not a payment
to this site.

Reserve requirements are set by validators and can change. Check the
[official reserves documentation](https://xrpl.org/reserves.html) before funding.
Start with a small transfer meeting the current activation minimum, verify the
address and recovery, and only then send a larger balance. This offline tool
does not connect to the ledger to check funding, balances, or current reserves.

## Printing

- Select **Print front** or **Print back** after generating. Print one side at a
  time; automatic duplex alignment is not provided.
- Choose Letter or A4, **landscape**, **actual size / 100%**, and disable browser
  headers and footers. The artwork is 250 mm wide and approximately 81.96 mm high,
  with a requested 10 mm page margin. Printer settings can override page CSS;
  confirm the preview before printing.
- Use an offline printer without cloud printing. Printers and spoolers may retain
  jobs; use equipment you control and understand. Do not save the seed in an
  online PDF service or upload it for printing.
- Inspect the printed address and seed for clipping, and scan both QR codes using
  trusted offline software. The public address QR encodes only the exact address;
  the secret QR encodes only the exact seed. Do not scan a funded seed into a
  general-purpose online scanner.

The original wallet artwork is preserved. Credential text and QR codes are
rendered over it; the QR codes are SVG with a four-module white quiet zone.
The preparation banner uses a locally bundled, generated WebP image. It is
decorative and does not appear on the printed wallet.

## Security changes

- Wallet generation calls `xrpl.Wallet.generate()` locally with Ed25519. It does
  not construct an XRPL client, open a WebSocket, or query an account.
- Runtime dependencies are pinned and bundled locally: `xrpl.js@5.3.0` and
  `qrcode-generator@2.0.4`. See [source provenance, licenses, and verification
  commands](vendor/README.md).
- Analytics, price widgets, remote fonts, CDN scripts, and obsolete UI libraries
  have been removed. A Content Security Policy blocks network connections and
  remote assets. Normal external links only navigate when deliberately followed.
- Generation requires browser cryptographic randomness and loaded dependencies.
  Credentials are not logged or intentionally saved in cookies, browser storage,
  or a remote service. They remain visible in the current page until replaced or
  closed; this is not a guarantee of memory erasure.
- Confirmation is required before generation and replacement. Cancellation or a
  generation error preserves an existing complete wallet.

Offline use reduces exposure; it cannot protect against compromised hardware,
software, downloads, or physical access. Review the disclaimer on the page.

## Development and validation

End users do not need Node.js or any of these tools. Developers need a current
Node.js version supported by the pinned test packages. Install tooling while
online, and use only disposable, unfunded credentials during tests.

```sh
npm ci --ignore-scripts
npx playwright install chromium firefox webkit
npm test
PLAYWRIGHT_BROWSER=firefox npm test
PLAYWRIGHT_BROWSER=webkit npm test
npm run test:print
```

Print validation uses Poppler (`pdftoppm` and `pdfinfo`) to inspect rendered PDF
pages and decode printed QR codes. Install it through your platform's package
manager if it is unavailable; browser-only tests do not require it. Set
`PDFINFO` and `PDFTOPPM` to executable paths if these commands are not on `PATH`.
`npm test` uses pinned Chromium by default; `PLAYWRIGHT_CHANNEL=chrome npm test`
uses an installed Google Chrome instead. The other two commands explicitly test
Firefox and WebKit. CSS zoom checks reflow at 200%; they do not simulate a
physical device or every browser zoom setting.

The automated checks cover local-file and hosted generation, attempted network
calls, independent seed-to-address recovery, QR decoding, error and cancellation
paths, mobile layout, accessibility-related behavior, and print output. Consult
the test results for the browsers and checks actually completed in your
environment. Independent recovery uses `xrpl-accountlib@9.4.0`; QR decoding uses
`jsqr@1.4.0`. All test packages are development-only and locked in
`package-lock.json`. The recovery library currently has six low-severity npm
advisories in its transitive dependencies, with no patched upgrade reported.
These development-only packages are never loaded by the generator; use only
disposable credentials in the test suite.

Browser/PDF checks do not prove a physical printer's output. Actual import into a
mobile wallet and physical-printer testing are separate manual checks, and are
not claimed by the automated test suite. Keep test credentials, screenshots, and
PDFs out of source control.

## Credits

Made by **Louis-Guillaume Carrier-Bédard**.

- [xrpl.js](https://github.com/XRPLF/xrpl.js), ISC license.
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT license.
- Legacy unused canyon photograph retained in `img/background1.jpg`: photograph
  by Moondigger (2005-04-16), CC BY-SA 2.5; it is not loaded by the page.
- Original paper-wallet design inspiration:
  [Bitcoin Paper Wallet Generator](https://github.com/cantonbecker/bitcoinpaperwallet).

The website retains a disclosed [Newton referral link](https://web.newton.co/r/ZPYBU6)
and a link to [RLUSD Market](https://www.rlusdmarket.com). They are optional external
links and are not required for generation or recovery.
