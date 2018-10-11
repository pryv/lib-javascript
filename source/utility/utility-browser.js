/* global document, navigator */

/**
 * Browser-only utils
 */
var utility = {};

utility.getHostFromUrl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.hostname;
};

utility.getPortFromUrl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.port === '' ? null : location.port;
};

utility.isUrlSsl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.protocol === 'https:';
};

/**
 *  List grabbed from
 *  https://github.com/codefuze/js-mobile-tablet-redirect/blob/master/mobile-redirect.js
 *
 *  @return {Boolean} `true` if browser is seen as a mobile or tablet
 */
utility.browserIsMobileOrTablet = function () {
  /* jshint -W101*/
  return (/iphone|ipod|android|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec|ipad|android 3|sch-i800|playbook|tablet|kindle|gt-p1000|sgh-t849|shw-m180s|a510|a511|a100|dell streak|silk/i.test(navigator.userAgent.toLowerCase()));
};

/**
 * Method to get the preferred language, either from desiredLanguage or from the browser settings
 * @method getPreferredLanguage
 * @param {Array} supportedLanguages an array of supported languages encoded on 2characters
 * @param {String} desiredLanguage (optional) get this language if supported
 */
utility.getPreferredLanguage = function (supportedLanguages, desiredLanguage) {
  if (desiredLanguage) {
    if (supportedLanguages.indexOf(desiredLanguage) >= 0) { return desiredLanguage; }
  }
  var lct = null;
  if (navigator.language) {
    lct = navigator.language.toLowerCase().substring(0, 2);
  } else if (navigator.userLanguage) {
    lct = navigator.userLanguage.toLowerCase().substring(0, 2);
  } else if (navigator.userAgent.indexOf('[') !== -1) {
    var start = navigator.userAgent.indexOf('[');
    var end = navigator.userAgent.indexOf(']');
    lct = navigator.userAgent.substring(start + 1, end).toLowerCase();
  }
  if (desiredLanguage) {
    if (lct.indexOf(desiredLanguage) >= 0) { return lct; }
  }

  return supportedLanguages[0];
};


/**
 * //TODO check if it's robust
 * Method to check the browser supports CSS3.
 * @method supportCSS3
 * @return boolean
 */
utility.supportCSS3 = function ()  {
  const stub = document.createElement('div');
  let testProperty = 'textShadow';

  if (testProperty in stub.style) { return true; }

  testProperty = testProperty.replace(/^[a-z]/, function (val) {
    return val.toUpperCase();
  });

  return false;
};

/**
 * Method to load external files like javascript and stylesheet. this version
 * of method only support to file types - js|javascript and css|stylesheet.
 *
 * @method loadExternalFiles
 * @param {String} filename
 * @param {String} type 'js' or 'css'
 */
utility.loadExternalFiles = function (filename, type)  {
  var tag = null;

  type = type.toLowerCase();

  if (type === 'js' || type === 'javascript') {
    tag = document.createElement('script');
    tag.setAttribute('type', 'text/javascript');
    tag.setAttribute('src', filename);
  } else if (type === 'css' || type === 'stylesheet')  {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'stylesheet');
    tag.setAttribute('type', 'text/css');
    tag.setAttribute('href', filename);
  }

  if (tag !== null || tag !== undefined) {
    document.getElementsByTagName('head')[0].appendChild(tag);
  }
};

utility.docCookies = require('./docCookies');

utility.domReady = require('./domReady');

utility.request = require('./request-browser');
