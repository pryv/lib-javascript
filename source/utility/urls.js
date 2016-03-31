/* global document */

var urls = module.exports = {};

/**
 * The one and only reference for Pryv domain names.
 * TODO: client and server will merge
 */
urls.defaultDomain = 'pryv.io';


/* jshint -W101 */
/**
 * Extracts base components from a browser URL string
 * (e.g. today: "https://username.pryv.me:443/some/path").
 *
 * @param url Defaults to `document.location` if available
 * @returns {URLInfo}
 */
urls.parseClientURL = function (url) {
  return new URLInfo(url, 'client');
};

/**
 * Extracts base components from a standard Pryv API URL string
 * (e.g. "https://username.pryv.io:443/some/path").
 *
 * @param url
 * @returns {URLInfo}
 */
urls.parseServerURL = function (url) {
  return new URLInfo(url, 'server');
};

/**
 * @param {String} url
 * @param {String} type "client" or "server"
 * @constructor
 */
function URLInfo(url, type) {
  var loc;
  if (typeof document !== 'undefined') {
    // browser
    if (url) {
      loc = document.createElement('a');
      loc.href = url;
    } else {
      loc = document.location;
    }
  } else {
    // node
    if (! url) {
      throw new Error('`url` is required');
    }
    loc = require('url').parse(url);
  }
  if (! (type === 'client' || type === 'server')) {
    throw new Error('`type` must be either "client" or "server"');
  }
  this.type = type;

  this.protocol = loc.protocol;
  this.hostname = loc.hostname;
  this.port = loc.port || (this.protocol === 'https:' ? 443 : 80);
  this.path = loc.pathname;
  this.hash = loc.hash;
  this.search = loc.search;

  var splitHostname = loc.hostname.split('.');
  if (splitHostname.length >= 3 /* TODO: check & remove, shouldn't be necessary && splitHostname[0].match(this.regex.username)*/) {
    this.username = splitHostname[0];
  }
  this.domain = loc.hostname.substr(loc.hostname.indexOf('.') + 1);

}

URLInfo.prototype.isSSL = function () {
  return this.protocol === 'https:';
};

URLInfo.prototype.parseQuery = function () {
  var objURL = {};
  this.search.replace(new RegExp('([^?=&]+)(=([^&]*))?', 'g'), function ($0, $1, $2, $3) {
    objURL[$1] = $3;
  });
  return objURL;
};

URLInfo.prototype.parseSharingTokens = function () {
  if (this.type !== 'client') {
    throw new Error('Can only parse on client URLs');
  }
  var splitPath = this.hash.split('/');
  var sharingsIndex = splitPath.indexOf('sharings');
  if (sharingsIndex !== -1) {
    return splitPath.splice(sharingsIndex + 1).filter(function (s) { return s.length > 0; });
  } else {
    return [];
  }
};
