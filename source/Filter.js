var _ = require('underscore'),
    SignalEmitter = require('./utility/SignalEmitter.js');

/**
 * TODO Filter is badly missing a correct documentation
 * @constructor
 */
var Filter = module.exports = function Filter(settings) {
  SignalEmitter.extend(this, Messages, 'Filter');

  this._settings = _.extend({
    //TODO: set default values
    streams: null, //ids
    tags: null,
    fromTime: null,  // serverTime
    toTime: null,  // serverTime
    limit: null,
    skip: null,
    types: null,
    modifiedSince: null,
    state: null
  }, settings);
};

var Messages = Filter.Messages = {
  /**
   * generic change event called on any change
   * content: {filter, signal, content}
   **/
  ON_CHANGE : 'changed',
  /**
   * called on streams changes
   * content: streams
   */
  STREAMS_CHANGE : 'streamsChanged',

  /**
   * called on streams structure changes
   * content: changes
   */
  STRUCTURE_CHANGE : 'structureChange',

  /*
   * called on date changes
   * content: streams
   */
  DATE_CHANGE : 'timeFrameChanged',

  /*
   * called on state changes
   * content: {state: value}
   */
  STATE_CHANGE : 'stateChanged'
};

// TODO
// redundant with get
function _normalizeTimeFrameST(filterData) {
  var result = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  if (filterData.fromTime || filterData.fromTime === 0) {
    result[0] = filterData.fromTime;
  }
  if (filterData.toTime || filterData.toTime === 0) {
    result[1] = filterData.toTime;
  }
  return result;
}



/**
 * TODO write doc
 * TODO complete with tags and state and modified and..
 * check if this event is in this filter
 */
Filter.prototype.matchEvent = function (event) {
  if (event.time > this.toTimeSTNormalized) { return false; }
  if (event.time < this.fromTimeSTNormalized) { return false; }


  if (this._settings.state !== 'all') {
    if (event.trashed) { return false; }
  }

  if (this._settings.streams) {

    if (this._settings.streams.length === 0) { return false; }

    if (this._settings.streams.indexOf(event.streamId) < 0) {
      var found = false;
      if (!event.stream) {
        return false;
      }
      event.stream.ancestors.forEach(function (ancestor) {
        if (this._settings.streams.indexOf(ancestor.id) >= 0) {
          if (this._settings.state !== 'all') {
            if (ancestor.trashed) { return false; }
          }
          found = true;
        }
      }.bind(this));
      if (!found) {
        return false;
      }
    }
  }



  // TODO complete test
  return true;
};

/**
 * Compare this filter with data form another filter
 * @param {Object} filterDataTest data got with filter.getData
 * @returns keymap \{ timeFrame : -1, 0 , 1 \}
 * (1 = more than test, -1 = less data than test, 0 == no changes)
 */
Filter.prototype.compareToFilterData = function (filterDataTest) {
  var result = { timeFrame : 0, streams : 0 };


  // timeFrame
  var myTimeFrameST = [this.fromTimeSTNormalized, this.toTimeSTNormalized];
  var testTimeFrameST = _normalizeTimeFrameST(filterDataTest);
  console.log(myTimeFrameST);
  console.log(testTimeFrameST);

  if (myTimeFrameST[0] < testTimeFrameST[0]) {
    result.timeFrame = 1;
  } else if (myTimeFrameST[0] > testTimeFrameST[0]) {
    result.timeFrame = -1;
  }
  if (result.timeFrame <= 0) {
    if (myTimeFrameST[1] > testTimeFrameST[1]) {
      result.timeFrame = 1;
    } else  if (myTimeFrameST[1] < testTimeFrameST[1]) {
      result.timeFrame = -1;
    }
  }

  // streams
  //TODO look if this processing can be optimized

  var nullStream = 0;
  if (! this._settings.streams) {
    if (filterDataTest.streams) {
      result.streams = 1;
    }
    nullStream = 1;
  }
  if (! filterDataTest.streams) {
    if (this._settings.streams) {
      result.streams = -1;
    }
    nullStream = 1;
  }

  if (! nullStream) {
    var notinTest = _.difference(this._settings.streams, filterDataTest.streams);
    if (notinTest.length > 0) {
      result.streams = 1;
    } else {
      var notinLocal = _.difference(filterDataTest.streams, this._settings.streams);
      if (notinLocal.length > 0) {
        result.streams = -1;
      }
    }
  }

  return result;
};

/**
 * Create a clone of this filter and changes some properties
 * @param properties
 * @returns pryv.Filter
 */
Filter.prototype.cloneWithDelta = function (properties) {
  var newProps = _.clone(this._settings);
  _.extend(newProps, properties);
  return new Filter(newProps);
};

/**
 * returns a dictionary containing all the settings of this filter.
 * @param ignoreNulls (optional) boolean
 * @param withDelta (optional) adds this differences on the data
 * @returns {*}
 */
Filter.prototype.getData = function (ignoreNulls, withDelta) {
  ignoreNulls = ignoreNulls || false;
  var result = _.clone(this._settings);
  if (withDelta)  {
    _.extend(result, withDelta);
  }
  if (ignoreNulls) {
    _.each(_.keys(result), function (key) {
      if ((result[key] === null)) {
        delete result[key];
      }
    });
  }
  return result;
};

/**
 * @private
 */
Filter.prototype._fireFilterChange = function (signal, content, batch) {
  // generic
  this._fireEvent(Messages.ON_CHANGE, {filter: this, signal: signal, content: content}, batch);
  // specific
  this._fireEvent(signal, content, batch);
};

/**
 * TODO review documentation and add example
 * Change several values of the filter in batch.. this wil group all events behind a batch id
 * @param keyValueMap {Object}
 * @param batch {SignalEmitter~Batch}
 */
Filter.prototype.set = function (keyValueMap, batch) {
  batch = this.startBatch('set', batch);

  _.each(keyValueMap, function (value, key) {
    this._setValue(key, value, batch);
  }.bind(this));

  batch.done('set');
};

/**
 * Internal that take in charge of changing values
 * @param keyValueMap
 * @param batch
 * @private
 */
Filter.prototype._setValue = function (key, newValue, batch) {
  batch = this.startBatch('setValue:' + key, batch);

  if (key === 'limit') {
    this._settings.limit = newValue;

    // TODO handle changes
    return;
  }


  if (key === 'state') {
    if (this._settings.state !== newValue) {
      this._settings.state = newValue;
      this._fireFilterChange(Messages.STATE_CHANGE, {state: newValue}, batch);
    }
    batch.done('setValue:' + key);
    return;
  }

  if (key === 'timeFrameST') {
    if (! _.isArray(newValue) || newValue.length !== 2) {
      throw new Error('Filter.timeFrameST is an Array of two timestamps [fromTime, toTime]');
    }
    if (this._settings.fromTime !== newValue[0] || this._settings.toTime !== newValue[1]) {
      this._settings.fromTime = newValue[0];
      this._settings.toTime = newValue[1];
      this._fireFilterChange(Messages.DATE_CHANGE, this.timeFrameST, batch);
    }
    batch.done('setValue:' + key);
    return;
  }

  if (key === 'streamsIds') {

    if (newValue === null || typeof newValue === 'undefined') {
      if (this._settings.streams === null) {

        return;
      }
      newValue = null;
    } else if (! _.isArray(newValue)) {
      newValue = [newValue];
    }

    // TODO check that this stream is valid
    this._settings.streams = newValue;
    this._fireFilterChange(Messages.STREAMS_CHANGE, this.streams, batch);
    batch.done('setValue:' + key);
    return;
  }

  batch.done('setValue:' + key);
  throw new Error('Filter has no property : ' + key);
};

/**
 * get toTime, return Number.POSITIVE_INFINITY if null
 */
Object.defineProperty(Filter.prototype, 'toTimeSTNormalized', {
  get: function () {
    if (this._settings.toTime || this._settings.toTime === 0) {
      return this._settings.toTime;
    }
    return Number.POSITIVE_INFINITY;
  }
});

/**
 * get fromTime, return Number.POSITIVE_INFINITY if null
 */
Object.defineProperty(Filter.prototype, 'fromTimeSTNormalized', {
  get: function () {
    if (this._settings.fromTime || this._settings.fromTime === 0) {
      return this._settings.fromTime;
    }
    return Number.NEGATIVE_INFINITY;
  }
});



/**
 * timeFrameChange ..  [fromTime, toTime]
 * setting them to "null" => ALL
 */
Object.defineProperty(Filter.prototype, 'timeFrameST', {
  get: function () {
    return [this._settings.toTime, this._settings.fromTime];
  },
  set: function (newValue) {
    this._setValue('timeFrameST', newValue);
    return this.timeFrameST;
  }
});


/**
 * StreamIds ..
 * setting them to "null" => ALL and to "[]" => NONE
 */
Object.defineProperty(Filter.prototype, 'streamsIds', {
  get: function () {
    return this._settings.streams;
  },
  set: function (newValue) {
    this._setValue('streamsIds', newValue);
    return this._settings.streams;
  }
});


/**
 * return true if context (stream is on a single stream)
 * This is usefull to check when creating and event in a context.
 * This way, no need to ask the user for a stream specification.
 * TODO determine if this should stay in the lib.. or handle by apps
 */
Filter.prototype.focusedOnSingleStream = function () {
  if (_.isArray(this._settings.streams) && this._settings.streams.length === 1) {
    return this._settings.streams[0];
  }
  return null;
};

/**
 * An pryv Filter or an object corresponding at what we can get with Filter.getData().
 * @typedef {(Filter|Object)} FilterLike
 * @property {String[]} [streams]
 * @property {String[]} [tags]
 * @property {number} [fromTime] -- serverTime
 * @property {number} [toTime] -- serverTime
 * @property {number} [modifiedSince] -- serverTime
 * @property {number} [limit] -- response to 'n' events
 * @property {number} [skip] -- skip the first 'n' events of he response
 */

