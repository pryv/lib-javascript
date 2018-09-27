var _ = require('lodash');



/**
 * TODO write documentation  with use cases.. !!
 * @type {Function}
 */
var Stream = module.exports = function Stream(connection, data) {
  this.connection = connection;

  this.serialId = this.connection.serialId + '>S' + this.connection._streamSerialCounter++;
  /** those are only used when no datastore **/
  this._parent = null;
  this.parentId = null;
  this.trashed = false;
  this._children = [];
  data.name = _.escape(data.name);
  _.extend(this, data);
};

Stream.RW_PROPERTIES =
  ['name', 'parentId', 'singleActivity', 'clientData', 'trashed'];

/**
 * get Json object ready to be posted on the API
 */
Stream.prototype.getData = function () {
  var data = {};
  _.each(Stream.RW_PROPERTIES, function (key) { // only set non null values
    if (_.has(this, key)) { data[key] = this[key]; }
  }.bind(this));
  return data;
};


/**
 * Set or erase clientData properties
 * @example // set x=25 and delete y
 * stream.setClientData({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValueMap
 * @param {Connection~requestCallback} callback
 */
Stream.prototype.setClientData = function (keyValueMap, callback) {
  return this.connection.streams.setClientData(this, keyValueMap, callback);
};

Object.defineProperty(Stream.prototype, 'parent', {
  get: function () {

    if (!this.parentId) {
      return null;
    }
    if (!this.connection.datastore) { // we use this._parent and this._children
      return this._parent;
    }

    return this.connection.datastore.getStreamById(this.parentId);
  },
  set: function (p) {
    if (p instanceof Stream) {
      p = p.id;
    }

    this.parentId = p;

    if (!this.connection.datastore) { // we use this._parent and this._children
      this._parent = p;
    }
    throw new Error('Stream.parent property is read only');
  }
});

/**
 * TODO write documentation
 * Does not return trashed childrens
 */
Object.defineProperty(Stream.prototype, 'children', {
  get: function () {
    if (!this.connection.datastore) { // we use this._parent and this._children
      return this._children;
    }
    var children = [];
    _.each(this.childrenIds, function (childrenId) {
      try {
        var child = this.connection.datastore.getStreamById(childrenId);
        if (child.parentId === this.id && ! child.trashed) { // exclude trashed childs
          children.push(child);
        }
      } catch (e) {
        console.warn('cannot find child', e);
      }
    }.bind(this));
    return children;
  },
  set: function () {
    throw new Error('Stream.children property is read only');
  }
});

// TODO write test
Object.defineProperty(Stream.prototype, 'ancestors', {
  get: function () {
    if (!this.parentId || this.parent === null) {
      return [];
    }
    var result = this.parent.ancestors;
    result.push(this.parent);
    return result;
  },
  set: function () {
    throw new Error('Stream.ancestors property is read only');
  }
});






