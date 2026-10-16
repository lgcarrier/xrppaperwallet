(() => {
  'use strict';

  const generateButton = document.getElementById('generate-paper-wallet');
  const status = document.getElementById('generation-status');
  const error = document.getElementById('generation-error');
  const result = document.getElementById('wallet-result');
  const template = document.getElementById('wallet-template');
  const printStatus = document.getElementById('print-status');
  const printError = document.getElementById('print-error');
  const artwork = {
    front: document.getElementById('front-artwork'),
    back: document.getElementById('back-artwork')
  };
  let ready = false;
  let generated = false;
  let printing = false;
  let printTrigger = null;
  const hasWallet = () => generated;

  const local = window.location.protocol === 'file:';
  document.documentElement.dataset.mode = local ? 'local' : 'hosted';
  document.body.classList.toggle('local-file', local);
  document.getElementById('local-notice').hidden = !local;
  document.getElementById('online-notice').hidden = local;
  document.getElementById('online-generator-link').hidden = local;

  function showError(element, message) {
    element.textContent = message;
    element.hidden = false;
  }

  function clearError(element) {
    element.hidden = true;
    element.textContent = '';
  }

  function dependenciesAvailable() {
    return typeof globalThis.crypto?.getRandomValues === 'function' &&
      typeof globalThis.xrpl?.Wallet?.generate === 'function' &&
      typeof globalThis.qrcode === 'function';
  }

  function imageReady(image) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (failed) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failedLoad);
        if (failed || !image.naturalWidth) reject(new Error('Artwork unavailable'));
        else resolve();
      };
      const loaded = () => finish(false);
      const failedLoad = () => finish(true);
      const timeout = setTimeout(failedLoad, 10000);
      image.addEventListener('load', loaded);
      image.addEventListener('error', failedLoad);
      if (image.complete) finish(!image.naturalWidth);
    }).then(() => image.decode ? image.decode() : undefined);
  }

  function makeQr(value, label) {
    const code = qrcode(0, 'H');
    code.addData(value, 'Byte');
    code.make();
    // The encoder generates SVG geometry only; credentials are never HTML.
    const svgDocument = new DOMParser().parseFromString(
      code.createSvgTag({ cellSize: 1, margin: 4, scalable: true }),
      'image/svg+xml'
    );
    if (svgDocument.querySelector('parsererror') ||
        svgDocument.documentElement.localName !== 'svg') {
      throw new Error('QR rendering failed');
    }
    const svg = document.importNode(svgDocument.documentElement, true);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
    return svg;
  }

  function prepareResult(wallet) {
    if (typeof wallet.seed !== 'string' || !wallet.seed.startsWith('sEd') ||
        !xrpl.isValidClassicAddress(wallet.classicAddress)) {
      throw new Error('Invalid generated wallet');
    }
    const addressQr = makeQr(wallet.classicAddress, 'Classic address QR code');
    const seedQr = makeQr(wallet.seed, 'Secret family seed QR code');
    const changes = [];
    const add = (selector, node) => {
      const element = result.querySelector(selector);
      if (!element) throw new Error('Wallet layout unavailable');
      changes.push({ element, nodes: [node] });
    };
    add('#wallet-address', document.createTextNode(wallet.classicAddress));
    add('#wallet-seed', document.createTextNode(wallet.seed));
    add('#address-qr', addressQr);
    add('#seed-qr', seedQr);
    add('#qrcode-address', addressQr.cloneNode(true));
    add('#qrcode-secret', seedQr.cloneNode(true));
    for (const n of [1, 2]) {
      add(`#cleartext-address-${n}`, document.createTextNode(wallet.classicAddress));
      add(`#cleartext-secret-${n}`, document.createTextNode(wallet.seed));
    }
    return changes;
  }

  function commitResult(changes) {
    const applied = [];
    try {
      for (const change of changes) {
        applied.push({ element: change.element, previous: [...change.element.childNodes] });
        change.element.replaceChildren(...change.nodes);
      }
    } catch (failure) {
      // Restore every changed credential if a DOM update fails. Artwork never
      // moves during generation: moving even loaded images can trigger requests.
      for (const change of applied.reverse()) {
        while (change.element.firstChild) change.element.removeChild(change.element.firstChild);
        change.element.append(...change.previous);
      }
      throw failure;
    }
  }

  function generatePaperWallet() {
    if (!ready || printing) return;
    const replacing = hasWallet();
    const context = local
      ? 'A local file does not prove this computer is offline. Disconnect from the internet; an air-gapped computer is safest.'
      : 'Online generation is less secure. The safest path is to download the ZIP, disconnect, and open index.html in a clean browser.';
    const warning = [
      context,
      'Anyone with the family seed can control the funds. Never share it or enter it on a website. Keep secure physical backups and verify recovery before sending larger amounts.',
      'This tool is provided as-is without warranties. You accept responsibility for its use. Review the source and the disclaimer below.',
      replacing ? 'Generating again will replace the wallet displayed here. Have you securely recorded the current wallet? Continue?' : 'Generate a new paper wallet?'
    ].join('\n\n');
    if (!window.confirm(warning)) return;

    clearError(error);
    try {
      if (!dependenciesAvailable()) throw new Error('Generation unavailable');
      // Browser cryptographic randomness only: no Client or network is needed.
      const prepared = prepareResult(xrpl.Wallet.generate(xrpl.ECDSA.ed25519));
      commitResult(prepared);
      generated = true;
      document.getElementById('paper-wallet').hidden = false;
      document.body.classList.add('has-wallet');
      generateButton.textContent = 'Generate another wallet';
      status.textContent = 'Wallet generated. Keep the family seed secret.';
      clearError(printError);
      printStatus.textContent = '';
      document.getElementById('result-heading').focus();
    } catch {
      // Dependency exceptions could contain credentials; never log them.
      status.textContent = 'Generation failed.';
      showError(error, replacing
        ? 'Could not generate a complete wallet. Your previous wallet is unchanged. Check the local files and use a current browser with cryptographic randomness.'
        : 'Could not generate a complete wallet. Check the local files and use a current browser with cryptographic randomness. No wallet was saved.');
    }
  }

  function setPrinting(value) {
    printing = value;
    generateButton.disabled = value || !ready;
    for (const button of result.querySelectorAll('[data-print-side]')) button.disabled = value;
  }

  function finishPrint() {
    const wasPrinting = printing;
    delete document.documentElement.dataset.printSide;
    setPrinting(false);
    if (wasPrinting) printStatus.textContent = 'Print dialog closed. Check your printed copy before storing it.';
    printTrigger?.focus({ preventScroll: true });
    printTrigger = null;
  }

  async function printWallet(side, trigger) {
    if (printing || !hasWallet() || !['front', 'back'].includes(side)) return;
    printTrigger = trigger;
    setPrinting(true);
    clearError(printError);
    printStatus.textContent = 'Preparing the print layout…';
    try {
      await imageReady(artwork[side]);
      if (document.fonts) await document.fonts.ready;
      document.documentElement.dataset.printSide = side;
      printStatus.textContent = 'Use landscape, actual size (100%), and turn off headers and footers.';
      window.print();
      // afterprint restores the UI after printing/cancellation, including
      // browsers whose print() returns before the dialog closes.
    } catch {
      finishPrint();
      printStatus.textContent = '';
      showError(printError, 'The print layout could not be prepared. Check that the local artwork files are intact and try again.');
    }
  }

  window.addEventListener('beforeprint', () => {
    if (!hasWallet()) return;
    document.documentElement.dataset.printSide ||= 'front';
    setPrinting(true);
  });
  window.addEventListener('afterprint', finishPrint);
  generateButton.addEventListener('click', generatePaperWallet);

  async function initialize() {
    if (!dependenciesAvailable()) {
      status.textContent = 'Generation unavailable.';
      showError(error, 'Local libraries or browser cryptographic randomness are unavailable. Extract the complete ZIP and use a current browser.');
      return;
    }
    try {
      // Instantiate the layout once, before readiness. Keep its images in place
      // for the lifetime of the page, including regeneration and printing.
      const initial = template.content.cloneNode(true);
      initial.querySelector('#paper-wallet').hidden = true;
      initial.querySelector('[data-artwork="front"]').replaceWith(artwork.front);
      initial.querySelector('[data-artwork="back"]').replaceWith(artwork.back);
      result.replaceChildren(initial);
      for (const button of result.querySelectorAll('[data-print-side]')) {
        button.addEventListener('click', () => printWallet(button.dataset.printSide, button));
      }
      await Promise.all(Object.values(artwork).map(imageReady));
      ready = true;
      generateButton.disabled = false;
      status.textContent = 'Ready. Generation runs entirely in this browser.';
    } catch {
      status.textContent = 'Generation unavailable.';
      showError(error, 'The wallet artwork could not load. Extract the complete ZIP with its folders intact, then reopen index.html.');
    }
  }
  initialize();
})();
