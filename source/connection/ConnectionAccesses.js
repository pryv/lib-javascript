var apiPathAccesses = '/accesses';
var _ = require('lodash'),
  CC = require('./ConnectionConstants.js');

/**
 * @class Accesses
 * @link http://api.pryv.com/reference.html#methods-accesses
 * @link http://api.pryv.com/reference.html#data-structure-access
 * @param {Connection} connection
 * @constructor
 */
function Accesses(connection) {
  this.connection = connection;
}
/**
 * @param {Connection~requestCallback} callback
 */
Accesses.prototype.get = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'GET',
    path: apiPathAccesses,
    callback: function (err, res) {
      if (err) {
        return callback(err);
      }
      var accesses = res.accesses || res.access;
      callback(null, accesses);
    }
  });
};

/**
 * TODO complete documentation
 * @param access
 * @param callback
 */
Accesses.prototype.create = function (access, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'POST',
    path: apiPathAccesses,
    callback: function (err, res) {
      if (err) {
        return callback(err);
      }
      callback(err, res.access);
    },
    jsonData: access
  });
};

/**
 * TODO complete documentation
 * @param access
 * @param callback
 */
Accesses.prototype.update = function (access, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (access.id) {
    this.connection.request({
      method: 'PUT',
      path: apiPathAccesses + '/' + access.id,
      jsonData: _.pick(access, 'name', 'deviceName', 'permissions'),
      callback: function (err, res) {
        if (err) {
          return callback(err);
        }
        callback(err, res.access);
      }
    });
  } else {
    return callback('No access id found');
  }
};

/**
 * TODO complete documentation
 * @param accessId
 * @param callback
 */
Accesses.prototype.delete = function (accessId, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: apiPathAccesses + '/' + accessId,
    callback: function (err, result) {
      if (err) {
        return callback(err);
      }
      callback(null, result);
    }
  });
};
module.exports = Accesses;