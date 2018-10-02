/* global confirm, document, navigator, location, window */

const utility = require('../utility/utility.js');
const Connection = require('../Connection.js');
const _ = require('lodash');

//--------------------- Initialization -----------------------------------------

const logger = console; 

/**
 * @class Auth: handling Pryv authentication through browser popup
 * */
var Auth = function () {};

_.extend(Auth.prototype, {
  connection: null, // actual connection managed by Auth
  config: {
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
  ignoreStateFromURL: false, // turned to true in case of loggout
  uiSupportedLanguages: ['en', 'fr'], 
});

// Initialize style sheet and supported languages
utility.loadExternalFiles(Auth.prototype.config.sdkFullPath +
  '/assets/buttonSigninPryv.css', 'css');

/**
 * Sets up the authentication process. 
 * 
 * These settings are mandatory: 
 * 
 *  - *requestingAppId* App ID that requests access. (see 
 *    http://api.pryv.com/getting-started/javascript/#authorize-your-app) for 
 *    details. 
 *  - *requestedPermissions* Permissions to request. 
 * 
 * These settings are optional: 
 * 
 *  - *languageCode* Language code to use during auth/consent process. This
 *    will default to 'en' if not set.
 *  - *returnURL* URL to redirect the client to after completing the auth
 *    process. Can be left empty, in which case you need to poll the result 
 *    of the auth operation. 
 *  - *rememberMe* Set to `true` if the user should be remembered once logged 
 *    in. 
 *  - *oauthState* Debug option. 
 *  - *clientData* Client data to store in the access object in Pryv.IO. 
 * 
 * Additionally, these callbacks can be defined and will be called at the 
 * appropriate moments: 
 * 
 *  - *callbacks.initialization*: (), Called when the button is loading. 
 *  - *callbacks.needSignin*: (url, poll, pollRate) called when a signin is 
 *    needed. 
 *  - *callbacks.accepted*: (username, token, lang) Login has succeeded with the 
 *    given credentials. 
 *  - *callbacks.signedIn*: (connection, lang) Login has succeeded; provides a 
 *    working connection. This is called at the same time as 'accepted'. 
 *  - *callbacks.error*: (error, message) Called whenever an error occurs. 
 *  - *callbacks.refused*: (reason) The user has refused his consent. 
 * 
 * @returns {Connection}: the connection managed by Auth. A new one is created 
 *  each time setup is called.
 */
Auth.prototype.setup = function (settings) {
  this.settings = settings;
  this.state = null;

  this.cookiesForceDisable = settings.cookiesForceDisable || false;
  this._checkCookies();

  // Compute the language code to use. 
  settings.languageCode =
    utility.getPreferredLanguage(this.uiSupportedLanguages, settings.languageCode);

  // Verify and compute returnURL from the user settings.
  settings.returnURL = computeReturnUrl(settings.returnURL);

  const urlInfo = utility.urls.parseServerURL(this.config.registerURL.host);
  this.settings.domain = urlInfo.domain;

  const params = {
    requestingAppId : settings.requestingAppId,
    requestedPermissions : settings.requestedPermissions,
    languageCode : settings.languageCode,
    returnURL : settings.returnURL
  };

  // Copy over advanced options
  for (let key of ['oauthState', 'clientData']) {
    const value = settings[key]; 
    if (value != null) {
      params[key] = value; 
    }
  }

  // Advanced dev. option for local testing with rec-la
  if (this.config.reclaDevel != null) {
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

/** 
 * Calls a callback from the 'this.settings.callbacks' collection. Makes 
 * sure the callback exists; if it doesn't, logs to the console and returns. 
 */
Auth.prototype.callCallback = function callCallback(name, ...args) {
  const callbackNames = [
    'initialization',
    'needSignin',
    'accepted',
    'signedIn',
    'error',
    'refused',
  ];

  if (! callbackNames.includes(name)) {
    logger.error(
      `Code is trying to call the callback '${name}', but no such callback exists.`);
    return;
  }

  const callbacks = this.settings.callbacks; 
  if (typeof callbacks[name] !== 'function') return;

  callbacks[name](...args);
};

/**
 * Set cookies to remember we were already logged in on this machine/browser. 
 * If cookies are disabled, this does nothing. 
 * 
 * @param username User to remember this login by.
 * @param token Token to remember. 
 * @param language The user's preferred language. This can be null/undefined.
 */
Auth.prototype.rememberLogin = function rememberLogin(username, token, language) {
  const settings = this.settings; 

  // Are cookies turned on? 
  if (! this.cookieEnabled) return; 
  if (! settings.rememberMe) return; 

  // Assert: Yes, we're setting cookies. 
  const setItem = utility.docCookies.setItem; 
  const rememberSeconds = 3600; 

  setItem(this.cookieName('access_username'), username, rememberSeconds);
  setItem(this.cookieName('access_token'), token, rememberSeconds);
  setItem(this.cookieName('access_preferredLanguage'), language, rememberSeconds);
};

/** 
 * Forgets the login remembered using `rememberLogin`. 
 */
Auth.prototype.forgetLogin = function forgetLogin() {
  const removeItem = utility.docCookies.removeItem; 

  removeItem(this.cookieName('access_username'));
  removeItem(this.cookieName('access_token'));
  removeItem(this.cookieName('access_preferredLanguage'));
};

Auth.prototype.getLogin = function getLogin() {
  const login = {
    username: null, 
    token: null, 
    language: null, 
  };

  // If cookies are currently not enabled, return default values.   
  if (! this.cookieEnabled) return login; 

  const getItem = utility.docCookies.getItem; 
  login.username = getItem(this.cookieName('access_username'));
  login.token = getItem(this.cookieName('access_token'));
  login.language = getItem(this.cookieName('access_preferredLanguage'));

  return login;
};

/** 
 * Given a `name` returns a cookie name that should be unique (namespaced) for 
 * this.domain. 
 */
Auth.prototype.cookieName = function cookieName(name) {
  return name + this.settings.domain; 
};

//--------------------- UI Content ---------------------------------------------

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
  logger.log('Pryv access [REFUSED]' + message);
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
        logger.log('onClick', this.spanButton,
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
Auth.prototype.stateChanged = function (data) {
  // NOTE #internalError used to call #stateChanged to do its bidding. I don't 
  //  think this belongs here. But since somebody else might be using this code, 
  //  we'll keep it for a little while. 
  if (data.id != null) { // error
    logger.warn(
      'stateChanged called with an internal error. This usage is deprecated, use #internalError.');

    this.callCallback('error', data.id, data.message);
    this.updateButton(this.uiErrorButton());
    
    return;
  }

  const state = this.state; 
  const newState = data; 

  const stateHasChanged = (newState.status !== state.status); 
  if (! stateHasChanged) return;

  this.state = newState;

  switch (newState.status) {
    case 'LOADED':      break; 
    case 'POPUPINIT':   break; 
    case 'NEED_SIGNIN': this.stateNeedSignin(); break; 
    case 'REFUSED':     this.stateRefused(); break; 
    case 'ACCEPTED':    this.stateAccepted(); break; 
    
    default: 
      logger.error(`Entering unknown state: '${newState.status}'.`);
  }
};

/**
 * State 0: Initialization
 * Pryv button is loading. This is only called when you call 'Auth.setup'. 
 */
Auth.prototype.stateInitialization = function () {
  this.state = {status : 'initialization'};
  this.updateButton(this.uiLoadingButton());
  this.callCallback('initialization');
};

/**
 * State 0: Need Signin
 * Wait the user to sign in
 */
Auth.prototype.stateNeedSignin = function () {
  this.updateButton(this.uiSigninButton());
  this.callCallback('needSignin', 
    this.state.url, this.state.poll,
    this.state.poll_rate_ms);
};

/**
 * State 2: Accepted
 * The user is logged in and authorized, saves the credentials
 */
Auth.prototype.stateAccepted = function () {
  const state = this.state; 
  this.rememberLogin(state.username, state.token);

  this.updateButton(this.uiInButton(state.username));

  const settings = this.settings; 
  const connection = this.connection; 
  
  // Finish configuration of the connection. 
  connection.username = state.username;
  connection.auth = state.token;
  connection.domain = settings.domain;
  
  // Call callbacks. 
  this.callCallback('accepted', state.username, state.token, state.lang);
  this.callCallback('signedIn', connection, state.lang);
};

/**
 * State 3: User refused
 * The user is notified about refused access
 */
Auth.prototype.stateRefused = function () {
  this.updateButton(this.uiRefusedButton(this.state.message));
  this.callCallback('refused', 'refused:' + this.state.message);
};

/**
 * Throws an internal error.
 * 
 * @param message: error message
 */
Auth.prototype.internalError = function (message, /* jsonData */) {
  this.callCallback('error', 'INTERNAL_ERROR', message);
  this.updateButton(this.uiErrorButton());
};

//--------------- Connection Management ------------------//

/**
 * Login the user and save references.
 * 
 * @param settings: authentication settings
 */
Auth.prototype.login = function (settings) {
  this._checkCookies();

  var defaultDomain = utility.urls.defaultDomain;

  // BUG Assigning to settings will undo all the work done in 'setup'. 
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  Connection.login(settings, (err, conn, res) => {
    // NOTE The 'err || res' bit is legacy code that we kept intact. 
    if (err != null || res.token == null)
      return this.callCallback('error', (err || res));

    this.connection = conn;

    this.rememberLogin(settings.username, res.token, res.preferredLanguage);
    this.callCallback('signedIn', conn);
  });
};

/**
 * Logout the user and clear all references
 */
Auth.prototype.logout = function () {
  this.forgetLogin(); 
  
  this.ignoreStateFromURL = true;
  this.state = null;

  // Possible BUG: We used to call 'accepted' here, but that makes no sense. 
  // this.callCallback('accepted', false, false, false);

  this.callCallback('signedOut', this.connection);

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
 * 
 * @param settings: request settings
 */
Auth.prototype.whoAmI = function (settings) {
  const defaultDomain = utility.urls.defaultDomain;

  // BUG Assigning to settings will undo all the work done in 'setup'. 
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  const pack = {
    ssl: settings.ssl,
    host: settings.username + '.' + settings.domain,
    path :  '/auth/who-am-i',
    method: 'GET',
    success : function (data) {
      if (data.token == null) {
        this.callCallback('error', data); 
        return;
      }

      this.connection.username = data.username;
      this.connection.auth = data.token;
      const conn = new Connection({
        username: data.username,
        auth: data.token,
        ssl: settings.ssl,
        domain: settings.domain
      });

      conn.accessInfo((error) => {
        logger.log('after access info', this.connection);

        if (error == null) 
          this.callCallback('signedIn', this.connection); 
        else 
          this.callCallback('error', error); 
      });
    }.bind(this),
    error: this.callCallback.bind(this, 'error', /* jsonError */),
  };

  utility.request(pack);
};

/**
 * Login the user using stored cookies
 * 
 * @param settings: authentication settings
 * @returns {*}: a successful connection or null
 */
Auth.prototype.loginWithCookie = function (settings) {
  var defaultDomain = utility.urls.defaultDomain;

  // BUG Assigning to settings will undo all the work done in 'setup'. 
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  this._checkCookies();

  const cookie = this.getLogin(); 
  if (cookie.username != null && cookie.token != null) {
    this.connection.username = cookie.username;
    this.connection.domain = this.settings.domain;
    this.connection.auth = cookie.token;

    this.callCallback('signedIn', this.connection);

    return this.connection;
  }

  return null;
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
    logger.log('stopped polling: on=' + this.pollingIsOn + ' rate:' + this.state.poll_rate_ms);
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
      logger.log('popupCallBack event.source does not match Auth.window');
      return false;
    }

    logger.log('from popup >>> ' + JSON.stringify(event.data));

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

    const screenX = window.screenX != null ? window.screenX : window.screenLeft;
    const screenY = window.screenY != null ? window.screenY : window.screenTop;
    const outerWidth = window.outerWidth != null ? window.outerWidth : document.body.clientWidth;
    const outerHeight = window.outerHeight != null ? window.outerHeight : (document.body.clientHeight - 22);
    const width    = 270;
    const height   = 420;
    const left     = Math.floor(screenX + ((outerWidth - width) / 2));
    const top      = Math.floor(screenY + ((outerHeight - height) / 2.5));
    
    const features = 
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`;
    
    window.addEventListener('message', 
      this.popupCallBack.bind(this), false);

    this.window = window.open(this.state.url, 'prYv Sign-in', features);

    if (this.window == null) {
      logger.log('FAILED_TO_OPEN_WINDOW');
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

function computeReturnUrl(userConfig) {
  let returnURL = userConfig || 'auto#';

  // Check the trailer
  const tail = returnURL.charAt(returnURL.length - 1);
  if ('#&?'.indexOf(tail) < 0) {
    throw new Error('Pryv access: Last character of --returnURL setting-- is not ' +
      '"?", "&" or "#": ' + returnURL);
  }

  // Set self as return url?
  if ((returnURL.indexOf('auto') === 0 && utility.browserIsMobileOrTablet()) ||
    (returnURL.indexOf('self') === 0)) {
    returnURL = this._cleanStatusFromURL();
    // If not already ending by &
    if (returnURL.slice(-1) !== '&') {
      // If already containing ? or #, add a &
      if (returnURL.indexOf('?') > -1 || returnURL.indexOf('#') > -1) {
        returnURL += '&';
      }
      // If no, add a #
      else {
        returnURL += '#';
      }
    }
  } else if (returnURL.indexOf('auto') === 0 && !utility.browserIsMobileOrTablet()) {
    returnURL = false;
  }

  if (returnURL && returnURL.indexOf('http') < 0) {
    throw new Error('Pryv access: --returnURL setting-- does not start with http ' +
      returnURL);
  }

  return returnURL;
}

module.exports = new Auth();