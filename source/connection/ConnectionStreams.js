const _ = require('lodash');
const utility = require('../utility/utility.js');
const Stream = require('../Stream.js');
const CC = require('./ConnectionConstants.js');

/**
 * @class ConnectionStreams
 * @description
 * ##Coverage of the API
 *
 *  * GET /streams -- 100%
 *  * POST /streams -- only data (no object)
 *  * PUT /streams -- 0%
 *  * DELETE /streams/{stream-id} -- 0%
 *
 *
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionStreams(connection) {
  this.connection = connection;
  this._streamsIndex = {};
}


/**
 * @typedef ConnectionStreamsOptions parameters than can be passed along a Stream request
 * @property {string} parentId  if parentId is null you will get all the "root" streams.
 * @property {string} [state] 'all' || null  - if null you get only "active" streams
 **/


ConnectionStreams.prototype.get = function (options, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (this.connection.datastore) {
    var resultTree = [];
    if (options && _.has(options, 'parentId')) {
      resultTree = this.connection.datastore.getStreamById(options.parentId).children;
    } else if (options && _.has(options, 'state')) {
      resultTree = this.connection.datastore.getStreams(options.state);
    } else {
      resultTree = this.connection.datastore.getStreams();
    }
    if (resultTree.length > 0) {
      callback(null, resultTree);
    } else {
      this._getObjects(options, callback);
    }
  } else {
    this._getObjects(options, callback);
  }
};

/**
 * TODO make it object-aware like for Events
 * TODO why to we need a _create ?
 * TODO could return Stream object synchronously before calling the API
 * @param streamData
 * @param callback
 */
ConnectionStreams.prototype.create = function (streamData, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  streamData = _.pick(streamData, 'id', 'name', 'parentId', 'singleActivity',
    'clientData', 'trashed');
  return this._createWithData(streamData, callback);
};


ConnectionStreams.prototype.update = function (streamData, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  if (typeof streamData === 'object') {
    streamData = [ streamData ];
  }

  _.each(streamData, function (e) {
    var s = _.pick(e, 'name', 'parentId', 'singleActivity',
      'clientData', 'trashed');
    this.connection.request({
      method: 'PUT',
      path: '/streams/' + e.id,
      callback: function (error, result) {
        if (!error && result && result.stream) {

          this._getObjects(null, function (err, res) {
            if (!err && res) {
              if (!this.connection.datastore) {
                result = new Stream(this.connection, result.stream);
              } else {
                result = this.connection.datastore.createOrReuseStream(result.stream);
                if (result.parent &&
                  _.indexOf(result.parent.childrenIds, result.id) === -1) {
                  result.parent.childrenIds.push(result.id);
                }
              }
            } else {
              result = null;
            }

            callback(err, result);
          }.bind(this));

        } else {
          result = null;
        }
        if (error) {
          callback(error, null);
        }
      }.bind(this),
      jsonData: s
    });
  }.bind(this));
};


/**
 * @param streamData
 * @param callback
 * @param mergeEventsWithParent
 */
ConnectionStreams.prototype.delete = ConnectionStreams.prototype.trash =
  function (streamData, callback, mergeEventsWithParent) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    var id;
    if (streamData && streamData.id) {
      id = streamData.id;
    } else {
      id = streamData;
    }

    mergeEventsWithParent = mergeEventsWithParent ? true : false;
    this.connection.request({
      method: 'DELETE',
      path: '/streams/' + id + '?mergeEventsWithParent=' + mergeEventsWithParent,
      callback: function (error, resultData) {
        var stream = null;
        if (!error && resultData && resultData.stream) {
          streamData.id = resultData.stream.id;
          stream = new Stream(this.connection, resultData.stream);
          if (this.connection.datastore) {
            this.connection.datastore.indexStream(stream);
          }
        }

        return callback(error, error ? null : resultData.stream);
      }.bind(this)
    });
  };


/**
 * TODO remove it's unused
 * @param {ConnectionStreamsOptions} options
 * @param {ConnectionStreams~getCallback} callback - handles the response
 */
ConnectionStreams.prototype.updateProperties = function (stream, properties, options, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  if (this.connection.datastore) {
    var resultTree = [];
    if (options && _.has(options, 'parentId')) {
      resultTree = this.connection.datastore.getStreamById(options.parentId).children;
    } else {
      resultTree = this.connection.datastore.getStreams();
    }
    callback(null, resultTree);
  } else {
    this._getObjects(options, callback);
  }
};


/**
 * TODO remove it's unused and could lead to miscomprehension
 * Get a Stream by it's Id.
 * Works only if fetchStructure has been done once.
 * @param {string} streamId
 * @throws {Error} Connection.fetchStructure must have been called before.
 */
ConnectionStreams.prototype.getById = function (streamId) {
  if (!this.connection.datastore) {
    throw new Error('Call connection.fetchStructure before, to get automatic stream mapping');
  }
  return this.connection.datastore.getStreamById(streamId);
};


// ------------- Raw calls to the API ----------- //

/**
 * TODO rename _getStreams
 * get streams on the API
 * @private
 * @param {ConnectionStreams~options} opts
 * @param callback
 */
ConnectionStreams.prototype._getData = function (opts, callback) {
  this.connection.request({
    method: 'GET',
    path: opts ? '/streams?' + utility.getQueryParametersString(opts) : '/streams',
    callback: callback
  });
};


/**
 * TODO makes it return the Stream object before doing the online request
 * TODO create a streamLike Object
 * Create a stream on the API with a jsonObject
 * @private
 * @param {Object} streamData an object array.. typically one that can be obtained with
 * stream.getData()
 * @param callback
 */
ConnectionStreams.prototype._createWithData = function (streamData, callback) {
  this.connection.request({
    method: 'POST',
    path: '/streams',
    jsonData: streamData,
    callback: function (err, resultData) {
      var stream = null;
      if (!err && resultData) {
        streamData.id = resultData.stream.id;
        stream = new Stream(this.connection, resultData.stream);
        if (this.connection.datastore) {
          this.connection.datastore.indexStream(stream);
        }
      }
      if (_.isFunction(callback)) {
        return callback(err, err ? null : stream);
      }
    }.bind(this)
  });
};

/**
 * Update a stream on the API with a jsonObject
 * @private
 * @param {Object} streamData an object array.. typically one that can be obtained with
 * stream.getData()
 * @param callback
 */
ConnectionStreams.prototype._updateWithData = function (streamData, callback) {
  this.connection.request({
    method: 'PUT',
    path: '/streams/' + streamData.id,
    jsonData: streamData,
    callback: callback
  });
};

// -- helper for get --- //

/**
 * @private
 * @param {ConnectionStreams~options} options
 */
ConnectionStreams.prototype._getObjects = function (options, callback) {
  options = options || {};
  options.parentId = options.parentId || null;
  var streamsIndex = {};
  var resultTree = [];
  this._getData(options, function (error, result) {
    if (error) {
      return callback('Stream.get failed: ' + JSON.stringify(error));
    }
    var treeData = result.streams || result.stream;
    ConnectionStreams.Utils.walkDataTree(treeData, function (streamData) {
      var stream = new Stream(this.connection, streamData);
      streamsIndex[streamData.id] = stream;
      if (stream.parentId === options.parentId) { // attached to the rootNode or filter
        resultTree.push(stream);
        stream._parent = null;
        stream._children = [];
      } else {
        // localStorage will cleanup  parent / children link if needed
        stream._parent = streamsIndex[stream.parentId];
        stream._parent._children.push(stream);
      }
    }.bind(this));
    callback(null, resultTree);
  }.bind(this));
};


/**
 * Called once per streams
 * @callback ConnectionStreams~walkTreeEachStreams
 * @param {Stream} stream
 */

/**
 * Called when walk is done
 * @callback ConnectionStreams~walkTreeDone
 */

/**
 * Walk the tree structure.. parents are always announced before childrens
 * @param {ConnectionStreams~options} options
 * @param {ConnectionStreams~walkTreeEachStreams} eachStream
 * @param {ConnectionStreams~walkTreeDone} done
 */
ConnectionStreams.prototype.walkTree = function (options, eachStream, done) {
  this.get(options, function (error, result) {
    if (error) {
      return done('Stream.walkTree failed: ' + error);
    }
    ConnectionStreams.Utils.walkObjectTree(result, eachStream);
    if (done) {
      done(null);
    }
  });
};


/**
 * Get the all the streams of the Tree in a list.. parents firsts
 * @param {ConnectionStreams~options} options
 * @param {ConnectionStreams~getFlatenedObjectsDone} done
 */
ConnectionStreams.prototype.getFlatenedObjects = function (options, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  var result = [];
  this.walkTree(options,
    function (stream) { // each stream
      result.push(stream);
    }, function (error) {  // done
      if (error) {
        return callback(error);
      }
      callback(null, result);
    }.bind(this));
};


/**
 * Utility to debug a tree structure
 * @param {ConnectionStreams[]} arrayOfStreams
 */
ConnectionStreams.prototype.getDisplayTree = function (arrayOfStreams) {
  return ConnectionStreams.Utils._debugTree(arrayOfStreams);
};

/**
 * Utility to get a Stream Tree as if was sent by the API
 * @param {ConnectionStreams[]} arrayOfStreams
 */
ConnectionStreams.prototype.toJSON = function (arrayOfStreams) {
  return ConnectionStreams.Utils.toJSON(arrayOfStreams);
};


// TODO Validate that it's the good place for them .. Could have been in Stream or utility
ConnectionStreams.Utils = {

  /**
   * Make a pure JSON object from an array of Stream.. shoudl be the same than what we
   * get from the API
   * @param streamArray
   * @param eachStream
   */
  toJSON: function (arrayOfStreams) {

    var result = [];
    if (!arrayOfStreams || !(arrayOfStreams instanceof Array)) {
      throw new Error('expected an array for argument :' + arrayOfStreams);
    }

    _.each(arrayOfStreams, function (stream) {
      if (!stream || !(stream instanceof Stream)) {
        throw new Error('expected a Streams array ' + stream);
      }
      result.push({
        name: stream.name,
        id: stream.id,
        parentId: stream.parentId,
        singleActivity: stream.singleActivity,
        clientData: stream.clientData,
        trashed: stream.trashed,
        created: stream.created,
        createdBy: stream.createdBy,
        modified: stream.modified,
        modifiedBy: stream.modifiedBy,
        children: ConnectionStreams.Utils.toJSON(stream.children)
      });
    });
    return result;
  },

  /**
   * Walk thru a streamArray of objects
   * @param streamTree
   * @param callback function(stream)
   */
  walkObjectTree: function (streamArray, eachStream) {
    _.each(streamArray, function (stream) {
      eachStream(stream);
      ConnectionStreams.Utils.walkObjectTree(stream.children, eachStream);
    });
  },

  /**
   * Walk thru a streamTree obtained from the API. Replaces the children[] by childrenIds[].
   * This is used to Flaten the Tree
   * @param streamTree
   * @param callback function(streamData, subTree)  subTree is the descendance tree
   */
  walkDataTree: function (streamTree, callback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    _.each(streamTree, function (streamStruct) {
      var stream = _.omit(streamStruct, 'children');
      stream.childrenIds = [];
      var subTree = {};
      callback(stream, subTree);
      if (_.has(streamStruct, 'children')) {
        subTree = streamStruct.children;

        _.each(streamStruct.children, function (childTree) {
          stream.childrenIds.push(childTree.id);
        });
        this.walkDataTree(streamStruct.children, callback);
      }
    }.bind(this));
  },


  /**
   * ShowTree
   */
  _debugTree: function (arrayOfStreams) {
    var result = [];
    if (!arrayOfStreams || !(arrayOfStreams instanceof Array)) {
      throw new Error('expected an array for argument :' + arrayOfStreams);
    }
    _.each(arrayOfStreams, function (stream) {
      if (!stream || !(stream instanceof Stream)) {
        throw new Error('expected a Streams array ' + stream);
      }
      result.push({
        name: stream.name,
        id: stream.id,
        parentId: stream.parentId,
        children: ConnectionStreams.Utils._debugTree(stream.children)
      });
    });
    return result;
  }

};

module.exports = ConnectionStreams;

/**
 * Called with the desired streams as result.
 * @callback ConnectionStreams~getCallback
 * @param {Object} error - eventual error
 * @param {Stream[]} result
 */

