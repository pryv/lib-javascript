//TODO align with XHR error

//TODO: sort out the callback convention

var FormData = require('form-data');
var _ = require('lodash');

/**
 * executes the low-level HTTP request.
 *
 * @param {Object} pack json with
 * @param {Object} [pack.method = 'GET'] : 'GET/DELETE/POST/PUT'
 * @param {String} pack.host : fully qualified host name
 * @param {Number} [pack.port] : port to use
 * @param {String} pack.path : the request PATH
 * @param {Object} [pack.headers] : key / value map of headers
 * @param {Object} [pack.payload] : the payload -- only with POST/PUT
 * @param {String} [pack.parseResult = 'json'] : 'text' for no parsing
 * @param {Function} pack.success : function (data, responseInfo), called when no error occurs in
 * the network or the JSON parsing. data contains the parsed response body, responseInfo contains
 * the headers and HTTP status code.
 * @param {Function} pack.error : function (error, [responseInfo]), called when a network error or
 * JSON parsing error occurs
 * @param {Boolean} [pack.ssl = true]
 */
module.exports = function (pack) {

  // request TYPE
  pack.method = pack.method || 'GET';

  var parseResult = pack.parseResult || 'json';

  // // choose between HTTP and HTTPS
  var httpMode = pack.ssl ? 'https' : 'http';
  var http = require(httpMode);

  var httpOptions = {
    host: pack.host,
    path: pack.path,
    port: pack.port || (pack.ssl ? 443 : 80), // if no port is specified, choose HTTPS or HTTP default ports
    method: pack.method,
    headers: pack.headers
  };

  // When creating an attachment
  if (pack.payload instanceof FormData) {
    httpOptions.method = 'POST';
    _.extend(httpOptions.headers, pack.payload.getHeaders());
  } else {
    // if some data is sent to the Back-End, set Content-Length header accordingly
    if (pack.payload) {
      pack.headers['Content-Length'] = Buffer.byteLength(pack.payload, 'utf-8'); // eslint-disable-line no-undef
    }
  }

  var req = http.request(httpOptions, function (res) {
    var responseInfo = {
      code: res.statusCode,
      headers: res.headers
    };

    if (parseResult === 'json' || (parseResult === 'binary' &&
      (res.statusCode < 200 || res.statusCode >= 300))) {
      // We load the full response body and parse the JSON
      var bodyarr = [];
      res.on('data', function (chunk) {
        bodyarr.push(chunk);
      });

      res.on('end', function () {
        var data = null;
        try {
          var response = bodyarr.join('').trim() === '' ? '{}' : bodyarr.join('').trim();
          data = JSON.parse(response);
        } catch (error) {
          return pack.error('request failed to parse JSON in response' +
            bodyarr.join('') + '\n' + HttpRequestDetails, responseInfo);
        }
        return pack.success(data, responseInfo);
      });

    } else { // binary response body without errors, we return a readable stream
      return pack.success(res, responseInfo);
    }
  });

  var HttpRequestDetails = 'Request: ' + httpOptions.method + ' ' +
    httpMode + '://' + httpOptions.host + ':' + httpOptions.port + '' + httpOptions.path;

  req.on('error', function (e) {
    return pack.error(e.message + '\n' + HttpRequestDetails);
  });

  req.on('socket', function (socket) {
    socket.setTimeout(30000);
    socket.on('timeout', function () {
      req.abort();
      return pack.error('Timeout' + '\n' + HttpRequestDetails);
    });
  });


  if (pack.payload instanceof FormData) {
    pack.payload.pipe(req);
  } else {
    if (pack.payload) {
      req.write(pack.payload, 'utf8');
    }
  }
  req.end();

  return req;
};
