/* global confirm, document, navigator, location, window */

var utility = require('../utility/utility.js'),
  Connection = require('../Connection.js'),
  _ = require('underscore');

//--------------------- Initialization ----------//

/**
 * @class Auth: handling Pryv authentication through browser popup
 * */
var Auth = function () {};

_.extend(Auth.prototype, {
  connection: null, // actual connection managed by Auth
  config: {
    // TODO: clean up this hard-coded mess and rely on the one and only Pryv URL domains reference
    registerURL: {ssl: true, host: 'reg.pryv.me'},
    sdkFullPath: 'https://api.pryv.com/lib-javascript/latest'
  },
  state: null,  // actual state
  window: null,  // popup window reference (if any)
  spanButton: null, // an element on the app web page that can be controlled
  buttonHTML: '',
  onClick: {}, // functions called when button is clicked
  settings: null,
  pollingID: false,
  pollingIsOn: true, // may be turned off if we can communicate between windows
  cookiesForceDisable: false,
  cookieEnabled: false,
  ignoreStateFromURL: false // turned to true in case of loggout
});

// Initialize style sheet and supported languages
utility.loadExternalFiles(Auth.prototype.config.sdkFullPath +
  '/assets/buttonSigninPryv.css', 'css');
Auth.prototype.uiSupportedLanguages = ['en', 'fr'];

/**
 * Setup the authentication process
 * //TODO check settings
 * @param settings: initialization settings
 * @returns {Connection}: the connection managed by Auth.
 *  A new one is created each time setup is called.
 */
Auth.prototype.setup = function (settings) {
  this.state = null;

  this.cookiesForceDisable = settings.cookiesForceDisable || false;
  this._checkCookies();

  settings.languageCode =
    utility.getPreferredLanguage(this.uiSupportedLanguages, settings.languageCode);

  // ReturnURL
  settings.returnURL = settings.returnURL || 'auto#';
  if (settings.returnURL) {
    // Check the trailer
    var trailer = settings.returnURL.charAt(settings.returnURL.length - 1);
    if ('#&?'.indexOf(trailer) < 0) {
      throw new Error('Pryv access: Last character of --returnURL setting-- is not ' +
        '"?", "&" or "#": ' + settings.returnURL);
    }

    // Set self as return url?
    if((settings.returnURL.indexOf('auto') === 0 && utility.browserIsMobileOrTablet()) ||
      (settings.returnURL.indexOf('self') === 0)) {
        settings.returnURL = this._cleanStatusFromURL();
        // If not already ending by &
        if (settings.returnURL.slice(-1) !== '&') {
          // If already containing ? or #, add a &
          if (settings.returnURL.indexOf('?') > -1 || settings.returnURL.indexOf('#') > -1) {
            settings.returnURL += '&';
          } 
          // If no, add a #
          else {
            settings.returnURL += '#';
          }
        }      
    } else if(settings.returnURL.indexOf('auto') === 0 && !utility.browserIsMobileOrTablet()) {
      settings.returnURL = false;
    }

    if (settings.returnURL && settings.returnURL.indexOf('http') < 0) {
      throw new Error('Pryv access: --returnURL setting-- does not start with http: ' +
        settings.returnURL);
    }
  }

  this.settings = settings;

  // TODO: Clean up this hard-coded mess and rely on the one and only Pryv URL domains reference
  var z =  this.config.registerURL.host;
  this.settings.domain = z.substring(z.indexOf('.') + 1);

  var params = {
    requestingAppId : settings.requestingAppId,
    requestedPermissions : settings.requestedPermissions,
    languageCode : settings.languageCode,
    returnURL : settings.returnURL
  };

  // Advanced dev. option for oauth
  if (settings.oauthState) {
    params.oauthState = settings.oauthState;
  }

  // Advanced dev. option for local testing with rec-la
  if (this.config.reclaDevel) {
    // Return url will be forced to https://se.rec.la + reclaDevel
    params.reclaDevel = this.config.reclaDevel;
  }

  this.stateInitialization();

  this.connection = new Connection({
    username: null,
    auth: null,
    ssl: true,
    domain: this.settings.domain});
  // Look if we have a returning user (document.cookie)
  var cookieUserName = this.cookieEnabled ?
    utility.docCookies.getItem('access_username' + this.settings.domain) : false;
  var cookieToken = this.cookieEnabled ?
    utility.docCookies.getItem('access_token' + this.settings.domain) : false;

  // Look in the URL if we are returning from a login process
  var stateFromURL =  this._getStatusFromURL();

  if (stateFromURL && (! this.ignoreStateFromURL)) {
    this.stateChanged(stateFromURL);
  } else if (cookieToken && cookieUserName) {
    this.stateChanged({status: 'ACCEPTED', username: cookieUserName,
      token: cookieToken, domain: this.settings.domain});
  } else {
    // Launch process
    var pack = {
      path :  '/access',
      params : params,
      success : function (data)  {
        if (data.status && data.status !== 'ERROR') {
          this.stateChanged(data);
        } else {
          // TODO call shouldn't failed
          this.internalError('/access Invalid data: ', data);
        }
      }.bind(this),
      error : function (jsonError) {
        this.internalError('/access ajax call failed: ', jsonError);
      }.bind(this)
    };

    utility.request(_.extend(pack, this.config.registerURL));

  }

  return this.connection;
};

//--------------------- UI Content -----------//

/**
 * Generate Pryv login button
 * @param onClick: id of the event to trigger when button is clicked
 * @param buttonText: button label
 * @returns {string}: html code of the generated Pryv button
 */
Auth.prototype.uiButton = function (onClick, buttonText) {
  if (utility.supportCSS3()) {
    return '<div id="pryv-access-btn" class="pryv-access-btn-signin" data-onclick-action="' +
      onClick + '">' +
      '<a class="pryv-access-btn pryv-access-btn-pryv-access-color" href="#">' +
      '<span class="logoSignin">Y</span></a>' +
      '<a class="pryv-access-btn pryv-access-btn-pryv-access-color"  href="#"><span>' +
      buttonText + '</span></a></div>';
  } else   {
    return '<a href="#" id ="pryv-access-btn" data-onclick-action="' + onClick +
      '" class="pryv-access-btn-signinImage" ' +
      'src="' + this.config.sdkFullPath + '/assets/btnSignIn.png" >' + buttonText + '</a>';
  }
};

/**
 * Error button
 */
Auth.prototype.uiErrorButton = function () {
  var strs = {
    'en': { 'msg': 'Error :(' },
    'fr': { 'msg': 'Erreur :('}
  }[this.settings.languageCode];
  this.onClick.Error = function () {
    this.logout();
    return false;
  }.bind(this);
  return this.uiButton('Error', strs.msg);
};

/**
 * Loading button
 */
Auth.prototype.uiLoadingButton = function () {
  var strs = {
    'en': { 'msg': 'Loading...' },
    'fr': { 'msg': 'Chargement...'}
  }[this.settings.languageCode];
  this.onClick.Loading = function () {
    return false;
  };
  return this.uiButton('Loading', strs.msg);

};

/**
 * Signin Button
 */
Auth.prototype.uiSigninButton = function () {
  var strs = {
    'en': { 'msg': 'Sign in' },
    'fr': { 'msg': 'S\'identifier' }
  }[this.settings.languageCode];
  this.onClick.Signin = function () {
    this.popupLogin();
    return false;
  }.bind(this);
  return this.uiButton('Signin', strs.msg);

};

/**
 * Signout Button
 */
Auth.prototype.uiConfirmLogout = function () {
  var strs = {
    'en': { 'logout': 'Sign out?'},
    'fr': { 'logout': 'Se déconnecter?'}
  }[this.settings.languageCode];

  if (confirm(strs.logout)) {
    this.logout();
  }
};

/**
 * Confirm logout Button
 * @param username: user to be logout
 */
Auth.prototype.uiInButton = function (username) {
  this.onClick.In = function () {
    this.uiConfirmLogout();
    return false;
  }.bind(this);
  return this.uiButton('In', username);
};

/**
 * Access refused Button
 * @param message: reason for refusal
 */
Auth.prototype.uiRefusedButton = function (message) {
  console.log('Pryv access [REFUSED]' + message);
  var strs = {
    'en': { 'msg': 'access refused'},
    'fr': { 'msg': 'Accès refusé'}
  }[this.settings.languageCode];
  this.onClick.Refused = function () {
    this.logout();
    return false;
  }.bind(this);
  return this.uiButton('Refused', strs.msg);

};

/**
 * Update Pryv button included in the webpage
 * @param html: html code of the Pryv button
 */
Auth.prototype.updateButton = function (html) {
  this.buttonHTML = html;
  if (this.settings.spanButtonID) {
    utility.domReady(function () {
      if (!this.spanButton) {
        var element = document.getElementById(this.settings.spanButtonID);
        if (typeof(element) === 'undefined' || element === null) {
          throw new Error('access-SDK cannot find span ID: "' +
            this.settings.spanButtonID + '"');
        } else {
          this.spanButton = element;
        }
      }
      this.spanButton.innerHTML = this.buttonHTML;
      this.spanButton.onclick = function (e) {
        e.preventDefault();
        var element = document.getElementById('pryv-access-btn');
        console.log('onClick', this.spanButton,
          element.getAttribute('data-onclick-action'));
        this.onClick[element.getAttribute('data-onclick-action')]();
      }.bind(this);
    }.bind(this));
  }
};

//--------------- State Management ------------------//

/**
 * Handles state changes
 * @param data: the new state data
 */
Auth.prototype.stateChanged  = function (data) {
  if (data.id) { // error
    if (this.settings.callbacks.error) {
      this.settings.callbacks.error(data.id, data.message);
    }
    this.updateButton(this.uiErrorButton());
    // this.logout();   Why should I retry if it failed already once?
  }

  if(!(data.status === this.state.status ||
    data.status === 'LOADED' ||
    data.status === 'POPUPINIT')) {
    this.state = data;
    switch(this.state.status) {
      case 'NEED_SIGNIN':
        this.stateNeedSignin();
        break;
      case 'REFUSED':
        this.stateRefused();
        break;
      case 'ACCEPTED':
        this.stateAccepted();
    }
  }
};

/**
 * State 0: Initialization
 * Pryv button is loading
 */
Auth.prototype.stateInitialization = function () {
  this.state = {status : 'initialization'};
  this.updateButton(this.uiLoadingButton());
  if (this.settings.callbacks.initialization) {
    this.settings.callbacks.initialization();
  }
};

/**
 * State 0: Need Signin
 * Wait the user to sign in
 */
Auth.prototype.stateNeedSignin = function () {
  this.updateButton(this.uiSigninButton());
  if (this.settings.callbacks.needSignin) {
    this.settings.callbacks.needSignin(this.state.url, this.state.poll,
      this.state.poll_rate_ms);
  }
};

/**
 * State 2: Accepted
 * The user is logged in and authorized, saves the credentials
 */
Auth.prototype.stateAccepted = function () {
  if (this.cookieEnabled) {
    utility.docCookies.setItem('access_username' + this.settings.domain, this.state.username, 3600);
    utility.docCookies.setItem('access_token' + this.settings.domain, this.state.token, 3600);
  }
  this.updateButton(this.uiInButton(this.state.username));

  this.connection.username = this.state.username;
  this.connection.auth = this.state.token;
  this.connection.domain = this.settings.domain;
  if (this.settings.callbacks.accepted) {
    this.settings.callbacks.accepted(this.state.username, this.state.token, this.state.lang);
  }
  if (this.settings.callbacks.signedIn) {
    this.settings.callbacks.signedIn(this.connection, this.state.lang);
  }
};

/**
 * State 3: User refused
 * The user is notified about refused access
 */
Auth.prototype.stateRefused = function () {
  this.updateButton(this.uiRefusedButton(this.state.message));
  if (this.settings.callbacks.refused) {
    this.settings.callbacks.refused('refused:' + this.state.message);
  }
};

/**
 * Throw an internal error
 * @param message: error message
 * @param jsonData: error data
 */
Auth.prototype.internalError = function (message, jsonData) {
  this.stateChanged({id: 'INTERNAL_ERROR', message: message, data: jsonData});
};

//--------------- Connection Management ------------------//

/**
 * Login the user and save references
 * TODO: discuss whether signature should be `(settings, callback)`
 * @param settings: authentication settings
 */
Auth.prototype.login = function (settings) {
  this._checkCookies();

  var defaultDomain = utility.urls.defaultDomain;
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  Connection.login(settings, function(err, conn, res) {
    if((err || !res.token) && typeof(this.settings.callbacks.error) === 'function') {
      return this.settings.callbacks.error(err || res);
    }

    this.connection = conn;

    if (this.cookieEnabled && settings.rememberMe) {
      utility.docCookies.setItem('access_username' + this.settings.domain,
        settings.username, 3600);
      utility.docCookies.setItem('access_token' + this.settings.domain,
        res.token, 3600);
      utility.docCookies.setItem('access_preferredLanguage' + this.settings.domain,
        res.preferredLanguage, 3600);
    }

    if (typeof(this.settings.callbacks.signedIn)  === 'function') {
      this.settings.callbacks.signedIn(this.connection);
    }
  }.bind(this));
};

/**
 * Logout the user and clear all references
 */
Auth.prototype.logout = function () {
  this.ignoreStateFromURL = true;
  if (this.cookieEnabled) {
    utility.docCookies.removeItem('access_username' + this.settings.domain);
    utility.docCookies.removeItem('access_token' + this.settings.domain);
  }
  this.state = null;
  if (this.settings.callbacks.accepted) {
    this.settings.callbacks.accepted(false, false, false);
  }
  if (this.settings.callbacks.signedOut) {
    this.settings.callbacks.signedOut(this.connection);
  }
  this.connection = null;
  this.setup(this.settings);
};

/**
 * Trusted logout with Pryv API call
 * TODO: belong elsewhere, useful? (e.g. static method of Connection)
 */
Auth.prototype.trustedLogout = function () {
  if (this.connection) {
    this.connection.trustedLogout(this.settings.callbacks);
  }
};

/**
 * Request for access information
 * TODO: belong elsewhere? (e.g. static method of Connection)
 * @param settings: request settings
 */
Auth.prototype.whoAmI = function (settings) {
  var defaultDomain = utility.urls.defaultDomain;
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  var pack = {
    ssl: settings.ssl,
    host: settings.username + '.' + settings.domain,
    path :  '/auth/who-am-i',
    method: 'GET',
    success : function (data)  {
      if (data.token) {
        this.connection.username = data.username;
        this.connection.auth = data.token;
        var conn = new Connection({
          username: data.username,
          auth: data.token,
          ssl: settings.ssl,
          domain: settings.domain
        });

        conn.accessInfo(function (error) {
          console.log('after access info', this.connection);
          if(error && (typeof(this.settings.callbacks.error) === 'function')) {
            this.settings.callbacks.error(error);
          } else if(!error && typeof(this.settings.callbacks.signedIn)  === 'function') {
            this.settings.callbacks.signedIn(this.connection);
          }
        }.bind(this));

      } else if (typeof(this.settings.callbacks.error) === 'function') {
        this.settings.callbacks.error(data);
      }
    }.bind(this),
    error : function (jsonError) {
      if (typeof(this.settings.callbacks.error) === 'function') {
        this.settings.callbacks.error(jsonError);
      }
    }.bind(this)
  };

  utility.request(pack);
};

/**
 * Login the user using stored cookies
 * TODO: belong elsewhere, merge with standard login? (e.g. member method of Connection)
 * @param settings: authentication settings
 * @returns {*}: a successful connection or false
 */
Auth.prototype.loginWithCookie = function (settings) {
  var defaultDomain = utility.urls.defaultDomain;
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  this._checkCookies();

  var cookieUserName = this.cookieEnabled ?
    utility.docCookies.getItem('access_username' + this.settings.domain) : false;
  var cookieToken = this.cookieEnabled ?
    utility.docCookies.getItem('access_token' + this.settings.domain) : false;

  if (cookieUserName && cookieToken) {
    this.connection.username = cookieUserName;
    this.connection.domain = this.settings.domain;
    this.connection.auth = cookieToken;

    if (typeof(this.settings.callbacks.signedIn) === 'function') {
      this.settings.callbacks.signedIn(this.connection);
    }

    return this.connection;
  }
  return false;
};

//--------------- Popup Management ------------------//

/**
 * Read the polling route using a polling key
 */
Auth.prototype.poll = function poll() {
  if (this.pollingIsOn && this.state.poll_rate_ms) {

    // Remove eventually pending poll
    if (this.pollingID) {
      clearTimeout(this.pollingID);
    }

    var pack = {
      path :  '/access/' + this.state.key,
      method : 'GET',
      success : function (data)  {
        this.stateChanged(data);
      }.bind(this),
      error : function (jsonError) {
        this.internalError('poll failed: ', jsonError);
      }.bind(this)
    };

    utility.request(_.extend(pack, this.config.registerURL));

    this.pollingID = setTimeout(this.poll.bind(this), this.state.poll_rate_ms);
  } else {
    console.log('stopped polling: on=' + this.pollingIsOn + ' rate:' + this.state.poll_rate_ms);
  }
};

/**
 * Messaging between browser window and window.opener
 * @param event: message from browser
 * @returns {boolean}: false in case of error
 */
Auth.prototype.popupCallBack = function (event) {
  // Do not use 'this' here !
  if (!this.settings.forcePolling) {
    if (event.source !== this.window) {
      console.log('popupCallBack event.source does not match Auth.window');
      return false;
    }
    console.log('from popup >>> ' + JSON.stringify(event.data));
    this.pollingIsOn = false; // If we can receive messages we stop polling
    this.stateChanged(event.data);
  }
};

/**
 * Display the login popup
 * @returns {boolean}: false in case of error
 */
Auth.prototype.popupLogin = function popupLogin() {
  if (!this.state || !this.state.url) {
    throw new Error('Pryv Sign-In Error: NO SETUP. Please call Auth.setup() first.');
  }

  if (this.settings.returnURL) {
    location.href = this.state.url;
  } else {
    // Start polling
    setTimeout(this.poll(), 1000);

    var screenX = typeof window.screenX !== 'undefined' ? window.screenX : window.screenLeft,
      screenY = typeof window.screenY !== 'undefined' ? window.screenY : window.screenTop,
      outerWidth = typeof window.outerWidth !== 'undefined' ?
        window.outerWidth : document.body.clientWidth,
      outerHeight = typeof window.outerHeight !== 'undefined' ?
        window.outerHeight : (document.body.clientHeight - 22),
      width    = 270,
      height   = 420,
      left     = parseInt(screenX + ((outerWidth - width) / 2), 10),
      top      = parseInt(screenY + ((outerHeight - height) / 2.5), 10),
      features = (
        'width=' + width +
        ',height=' + height +
        ',left=' + left +
        ',top=' + top +
        ',scrollbars=yes'
      );

    window.addEventListener('message', this.popupCallBack.bind(this), false);

    this.window = window.open(this.state.url, 'prYv Sign-in', features);

    if (!this.window) {
      // TODO try to fall back on access
      console.log('FAILED_TO_OPEN_WINDOW');
    } else if(window.focus) {
      this.window.focus();
    }

    return false;
  }
};

//--------------------- Utils ----------//

// Regular expression filtering url parameters
var statusRegexp = /[?#&]+prYv([^=&]+)=([^&]*)/g;

/**
 * Grab status parameter from url query string
 * @returns {*}: status parameter if present or false
 * @private
 */
Auth.prototype._getStatusFromURL = function () {
  var vars = {};
  window.location.href.replace(statusRegexp,
    function (m, key, value) {
      vars[key] = value;
    });

  //TODO check validity of status
  return (vars.status) ? vars : false;
};

/**
 * Remove url parameters from url query string
 * @returns {string}: original url without parameters
 * @private
 */
Auth.prototype._cleanStatusFromURL = function () {
  return window.location.href.replace(statusRegexp, '');
};

/**
 * Check if cookies are supported and save this information as boolean
 * @private
 */
Auth.prototype._checkCookies = function () {
  if (this.cookiesForceDisable) {
    return;
  }

  this.cookieEnabled = (navigator.cookieEnabled);
  if (typeof navigator.cookieEnabled === 'undefined' && !this.cookieEnabled) {  //if not IE4+ NS6+
    document.cookie = 'testcookie';
    this.cookieEnabled = (document.cookie.indexOf('testcookie') !== -1);
  }
};

module.exports = new Auth();