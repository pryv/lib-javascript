var utility = require('./utility/utility.js'),
    ConnectionEvents = require('./connection/ConnectionEvents.js'),
    ConnectionStreams = require('./connection/ConnectionStreams.js'),
    ConnectionProfile = require('./connection/ConnectionProfile.js'),
    ConnectionBookmarks = require('./connection/ConnectionBookmarks.js'),
    ConnectionAccesses = require('./connection/ConnectionAccesses.js'),
    ConnectionMonitors = require('./connection/ConnectionMonitors.js'),
    ConnectionAccount = require('./connection/ConnectionAccount.js'),
    CC = require('./connection/ConnectionConstants.js'),
    Datastore = require('./Datastore.js'),
    _ = require('lodash');

/**
 * @class Connection
 * Create an instance of Connection to Pryv API.
 * The connection will be opened on
 * http[s]://&lt;username>.&lt;domain>:&lt;port>/&lt;extraPath>?auth=&lt;auth>
 *
 * @example
 * // create a connection for the user 'pryvtest' with the token 'TTZycvBTiq'
 * var conn = new pryv.Connection({username: 'pryvtest', auth: 'TTZycvBTiq'});
 *
 * @constructor
 * @this {Connection}
 * @param {Object} [settings]
 * @param {string} settings.username
 * @param {string} settings.auth - the authorization token for this username
 * @param {boolean} [settings.staging = false] use Pryv's staging servers
 * @param {number} [settings.port = 443]
 * @param {string} [settings.domain = 'pryv.io'] change the domain. use "settings.staging = true" to
 * activate 'pryv.in' staging domain.
 * @param {boolean} [settings.ssl = true] Use ssl (https) or no
 * @param {string} [settings.extraPath = ''] append to the connections. Must start with a '/'
 */
module.exports = Connection;
function Connection() {
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
      settings.staging = urlInfo.environment !== 'production';
    }
  }
  this._serialId = Connection._serialCounter++;

  this.settings = _.extend({
    port: 443,
    ssl: true,
    extraPath: '',
    staging: false
  }, settings);
  this.settings.domain   = settings.domain ?
      settings.domain : utility.urls.domains.server[settings.staging ? 'staging' : 'production'];

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

}

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
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (this.datastore) { return this.datastore.init(callback); }
  this.datastore = new Datastore(this);
  this.accessInfo(function (error) {
    if (error) { return callback(error); }
    this.datastore.init(callback);
  }.bind(this));
  return this;
};


/**
 * Set username / auth to this Connection
 * @param credentials key / value map containing username and token fields
 * @param callback
 */
Connection.prototype.attachCredentials = function (credentials, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (!credentials.username || !credentials.auth) {
    callback('error: incorrect input parameters');
  } else {
    this.username = credentials.username;
    this.auth = credentials.auth;
    callback(null, this);
  }
};

/**
 * Get access information related this connection. This is also the best way to test
 * that the combination username/token is valid.
 * @param {Connection~accessInfoCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.accessInfo = function (callback) {
  if (this._accessInfo) {
    return this._accessInfo;
  }
  this.request({
    method: 'GET',
    path: '/access-info',
    callback: function (error, result) {
      if (!error) {
        this._accessInfo = result;
      }
      if (typeof(callback) === 'function') {
        return callback(error, result);
      }
    }.bind(this)
  });
  return this;
};

/**
 * Get the private profile related this connection.
 * @param {Connection~privateProfileCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.privateProfile = function (callback) {
  if (this._privateProfile) {
    return this._privateProfile;
  }
  this.profile.getPrivate(null, function (error, result) {
    if (result && result.message) {
      error = result;
    }
    if (!error) {
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
 * @param {Object} params object with
 * @param {string} params.method - GET | POST | PUT | DELETE
 * @param {string} params.path - to resource, starting with '/' like '/events'
 * @param {Object} params.jsonData - data to POST or PUT
 * @param {Boolean} params.isFile indicates if the data is a binary file.
 * @params {string} [params.parseResult = 'json'] - 'json|binary'
 * @param {Connection~requestCallback} params.callback called when the request is finished
 * @param {Connection~requestCallback} params.progressCallback called when the request gives
 * progress updates
 */
Connection.prototype.request = function (params) {

  if (arguments.length > 1) {
    console.warn('Connection.request(method, path, callback, jsonData, isFile, progressCallback)' +
    ' is deprecated. Please use Connection.request(params).', arguments);
    params = {};
    params.method = arguments[0];
    params.path = arguments[1];
    params.callback = arguments[2];
    params.jsonData = arguments[3];
    params.isFile = arguments[4];
    params.progressCallback = arguments[5];
  }

  if (typeof(params.callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  var headers =  { 'authorization': this.auth };
  var withoutCredentials = false;
  var payload = JSON.stringify({});
  if (params.jsonData && !params.isFile) {
    payload = JSON.stringify(params.jsonData);
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  if (params.isFile) {
    payload = params.jsonData;
    headers['Content-Type'] = 'multipart/form-data';
    headers['X-Requested-With'] = 'XMLHttpRequest';
    withoutCredentials = true;
  }

  var request = utility.request({
    method : params.method,
    host : getHostname(this),
    port : this.settings.port,
    ssl : this.settings.ssl,
    path : this.settings.extraPath + params.path,
    headers : headers,
    payload : payload,
    progressCallback: params.progressCallback,
    //TODO: decide what callback convention to use (Node or jQuery)
    success : onSuccess.bind(this),
    error : onError.bind(this),
    withoutCredentials: withoutCredentials,
    parseResult: params.parseResult
  });

  /**
   * @this {Connection}
   */
  function onSuccess(data, responseInfo) {

    var apiVersion = responseInfo.headers['API-Version'] ||
      responseInfo.headers[CC.Api.Headers.ApiVersion];

    // test if API is reached or if we headed into something else
    if (!apiVersion) {
      var error = {
        id: CC.Errors.API_UNREACHEABLE,
        message: 'Cannot find API-Version',
        details: 'Response code: ' + responseInfo.code +
        ' Headers: ' + JSON.stringify(responseInfo.headers)
      };
      return params.callback(error, null, responseInfo);
    } else if (data.error) {
      return params.callback(data.error, null, responseInfo);
    }
    this.serverInfos.lastSeenLT = (new Date()).getTime();
    this.serverInfos.apiVersion = apiVersion || this.serverInfos.apiVersion;
    if (_.has(responseInfo.headers, CC.Api.Headers.ServerTime)) {
      this.serverInfos.deltaTime = (this.serverInfos.lastSeenLT / 1000) -
      responseInfo.headers[CC.Api.Headers.ServerTime];
    }

    params.callback(null, data, responseInfo);
  }

  function onError(error, responseInfo) {
    var errorTemp = {
      id : CC.Errors.API_UNREACHEABLE,
      message: 'Error on request ',
      details: 'ERROR: ' + error
    };
    params.callback(errorTemp, null, responseInfo);
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

// --------- login


/**
 * static method to login, returns a connection object in the callback if the username/password
 * pair is valid for the provided appId.
 *
 * @param params key / value map containing username, password and appId fields and optional
 * domain and origin fields
 * @param callback
 */
Connection.login = function (params, callback) {

  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  var headers = {
    'Content-Type': 'application/json'
  };

  if (!utility.isBrowser()) {
    var origin = 'https://sw.';
    origin = params.origin ? origin + params.origin :
    origin + utility.urls.domains.client.production;
    _.extend(headers, {Origin: origin});
  }

  var domain = params.domain || utility.urls.domains.client.production;

  var pack = {
    method: 'POST',
    headers: headers,
    ssl: true,
    host: params.username + '.' + domain,
    path: '/auth/login/',
    payload: JSON.stringify({
      appId: params.appId,
      username: params.username,
      password: params.password
    }),

    success: function (data, responseInfo) {
      if (data.error) {
        return callback(data.error, null, responseInfo);
      }
      var settings = {
        username: params.username,
        auth: data.token,
        domain: domain
        // TODO: set staging if in this mode
      };
      return callback(null, new Connection(settings), responseInfo);
    },

    error: function (error, responseInfo) {
      callback(error, null, responseInfo);
    }
  };

  utility.request(pack);
};


// --------- private utils

function getHostname(connection) {
  return connection.settings.hostname ||
      connection.username ?
      connection.username + '.' + connection.settings.domain : connection.settings.domain;
}
