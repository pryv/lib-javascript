const socketIO = require('socket.io-client');
const _ = require('lodash');
const FormData = require('form-data');

const utility = {};
module.exports = utility;

utility.request = require('./request');

/**
 * Create or complete FormData object for attachements
 * @param id {String} id of the element to add (may be 'attachment0')
 * @param data {Data} the data to send
 * @param options {Object}
 * @param options.filename {String}
 * @param options.type {String}
 */
utility.forgeFormData = function (id, data, options, appendTo) {
  var formData = appendTo || new FormData();
  formData.append(id, data, options);
  return formData;
};


/**
 * @returns {Boolean} `true` if we're in a web browser environment
 */
utility.isBrowser = function () {
  return typeof (window) !== 'undefined';
};

// This should be a file that is only ever required in a non-browser environment. 
// Make sure: 
if (utility.isBrowser()) 
  throw new Error('utility.js was required in a browser environment!');

utility.SignalEmitter = require('./SignalEmitter.js');

/**
 * Merges two object (key/value map) and remove "null" properties
 *
 * @param {Object} sourceA
 * @param {Object} sourceB
 * @returns {*|Block|Node|Tag}
 */
utility.mergeAndClean = function (sourceA, sourceB) {
  sourceA = sourceA || {};
  sourceB = sourceB || {};
  var result = _.clone(sourceA);
  _.extend(result, sourceB);
  _.each(_.keys(result), function (key) {
    if (result[key] === null) { delete result[key]; }
  });
  return result;
};

/**
 * Creates a query string from an object (key/value map)
 *
 * @param {Object} data
 * @returns {String} key1=value1&key2=value2....
 */
utility.getQueryParametersString = function (data) {
  data = this.mergeAndClean(data);
  return Object.keys(data).map(function (key) {
    if (data[key] !== null) {
      if (_.isArray(data[key])) {
        data[key] = this.mergeAndClean(data[key]);
        var keyE = encodeURIComponent(key + '[]');
        return data[key].map(function (subData) {
          return keyE + '=' + encodeURIComponent(subData);
        }).join('&');
      } else {
        return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
      }
    }
  }, this).join('&');
};

utility.regex = require('./regex');

/**
 * Cross-platform string endsWith
 *
 * @param {String} string
 * @param {String} suffix
 * @returns {Boolean}
 */
utility.endsWith = function (string, suffix) {
  return string.indexOf(suffix, string.length - suffix.length) !== -1;
};

utility.ioConnect = function (settings) {
  var httpMode = settings.ssl ? 'https' : 'http';
  var url = httpMode + '://' + settings.host + ':' + settings.port + '' +
    settings.path + '?auth=' + settings.auth + '&resource=' + settings.namespace;

  return socketIO(url, { forceNew: true });
};

utility.urls = require('./urls');