var utility = require('../utility/utility.js'),
  _ = require('underscore'),
  Filter = require('../Filter'),
  Event = require('../Event'),
  CC = require('./ConnectionConstants.js');

/**
 * @class ConnectionEvents
 *
 * Coverage of the API
 *  GET /events -- 100%
 *  POST /events -- only data (no object)
 *  POST /events/start -- 0%
 *  POST /events/stop -- 0%
 *  PUT /events/{event-id} -- 100%
 *  DELETE /events/{event-id} -- only data (no object)
 *  POST /events/batch -- only data (no object)
 *
 *  attached files manipulations are covered by Event
 *
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionEvents(connection) {
  this.connection = connection;
}


/**
 * @example
 * // get events from the Diary stream
 * conn.events.get({streamId : 'diary'},
 *  function(events) {
 *    console.log('got ' + events.length + ' events)
 *  }
 * );
 * @param {FilterLike} filter
 * @param {ConnectionEvents~getCallback} doneCallback
 * @param {ConnectionEvents~partialResultCallback} partialResultCallback
 */
ConnectionEvents.prototype.get = function (filter, doneCallback, partialResultCallback) {
  if (typeof(doneCallback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  //TODO handle caching
  var result = [];
  filter = filter || {};
  this._get(filter, function (error, res, extraInfos) {
    if (error) {
      result = null;
    } else {
      var eventList = res.events || res.event;
      _.each(eventList, function (eventData) {

        var event = null;
        if (!this.connection.datastore) { // no datastore   break
          event = new Event(this.connection, eventData);
        } else {
          event = this.connection.datastore.createOrReuseEvent(eventData);
        }

        result.push(event);

      }.bind(this));
      if (res.eventDeletions) {
        result.eventDeletions = res.eventDeletions;
      }
    }

    doneCallback(error, result, extraInfos);

    if (partialResultCallback) { partialResultCallback(result); }
  }.bind(this));

};

/**
 * @param {Event} event
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.update = function (event, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this._updateWithIdAndData(event.id, event.getData(), callback);
};

/**
 * @param {Event | eventId} event
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.delete = ConnectionEvents.prototype.trash = function (event, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.trashWithId(event.id, callback);
};

/**
 * @param {String} eventId
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.trashWithId = function (eventId, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: '/events/' + eventId,
    callback: function (error, result) {
      // assume there is only one event (no batch for now)
      if (result && result.event) {
        if (!this.connection.datastore) { // no datastore   break
          result = new Event(this.connection, result.event);
        } else {
          result = this.connection.datastore.createOrReuseEvent(result.event);
        }
      } else {
        result = null;
      }
      callback(error, result);

    }.bind(this)
  });
};

/**
 * This is the preferred method to create an event, or to create it on the API.
 * The function return the newly created object.. It will be updated when posted on the API.
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {Boolean} [start = false] if set to true will POST the event to /events/start
 * @return {Event} event
 */
ConnectionEvents.prototype.create = function (newEventlike, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  _create.call(this, newEventlike, callback, false);
};


/**
 * This is the preferred method to create and start an event, Starts a new period event.
 * This is equivalent to starting an event with a null duration. In singleActivity streams,
 * also stops the previously running period event if any.
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.start = function (newEventlike, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  _create.call(this, newEventlike, callback, true);
};


// common call for create and start
function _create(newEventlike, callback, start) {
  var event = null;
  if (newEventlike instanceof Event) {
    if (newEventlike.connection !== this.connection) {
      return callback(new Error('event.connection does not match current connection'));
    }
    if (newEventlike.id) {
      return callback(new Error('cannot create an event already existing on the API'));
    }
    event = newEventlike;
  } else {
    event = new Event(this.connection, newEventlike);
  }

  var url = '/events';
  if (start) { url = '/events/start'; }


  this.connection.request({
    method: 'POST',
    path: url,
    jsonData: event.getData(),
    callback: function (err, result, resultInfo) {
      if (!err && resultInfo.code !== 201) {
        err = {id: CC.Errors.INVALID_RESULT_CODE};
      }

      /**
       * Change will happend with offline caching...
       *
       * An error may hapend 400.. or other if app is behind an non-opened gateway. Thus making
       * difficult to detect if the error is a real bad request.
       * The first step would be to consider only bad request if the response can be identified
       * as coming from a valid api-server. If not, we should cache the event for later synch
       * then remove the error and send the cached version of the event.
       *
       */
      // TODO if err === API_UNREACHABLE then save event in cache
      if (result && !err) {
        _.extend(event, result.event);
        if (this.connection.datastore) {  // if datastore is activated register new event
          this.connection.datastore.addEvent(event);
        }
      }
      callback(err, err ? null : event, err ? null : result.stoppedId);
    }.bind(this)
  });
  return event;
}




/**
 * Stop an event by it's Id
 * @param {EventLike} event -- minimum {id} -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {Date} [date = now] the date to set to stop the event
 * @param {ConnectionEvents~eventStoppedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.stopEvent = function (eventlike, date, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  var data = {id: eventlike.id};
  if (date) {
    data.time = date.getTime() / 1000;
  }

  this.connection.request({
    method: 'POST',
    path: '/events/stop',
    jsonData: data,
    callback: function (err, result, resultInfo) {
      if (!err && resultInfo.code !== 200) {
        err = {id: CC.Errors.INVALID_RESULT_CODE};
      }

      // TODO if err === API_UNREACHABLE then save event in cache
      /*
       if (result && ! err) {
       if (this.connection.datastore) {  // if datastore is activated register new event

       }
       } */
      callback(err, err ? null : result.stoppedId);
    }.bind(this)
  });
};



/**
 * Stop any event in this stream
 * @param {StreamLike} stream -- minimum {id} -- if typeof Stream, must belong to
 * the same connection and not exists on the API.
 * @param {Date} [date = now] the date to set to stop the event
 * @param {String} [type = null] stop any matching eventType is this stream.
 * @param {ConnectionEvents~eventStoppedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.stopStream = function (streamLike, date, type, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }

  var data = {streamId : streamLike.id };
  if (date) { data.time = date.getTime() / 1000; }
  if (type) { data.type = type; }


  this.connection.request({
    method: 'POST',
    path: '/events/stop',
    jsonData: data,
    callback: function (err, result, resultInfo) {
      if (!err && resultInfo.code !== 200) {
        err = {id: CC.Errors.INVALID_RESULT_CODE};
      }

      // TODO if err === API_UNREACHABLE then cache the stop instruction for later synch

      callback(err, err ? null : result.stoppedId);
    }.bind(this)
  });
};


/**
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {FormData} the formData to post for fileUpload. On node.js
 * refers to pryv.utility.forgeFormData
 * @return {Event} event
 */
ConnectionEvents.prototype.createWithAttachment =
  function (newEventLike, formData, callback, progressCallback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    var event = null;
    if (newEventLike instanceof Event) {
      if (newEventLike.connection !== this.connection) {
        return callback(new Error('event.connection does not match current connection'));
      }
      if (newEventLike.id) {
        return callback(new Error('cannot create an event already existing on the API'));
      }
      event = newEventLike;
    } else {
      event = new Event(this.connection, newEventLike);
    }
    formData.append('event', JSON.stringify(event.getData()));
    this.connection.request({
      method: 'POST',
      path: '/events',
      jsonData: formData,
      isFile: true,
      progressCallback: progressCallback,
      callback: function (err, result) {
        if (result) {
          _.extend(event, result.event);

          if (this.connection.datastore) {  // if datastore is activated register new event
            this.connection.datastore.addEvent(event);
          }
        }
        callback(err, event);
      }.bind(this)
    });
  };

/**
 * @param {String} eventId
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {FormData} the formData to post for fileUpload. On node.js
 * refers to pryv.utility.forgeFormData
 * @return {Event} event
 */
ConnectionEvents.prototype.addAttachment =
  function (eventId, formData, callback, progressCallback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
  this.connection.request({
    method: 'POST',
    path: '/events/' + eventId,
    jsonData: formData,
    isFile: true,
    progressCallback: progressCallback,
    callback: function (err, result) {
      if (err) {
        return callback(err);
      }
      callback(null, result.event);
    }
  });
};

/**
 * @param {String} eventId
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {FormData} the formData to post for fileUpload. On node.js
 * refers to pryv.utility.forgeFormData
 * @return {Event} event
 */
ConnectionEvents.prototype.getAttachment =
  function (params, callback, progressCallback) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    if (utility.isBrowser()) {
      return callback(new Error('Function not implemented for browser, only available in NodeJS.'));
    }
    this.connection.request({
      method: 'GET',
      path: '/events/' + params.eventId + '/' + params.fileId,
      progressCallback: progressCallback,
      parseResult: 'binary',

      callback: function (err, result) {
        if (err) {
          return callback(err);
        }
        callback(null, result);
      }
    });
  };

/**
 * @param {String} eventId
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {String} fileName
 * @return {Event} event
 */
ConnectionEvents.prototype.removeAttachment = function (eventId, fileName, callback) {
  if (typeof(callback) !== 'function') {
    throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
  }
  this.connection.request({
    method: 'DELETE',
    path: '/events/' + eventId + '/' + fileName,
    callback: callback
  });
};
/**
 * //TODO rename to batch
 * //TODO make it NewEventLike compatible
 * //TODO once it support an array of mixed values Event and EventLike, the, no need for
 *  callBackWithEventsBeforeRequest at it will. A dev who want Event object just have to create
 *  them before
 * This is the prefered method to create events in batch
 * @param {Object[]} eventsData -- minimum {streamId, type }
 * @param {ConnectionEvents~eventBatchCreatedOnTheAPI}
 * @param {function} [callBackWithEventsBeforeRequest] mostly for testing purposes
 * @return {Event[]} events
 */
ConnectionEvents.prototype.batchWithData =
  function (eventsData, callback, callBackWithEventsBeforeRequest) {
    if (typeof(callback) !== 'function') {
      throw new Error(CC.Errors.CALLBACK_IS_NOT_A_FUNCTION);
    }
    if (!_.isArray(eventsData)) { eventsData = [eventsData]; }

    var createdEvents = [];
    var eventMap = {};

    // use the serialId as a temporary Id for the batch
    _.each(eventsData, function (eventData, i) {

      var event =  new Event(this.connection, eventData);

      createdEvents.push(event);
      eventMap[i] = event;
    }.bind(this));

    if (callBackWithEventsBeforeRequest) {
      callBackWithEventsBeforeRequest(createdEvents);
    }

    var mapBeforePush = function (evs) {
      return _.map(evs, function (e) {
        return {
          method: 'events.create',
          params: e
        };
      });
    };

    this.connection.request({
      method: 'POST',
      path: '/',
      jsonData: mapBeforePush(eventsData),
      callback: function (err, result) {
        if (!err && result) {
          _.each(result.results, function (eventData, i) {
            _.extend(eventMap[i], eventData.event); // add the data to the event

            if (this.connection.datastore) {  // if datastore is activated register new event
              this.connection.datastore.addEvent(eventMap[i]);
            }


          }.bind(this));
        }
        callback(err, createdEvents);
      }.bind(this)
    });

    return createdEvents;
  };

// --- raw access to the API

/**
 * TODO anonymise by renaming to function _get(..
 * @param {FilterLike} filter
 * @param {Connection~requestCallback} callback
 * @private
 */
ConnectionEvents.prototype._get = function (filter, callback) {
  var tParams = filter;
  if (filter instanceof Filter) { tParams = filter.getData(true); }
  if (_.has(tParams, 'streams') && tParams.streams.length === 0) { // dead end filter..
    return callback(null, [], {});
  }
  this.connection.request({
    method: 'GET',
    path: '/events?' + utility.getQueryParametersString(tParams),
    callback: callback
  });
};


/**
 * TODO anonymise by renaming to function _xx(..
 * @param {String} eventId
 * @param {Object} data
 * @param  {Connection~requestCallback} callback
 * @private
 */
ConnectionEvents.prototype._updateWithIdAndData = function (eventId, data, callback) {
  this.connection.request({
    method: 'PUT',
    path: '/events/' + eventId,
    jsonData: data,
    callback: function (error, result) {
      if (!error && result && result.event) {
        if (!this.connection.datastore) {
          result = new Event(this.connection, result.event);
        } else {
          result = this.connection.datastore.createOrReuseEvent(result.event);
        }
      } else {
        result = null;
      }
      callback(error, result);
    }.bind(this)
  });
};


/**
 * @private
 * @param {Event} event
 * @param {Object} the data to map
 */
ConnectionEvents.prototype._registerNewEvent = function (event, data) {


  if (! event.connection.datastore) { // no datastore   break
    _.extend(event, data);
    return event;
  }

  return event.connection.datastore.createOrReuseEvent(this, data);
};

module.exports = ConnectionEvents;

/**
 * Called with the desired Events as result.
 * @callback ConnectionEvents~getCallback
 * @param {Object} error - eventual error
 * @param {Event[]} result
 */


/**
 * Called each time a "part" of the result is received
 * @callback ConnectionEvents~partialResultCallback
 * @param {Event[]} result
 */


/**
 * Called when an event is created on the API
 * @callback ConnectionEvents~eventCreatedOnTheAPI
 * @param {Object} error - eventual error
 * @param {Event} event
 */

/**
 * Called when an event is created on the API
 * @callback ConnectionEvents~eventStoppedOnTheAPI
 * @param {Object} error - eventual error
 * @param {String} stoppedEventId or null if event not found
 */

/**
 * Called when batch create an array of events on the API
 * @callback ConnectionEvents~eventBatchCreatedOnTheAPI
 * @param {Object} error - eventual error
 * @param {Event[]} events
 */
