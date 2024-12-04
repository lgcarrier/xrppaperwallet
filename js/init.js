const client = new xrpl.Client('wss://s1.ripple.com/');

const printingCSS = '<link href="css/printing.css" rel="stylesheet" type="text/css">';

function printWallet(side) {
  window.frames["print_frame"].document.body.innerHTML = printingCSS + document.getElementById(side).outerHTML;
  window.frames["print_frame"].window.focus();
  setTimeout(function () {
    window.frames["print_frame"].window.print();
  }, 1000);
}

(function ($) {
  /**
   * displayGeneratedAddress
   */
  function displayGeneratedAddress(newAddress) {
    const generatedAddress = $('<ul></ul>').addClass('collection');
    generatedAddress.append('<li class="collection-item">Address:&nbsp;' + newAddress.classicAddress + '</li>');
    generatedAddress.append('<li class="collection-item">Secret:&nbsp;' + newAddress.seed + '</li>');
    generatedAddress.appendTo('#generated-paper-wallet');
  }

  /**
   * generateQrCodes
   */
  function generateQrCodes(newAddress) {
    const qrcodeAddress = document.getElementById('qrcode-address');
    const qrcodeSecret = document.getElementById('qrcode-secret');

    // clear previously created qrcodes
    qrcodeAddress.innerHTML = '';
    qrcodeSecret.innerHTML = '';

    new QRCode(qrcodeAddress, {
      text: newAddress.classicAddress,
      width: 100,
      height: 100,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    new QRCode(qrcodeSecret, {
      text: newAddress.seed,
      width: 125,
      height: 125,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  /**
   * addAddressPublic
   */
  function addAddressPublic(address) {
    const cleartextAddress1 = document.getElementById('cleartext-address-1');
    const cleartextAddress2 = document.getElementById('cleartext-address-2');
    cleartextAddress1.innerHTML = address;
    cleartextAddress2.innerHTML = address;
  }

  /**
   * addAddressSecret
   */
  function addAddressSecret(secret) {
    const cleartextSecret1 = document.getElementById('cleartext-secret-1');
    const cleartextSecret2 = document.getElementById('cleartext-secret-2');
    cleartextSecret1.innerHTML = secret;
    cleartextSecret2.innerHTML = secret;
  }

  /**
   * displayFrontPaperWallet
   */
  function displayFrontPaperWallet(newAddress) {
    generateQrCodes(newAddress);
    addAddressPublic(newAddress.classicAddress);
    addAddressSecret(newAddress.seed);
  }

  /**
   * displayBackPaperWallet
   */
  function displayBackPaperWallet() {}

  /**
   * displayPaperWallet
   */
  function displayPaperWallet(newAddress) {
    displayFrontPaperWallet(newAddress);
    displayBackPaperWallet();
    $('#paper-wallet').show();
    $('html,body').animate({scrollTop: $('#paper-wallet').offset().top - 50}, 'slow');
  }

  /**
   * Generate a paper wallet
   */
  async function generatePaperWallet() {
    try {
      await client.connect();
      const wallet = xrpl.Wallet.generate();
      displayPaperWallet(wallet);
    } catch (error) {
      console.error(error);
    } finally {
      await client.disconnect();
    }
  }

  function displayAccountStatus(status) {
    // TODO::LGCARRIER
    // inject the account status into the page
  }

  /**
   * validateAccountStatus
   */
  async function validateAccountStatus(account) {
    try {
      await client.connect();
      const response = await client.request({
        command: 'account_info',
        account: account
      });
      if (response.result) {
        displayAccountStatus('Account validated');
      }
    } catch (error) {
      if (error.data && error.data.error === 'actNotFound') {
        displayAccountStatus('Account not validated');
      }
    } finally {
      await client.disconnect();
    }
  }

  /**
   * displayAccountBalances
   */
  function displayAccountBalances(balances) {
    const mybalances = $('<ul></ul>').addClass('collection');
    balances.forEach(balance => {
      mybalances.append('<li class="collection-item">' + balance.currency + ':&nbsp;' + balance.value + '</li>');
    });
    mybalances.appendTo('#AccountBalances');
  }

  /**
   * getAccountBalances
   */
  async function getAccountBalances(account) {
    try {
      await client.connect();
      const response = await client.request({
        command: 'account_lines',
        account: account
      });
      displayAccountBalances(response.result.lines);
    } catch (error) {
      console.error(error);
    } finally {
      await client.disconnect();
    }
  }

  /**
   * init the visual theme
   */
  function initTheme() {
    $('.button-collapse').sideNav();
    $('.parallax').parallax();
  }

  function bindEvents() {
    $('#generate-paper-wallet').click(() => {
      generatePaperWallet();
    });
  }

  $(function () {
    initTheme();
    bindEvents();
  });
})(jQuery);