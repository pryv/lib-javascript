var apiPathBookmarks = '/followed-slices',
  Connection = require('../Connection.js'),
  _ = require('lodash'),
  CC = require('./ConnectionConstants.js');

/**
 * @class Bookmarks
 * @link http://api.pryv.com/reference.html#data-structure-subscriptions-aka-bookmarks
 * @param {Connection} connection
 * @constructor
 */
function Bookmarks(connection, Conn) {
  this.connection = connection;
  Connection = Conn;
}
/**
 * @param {Connection~requestCallback} callback
 */
Bookmarks.prototype.get = function (callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'GET',
    path: apiPathBookmarks,
    callback: function (error, res) {
      var result = [],
        bookmarks = res.followedSlices || res.followedSlice;
      _.each(bookmarks, function (bookmark) {
        bookmark.url = bookmark.url.replace(/\.li/, '.in');
        bookmark.url = bookmark.url.replace(/\.me/, '.io');
        var conn =  new Connection({
          auth: bookmark.accessToken,
          url: bookmark.url,
          name: bookmark.name,
          bookmarkId: bookmark.id
        });
        result.push(conn);
      });
      callback(error, result);
    }
  });
};

/**
 * TODO complete documentation
 * @param bookmark
 * @param callback
 * @returns {*}
 */
Bookmarks.prototype.create = function (bookmark, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (bookmark.name && bookmark.url && bookmark.accessToken) {
    this.connection.request({
      method: 'POST',
      path: apiPathBookmarks,
      jsonData: bookmark,
      callback: function (err, result) {
        var error = err;
        if (!error) {
          var conn =  new Connection({
            auth: bookmark.accessToken,
            url: bookmark.url,
            name: bookmark.name,
            bookmarkId: result.followedSlice.id
          });
          bookmark = conn;
        }
        callback(error, bookmark);
      }
    });
    return bookmark;
  }
};

/**
 * TODO complete documentation
 * @param bookmarkId
 * @param callback
 */
Bookmarks.prototype.delete = function (bookmarkId, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: apiPathBookmarks + '/' + bookmarkId,
    callback: function (err, result) {
      var error = err;
      if (result && result.message) {
        error = result;
      }
      callback(error, result);
    }
  });
};

module.exports = Bookmarks;