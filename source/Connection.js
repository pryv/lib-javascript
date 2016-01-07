var _ = require('underscore'),
    utility = require('./utility/utility.js'),
    ConnectionEvents = require('./connection/ConnectionEvents.js'),
    ConnectionStreams = require('./connection/ConnectionStreams.js'),
    ConnectionProfile = require('./connection/ConnectionProfile.js'),
    ConnectionBookmarks = require('./connection/ConnectionBookmarks.js'),
    ConnectionAccesses = require('./connection/ConnectionAccesses.js'),
    ConnectionMonitors = require('./connection/ConnectionMonitors.js'),
    ConnectionAccount = require('./connection/ConnectionAccount.js'),
    CC = require('./connection/ConnectionConstants.js'),
    Datastore = require('./Datastore.js');

/**
 * @class Connection
 * Create an instance of Connection to Pryv API.
 * The connection will be opened on
 * http[s]://&lt;username>.&lt;domain>:&lt;port>/&lt;extraPath>?auth=&lt;auth>
 *
 * @example
 * // create a connection for the user 'perkikiki' with the token 'TTZycvBTiq'
 * var conn = new pryv.Connection({username: 'perkikiki', auth: 'TTZycvBTiq'});
 *
 * @constructor
 * @this {Connection}
 * @param {Object} [settings]
 * @param {string} settings.username
 * @param {string} settings.auth - the authorization token for this username
 * @param {number} [settings.port = 443]
 * @param {string} [settings.domain = 'pryv.io'] change the domain.
 * @param {boolean} [settings.ssl = true] Use ssl (https) or no
 * @param {string} [settings.extraPath = ''] append to the connections. Must start with a '/'
 */
var Connection = module.exports = function Connection() {
  var settings;
  if (!arguments[0] || typeof arguments[0] === 'string') {
    console.warn('new Connection(username, auth, settings) is deprecated.',
      'Please use new Connection(settings)', arguments);
    this.username = arguments[0];
    this.auth = arguments[1];
    settings = arguments[2];
  } else {
    settings = arguments[0];
    this.username = settings.username;
    this.auth = settings.auth;
    if (settings.url) {
      var urlInfo = utility.urls.parseServerURL(settings.url);
      this.username = urlInfo.username;
      settings.hostname = urlInfo.hostname;
      settings.domain = urlInfo.domain;
      settings.port = urlInfo.port;
      settings.extraPath = urlInfo.path === '/' ? '' : urlInfo.path;
      settings.ssl = urlInfo.isSSL();
    }
  }
  this._serialId = Connection._serialCounter++;

  this.settings = _.extend({
    port: 443,
    ssl: true,
    extraPath: '',
    staging: false
  }, settings);
  this.settings.domain = settings.domain ?
      settings.domain : utility.urls.defaultDomain;

  this.serverInfos = {
    // nowLocalTime - nowServerTime
    deltaTime: null,
    apiVersion: null,
    lastSeenLT: null
  };

  this._accessInfo = null;
  this._privateProfile = null;

  this._streamSerialCounter = 0;
  this._eventSerialCounter = 0;

  /**
   * Manipulate events for this connection
   * @type {ConnectionEvents}
   */
  this.events = new ConnectionEvents(this);
  /**
   * Manipulate streams for this connection
   * @type {ConnectionStreams}
   */
  this.streams = new ConnectionStreams(this);
  /**
  * Manipulate app profile for this connection
  * @type {ConnectionProfile}
  */
  this.profile = new ConnectionProfile(this);
  /**
  * Manipulate bookmarks for this connection
  * @type {ConnectionProfile}
  */
  this.bookmarks = new ConnectionBookmarks(this, Connection);
  /**
  * Manipulate accesses for this connection
  * @type {ConnectionProfile}
  */
  this.accesses = new ConnectionAccesses(this);
  /**
   * Manipulate this connection monitors
   */
  this.monitors = new ConnectionMonitors(this);

  this.account = new ConnectionAccount(this);
  this.datastore = null;

};

Connection._serialCounter = 0;


/**
 * In order to access some properties such as event.stream and get a {Stream} object, you
 * need to fetch the structure at least once. For now, there is now way to be sure that the
 * structure is up to date. Soon we will implement an optional parameter "keepItUpToDate", that
 * will do that for you.
 *
 * TODO implements "keepItUpToDate" logic.
 * @param {Streams~getCallback} callback - array of "root" Streams
 * @returns {Connection} this
 */
Connection.prototype.fetchStructure = function (callback /*, keepItUpToDate*/) {
  if (this.datastore) { return this.datastore.init(callback); }
  this.datastore = new Datastore(this);
  this.accessInfo(function (error) {
    if (error) { return callback(error); }
    this.datastore.init(callback);
  }.bind(this));
  return this;
};

/**
 * Get access information related this connection. This is also the best way to test
 * that the combination username/token is valid.
 * @param {Connection~accessInfoCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.accessInfo = function (callback) {
  if (this._accessInfo) { return this._accessInfo; }
  var url = '/access-info';
  this.request('GET', url, function (error, result) {
    if (! error) {
      this._accessInfo = result;
    }
    if (typeof(callback) === 'function') {
      return callback(error, result);
    }
  }.bind(this));
  return this;
};

/**
 * Get the private profile related this connection.
 * @param {Connection~privateProfileCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.privateProfile = function (callback) {
  if (this._privateProfile) { return this._privateProfile; }
  this.profile.getPrivate(null, function (error, result) {
    if (result && result.message) {
      error = result;
    }
    if (! error) {
      this._privateProfile = result;
    }
    if (typeof(callback) === 'function') {
      return callback(error, result);
    }
  }.bind(this));
  return this;
};

/**
 * Translate this timestamp (server dimension) to local system dimension
 * This could have been named to "translate2LocalTime"
 * @param {number} serverTime timestamp  (server dimension)
 * @returns {number} timestamp (local dimension) same time space as (new Date()).getTime();
 */
Connection.prototype.getLocalTime = function (serverTime) {
  return (serverTime + this.serverInfos.deltaTime) * 1000;
};

/**
 * Translate this timestamp (local system dimension) to server dimension
 * This could have been named to "translate2ServerTime"
 * @param {number} localTime timestamp  (local dimension) same time space as (new Date()).getTime();
 * @returns {number} timestamp (server dimension)
 */
Connection.prototype.getServerTime = function (localTime) {
  if (typeof localTime === 'undefined') { localTime = new Date().getTime(); }
  return (localTime / 1000) - this.serverInfos.deltaTime;
};


// ------------- monitor this connection --------//

/**
 * Start monitoring this Connection. Any change that occurs on the connection (add, delete, change)
 * will trigger an event. Changes to the filter will also trigger events if they have an impact on
 * the monitored data.
 * @param {Filter} filter - changes to this filter will be monitored.
 * @returns {Monitor}
 */
Connection.prototype.monitor = function (filter) {
  return this.monitors.create(filter);
};

// ------------- start / stop Monitoring is called by Monitor constructor / destructor -----//



/**
 * Do a direct request to Pryv's API.
 * Even if exposed there must be an abstraction for every API call in this library.
 * @param {string} method - GET | POST | PUT | DELETE
 * @param {string} path - to resource, starting with '/' like '/events'
 * @param {Connection~requestCallback} callback
 * @param {Object} jsonData - data to POST or PUT
 */
Connection.prototype.request = function (method, path, callback, jsonData, isFile,
                                         progressCallback) {


  if (! callback || ! _.isFunction(callback)) {
    throw new Error('request\'s callback must be a function');
  }
  var headers =  { 'authorization': this.auth };
  var withoutCredentials = false;
  var payload = JSON.stringify({});
  if (jsonData && !isFile) {
    payload = JSON.stringify(jsonData);
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  if (isFile) {
    payload = jsonData;
    headers['Content-Type'] = 'multipart/form-data';
    headers['X-Requested-With'] = 'XMLHttpRequest';
    withoutCredentials = true;
  }

  var request = utility.request({
    method : method,
    host : getHostname(this),
    port : this.settings.port,
    ssl : this.settings.ssl,
    path : this.settings.extraPath + path,
    headers : headers,
    payload : payload,
    progressCallback: progressCallback,
    //TODO: decide what callback convention to use (Node or jQuery)
    success : onSuccess.bind(this),
    error : onError.bind(this),
    withoutCredentials: withoutCredentials
  });

  /**
   * @this {Connection}
   */
  function onSuccess(result, resultInfo) {
    var error = null;

    var apiVersion = resultInfo.headers['API-Version'] || 
      resultInfo.headers[CC.Api.Headers.ApiVersion];

    // test if API is reached or if we headed into something else
    if (! apiVersion) {
      error = {
        id : CC.Errors.API_UNREACHEABLE,
        message: 'Cannot find API-Version',
        details: 'Response code: ' + resultInfo.code +
          ' Headers: ' + JSON.stringify(resultInfo.headers)
      };
    } else if (result.message) {  // API < 0.6
      error = result.message;
    } else
    if (result.error) { // API 0.7
      error = result.error;
    } else {
      this.serverInfos.lastSeenLT = (new Date()).getTime();
      this.serverInfos.apiVersion = apiVersion || this.serverInfos.apiVersion;
      if (_.has(resultInfo.headers, CC.Api.Headers.ServerTime)) {
        this.serverInfos.deltaTime = (this.serverInfos.lastSeenLT / 1000) -
          resultInfo.headers[CC.Api.Headers.ServerTime];
      }
    }
    callback(error, result, resultInfo);
  }

  function onError(error, resultInfo) {
    var errorTemp = {
      id : CC.Errors.API_UNREACHEABLE,
      message: 'Error on request ',
      details: 'ERROR: ' + error
    };
    callback(errorTemp, null, resultInfo);
  }
  return request;
};



/**
 * @property {string} Connection.id an unique id that contains all needed information to access
 * this Pryv data source. http[s]://<username>.<domain>:<port>[/extraPath]/?auth=<auth token>
 */
Object.defineProperty(Connection.prototype, 'id', {
  get: function () {
    var id = this.settings.ssl ? 'https://' : 'http://';
    id += getHostname(this) + ':' +
        this.settings.port + this.settings.extraPath + '/?auth=' + this.auth;
    return id;
  },
  set: function () { throw new Error('ConnectionNode.id property is read only'); }
});

/**
 * @property {string} Connection.displayId an id easily readable <username>:<access name>
 */
Object.defineProperty(Connection.prototype, 'displayId', {
  get: function () {
    if (! this._accessInfo) {
      throw new Error('connection must have been initialized to use displayId. ' +
        ' You can call accessInfo() for this');
    }
    var id = this.username + ':' + this._accessInfo.name;
    return id;
  },
  set: function () { throw new Error('Connection.displayId property is read only'); }
});

/**
 * @property {String} Connection.serialId A locally-unique id for the connection; can also be
 *                                        used as a client-side id
 */
Object.defineProperty(Connection.prototype, 'serialId', {
  get: function () { return 'C' + this._serialId; }
});
/**
 * Called with the desired Streams as result.
 * @callback Connection~accessInfoCallback
 * @param {Object} error - eventual error
 * @param {AccessInfo} result
 */

/**
 * @typedef AccessInfo
 * @see http://api.pryv.com/reference.html#data-structure-access
 */

/**
 * Called with the result of the request
 * @callback Connection~requestCallback
 * @param {Object} error - eventual error
 * @param {Object} result - jSonEncoded result
 * @param {Object} resultInfo
 * @param {Number} resultInfo.code - HTTP result code
 * @param {Object} resultInfo.headers - HTTP result headers by key
 */


// --------- private utils

function getHostname(connection) {
  return connection.settings.hostname ||
      connection.username ?
      connection.username + '.' + connection.settings.domain : connection.settings.domain;
}
