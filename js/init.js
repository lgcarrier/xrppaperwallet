console.log(ripple);
var api = new ripple.RippleAPI({
  server: 'wss://s1.ripple.com/'
});

printingCSS = new String('<link href="css/printing.css" rel="stylesheet" type="text/css">')

function printWallet(side) {
  window.frames["print_frame"].document.body.innerHTML = printingCSS + document.getElementById(side).outerHTML;
  window.frames["print_frame"].window.focus();
  setTimeout(function () {
    window.frames["print_frame"].window.print();
  }, 1000);
}

(function ($) {

  /**
   * config
   */
  var config = config || {};

  config.wallets = {
    'tip': '',
    'new': ''
  };

  /**
   * set current account using an hardcoded
   */
  var account = config.wallets.new;


  /**
   * displayGeneratedAddress
   */
  function displayGeneratedAddress(newAddress) {
    var generatedAddress = $('<ul></ul>').addClass('collection');

    generatedAddress.append('<li class="collection-item">Address:&nbsp;' + newAddress.address + '</li>')
    generatedAddress.append('<li class="collection-item">Secret:&nbsp;' + newAddress.secret + '</li>')

    generatedAddress.appendTo('#generated-paper-wallet')
  }

  /**
   * generateQrCodes
   */
  function generateQrCodes(newAddress) {
    var qrcodeAddress = document.getElementById('qrcode-address');
    var qrcodeSecret = document.getElementById('qrcode-secret');

    // clear previously created qrcodes
    qrcodeAddress.innerHTML = '';
    qrcodeSecret.innerHTML = '';

    var qrcode = new QRCode(qrcodeAddress, {
      text: newAddress.address,
      width: 100,
      height: 100,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    var qrcode = new QRCode(qrcodeSecret, {
      text: newAddress.secret,
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
    var cleartextAddress1 = document.getElementById('cleartext-address-1');
    var cleartextAddress2 = document.getElementById('cleartext-address-2');
    cleartextAddress1.innerHTML = address;
    cleartextAddress2.innerHTML = address;
  }

  /**
   * addAddressSecret
   */
  function addAddressSecret(secret) {
    var cleartextSecret1 = document.getElementById('cleartext-secret-1');
    var cleartextSecret2 = document.getElementById('cleartext-secret-2');
    cleartextSecret1.innerHTML = secret;
    cleartextSecret2.innerHTML = secret;
  }

  /**
   * displayFrontPaperWallet
   */
  function displayFrontPaperWallet(newAddress) {
    generateQrCodes(newAddress);
    addAddressPublic(newAddress.address);
    addAddressSecret(newAddress.secret);
  }

  /**
   * displayBackPaperWallet
   */
  function displayBackPaperWallet() {}

  /**
   * displayBackPaperWallet
   */
  function displayPaperWallet(newAddress) {
    displayFrontPaperWallet(newAddress);
    displayBackPaperWallet();
    $('#paper-wallet').show();
  }

  /**
   * Generate a paper wallet
   */
  function generatePaperWallet() {
    api.connect().then(() => {
      console.log('generateAddress');
      return api.generateAddress();
    }).then(newAddress => {
      console.log(newAddress);
      displayPaperWallet(newAddress);
      console.log('generateAddress done');
    }).then(() => {
      // return api.disconnect();
    }).then(() => {
      // console.log('done and disconnected.');
    }).catch(console.error);
  }

  function displayAccountStatus(status) {
    // TODO::LGCARRIER
    // inject the account status into the page
  }

  /**
   * validateAccountStatus
   */
  function validateAccountStatus(account) {
    api.connect().then(() => {
      return api.getBalances(account);
    }).then(balances => {}).then(() => {
      displayAccountStatus('Account validated');
    }).catch((error) => {
      if (error.name == 'RippledError' && error.message == 'actNotFound') {
        displayAccountStatus('Account not validated');
      }
    });
  }

  /**
   * displayAccountBalances
   */
  function displayAccountBalances(balances) {
    var mybalances = $('<ul></ul>').addClass('collection');
    // mybalances.append('<li class="collection-header"><h4>balances</h4></li>');

    _.each(balances, function (balance) {
      mybalances.append('<li class="collection-item">' + balance.currency + ':&nbsp;' + balance.value + '</li>')
    });

    mybalances.appendTo('#AccountBalances');
  }

  /**
   * getAccountBalances
   */
  function getAccountBalances(account) {
    api.connect().then(() => {
      console.log('getting balances for', account);
      return api.getBalances(account);
    }).then(balances => {
      console.log(balances);
      displayAccountBalances(balances);

      console.log('getBalances done');
    }).then(() => {
      // return api.disconnect();
    }).then(() => {
      // console.log('done and disconnected.');
    }).catch(console.error);
  }

  /**
   * init the visual theme
   */
  function initTheme() {
    $('.button-collapse').sideNav();
    $('.parallax').parallax();
  }

  function bindEvents() {
    $('#generate-paper-wallet').click(function () {
      generatePaperWallet();
    });
  }



  $(function () {
    initTheme();
    bindEvents();
    // getAccountBalances(account);

    // api.connect().then(function () {
    //   return api.getServerInfo();
    // }).then(function (server_info) {
    //   document.body.innerHTML += "<p>Connected to rippled server!</p>" +
    //     "      <table>" +
    //     "        <tr><th>Version</th>" +
    //     "          <td>" + server_info.buildVersion + "</td></tr>" +
    //     "        <tr><th>Ledgers available</th>" +
    //     "          <td>" + server_info.completeLedgers + "</td></tr>" +
    //     "        <tr><th>hostID</th>" +
    //     "          <td>" + server_info.hostID + "</td></tr>" +
    //     "        <tr><th>Most Recent Validated Ledger Seq.</th>" +
    //     "          <td>" + server_info.validatedLedger.ledgerVersion + "</td></tr>" +
    //     "        <tr><th>Most Recent Validated Ledger Hash</th>" +
    //     "          <td>" + server_info.validatedLedger.hash + "</td></tr>" +
    //     "        <tr><th>Seconds since last ledger validated</th>" +
    //     "          <td>" + server_info.validatedLedger.age + "</td></tr>" +
    //     "      </table>";
    // });

    // api.connect().then(() => {
    //   console.log('getting account info for', account);
    //   return api.getAccountInfo(account);
    // }).then(info => {
    //   console.log(info);
    //   document.body.innerHTML += info.xrpBalance;
    //   console.log('getAccountInfo done');
    // }).then(() => {
    //   // return api.disconnect();
    // }).then(() => {
    //   // console.log('done and disconnected.');
    // }).catch(console.error);

  }); // end of document ready
})(jQuery); // end of jQuery name space