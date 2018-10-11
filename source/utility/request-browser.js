const logger = console;

/**
 *
 * @param {Object} pack json with
 * @param {Object} [pack.type = 'POST'] : 'GET/DELETE/POST/PUT'
 * @param {String} pack.host : fully qualified host name
 * @param {Number} pack.port : port to use
 * @param {String} pack.path : the request PATH
 * @param {Object} [pack.headers] : key / value map of headers
 * @param {Object} [pack.params] : the payload -- only with POST/PUT
 * @param {String} [pack.parseResult = 'json'] : 'text' for no parsing
 * @param {Function} pack.success : function (result, resultInfo)
 * @param {Function} pack.error : function (error, resultInfo)
 * @param {String} [pack.info] : a text
 * @param {Boolean} [pack.async = true]
 * @param {Number} [pack.expectedStatus] : http result code
 * @param {Boolean} [pack.ssl = true]
 * @param {Boolean} [pack.withoutCredentials = false]
 */
module.exports = function (pack)  {
  pack.info = pack.info || '';
  var parseResult = pack.parseResult || 'json';

  if (!pack.hasOwnProperty('async')) {
    pack.async = true;
  }

  // ------------ request TYPE
  pack.method = pack.method || 'POST';

  // ------------- request HEADERS


  pack.headers = pack.headers || {};

  if (pack.method === 'POST' || pack.method === 'PUT') {// add json headers is POST or PUT

    if (pack.headers['Content-Type'] === 'multipart/form-data') {
      delete pack.headers['Content-Type'];
    } else {
      pack.headers['Content-Type'] =
          pack.headers['Content-Type'] || 'application/json; charset=utf-8';
    }

    //if (pack.method === 'POST') {
    if (pack.params) {
      pack.params = JSON.stringify(pack.params);
    } else {
      pack.params = pack.payload || {};
    }
  }



  // -------------- error
  pack.error = pack.error || function (error) {
    throw new Error(JSON.stringify(error, function (key, value) {
      if (value === null) { return; }
      if (value === '') { return; }
      return value;
    }, 2));
  };

  var detail = pack.info + ', req: ' + pack.method + ' ' + pack.url;

  // --------------- request
  var xhr = _initXHR(),
      httpMode = pack.ssl ? 'https://' : 'http://',
      url = httpMode + pack.host + pack.path;
  xhr.open(pack.method, url, pack.async);
  xhr.withCredentials = pack.withoutCredentials ? false : true;


  xhr.onreadystatechange = function () {
    detail += ' xhrstatus:' + xhr.statusText;
    if (xhr.readyState === 0) {
      pack.callBackSent = 'error in request';
      pack.error({
        message: 'pryvXHRCall unsent',
        detail: detail,
        id: 'INTERNAL_ERROR',
        xhr: xhr
      });
    } else if (xhr.readyState === 4) {
      var result = null;

      if (parseResult === 'json') {
        var response = xhr.responseText;
        response = response.trim() === '' ? '{}' : response;
        try { result = JSON.parse(response); } catch (e) {
          return pack.error({
            message: 'Data is not JSON',
            detail: xhr.responseText + '\n' + detail,
            id: 'RESULT_NOT_JSON',
            xhr: xhr
          });
        }
      }
      var resultInfo = {
        xhr : xhr,
        code : xhr.status,
        headers : parseResponseHeaders(xhr.getAllResponseHeaders())
      };

      if (pack.callBackSent) {
        logger.error('xhr.onreadystatechange called with status==4 even if callback is done:' +
          pack.callBackSent);
        return;
      }
      pack.callBackSent = 'success';
      pack.success(result, resultInfo);
    }
  };
  if (pack.progressCallback && typeof(pack.progressCallback) === 'function') {
    xhr.upload.addEventListener('progress', function (e) {
      return pack.progressCallback(e);
    }, false);
  }
  for (var key in pack.headers) {
    if (pack.headers.hasOwnProperty(key)) {
      xhr.setRequestHeader(key, pack.headers[key]);
    }
  }

  //--- sending the request
  try {
    xhr.send(pack.params);
  } catch (e) {
    pack.callBackSent = 'error sending request';
    return pack.error({
      message: 'pryvXHRCall unsent',
      detail: detail,
      id: 'INTERNAL_ERROR',
      error: e,
      xhr: xhr
    });
  }
  return xhr;
};

/**
 * Method to initialize XMLHttpRequest.
 * @method _initXHR
 * @access private
 * @return object
 */
/* jshint -W117 */
var _initXHR = function () {
  var XHR = null;

  try { XHR = new XMLHttpRequest(); }
  catch (e) {
    try { XHR = new ActiveXObject('Msxml2.XMLHTTP'); } // eslint-disable-line no-undef
    catch (e2) {
      try { XHR = new ActiveXObject('Microsoft.XMLHTTP'); } // eslint-disable-line no-undef
      catch (e3) {
        logger.log('XMLHttpRequest implementation not found.');
      }
      logger.log('XMLHttpRequest implementation not found.');
    }
    logger.log('XMLHttpRequest implementation not found.');
  }
  return XHR;
};


/**
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
  var headers = {};
  if (!headerStr) {
    return headers;
  }
  var headerPairs = headerStr.split('\u000d\u000a');
  for (var i = 0; i < headerPairs.length; i++) {
    var headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    var index = headerPair.indexOf('\u003a\u0020');
    if (index > 0) {
      var key = headerPair.substring(0, index).toLowerCase();
      var val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }
  return headers;
}
