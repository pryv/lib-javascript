var _ = require('underscore'),
  SignalEmitter = require('./utility/SignalEmitter.js'),
  Filter = require('./Filter.js');

var EXTRA_ALL_EVENTS = {state : 'all', modifiedSince : -100000000 };
var REALLY_ALL_EVENTS =  EXTRA_ALL_EVENTS;
REALLY_ALL_EVENTS.fromTime = -1000000000;
REALLY_ALL_EVENTS.toTime = 10000000000;

var GETEVENT_MIN_REFRESH_RATE = 2000;

/**
 * Monitoring
 * @type {Function}
 * @constructor
 */
function Monitor(connection, filter) {
  SignalEmitter.extend(this, Messages, 'Monitor');
  this.connection = connection;
  this.id = 'M' + Monitor.serial++;

  this.filter = filter;

  this._lastUsedFilterData = filter.getData();

  if (this.filter.state) {
    throw new Error('Monitors only work for default state, not trashed or all');
  }

  this.filter.addEventListener(Filter.Messages.ON_CHANGE, this._onFilterChange.bind(this));
  this._events = null;


  // -- optimization & caching
  this.useCacheForEventsGetAllAndCompare = true;  // will look into cache before online
  this.ensureFullCache = true; // will fill the cache with ALL pryv content
  this.initWithPrefetch = 100; // prefetch some events before ensuringFullCache
}

Monitor.serial = 0;

var Messages = Monitor.Messages = {
  /** content: events **/
  ON_LOAD : 'started',
  /** content: error **/
  ON_ERROR : 'error',
  /** content: { enter: [], leave: [], change } **/
  ON_EVENT_CHANGE : 'eventsChanged',
  /** content: streams **/
  ON_STRUCTURE_CHANGE : 'streamsChanged',
  /** content: ? **/
  ON_FILTER_CHANGE : 'filterChanged'
};

// ----------- prototype  public ------------//

Monitor.prototype.start = function (done) {
  done = done || function () {};
  var batch = this.startBatch('Monitor:start');
  batch.addOnDoneListener('Monitor:startCompletion', function () {
    //TODO move this logic to ConnectionMonitors ??
    this.connection.monitors._monitors[this.id] = this;
    this.connection.monitors._startMonitoring(done);
  }.bind(this));


  this.lastSynchedST = -1000000000000;
  this._initEvents(batch);
  batch.done('Monitor:start');


};


Monitor.prototype.destroy = function () {
  //TODO move this logic to ConnectionMonitors ??
  delete this.connection.monitors._monitors[this.id];
  if (_.keys(this.connection.monitors._monitors).length === 0) {
    this.connection.monitors._stopMonitoring();
  }
};

Monitor.prototype.getEvents = function () {
  if (! this._events || ! this._events.active) {return []; }
  return _.toArray(this._events.active);
};

// ------------ private ----------//

// ----------- iOSocket ------//
Monitor.prototype._onIoConnect = function () {
  console.log('Monitor onConnect');
};
Monitor.prototype._onIoError = function (error) {
  console.log('Monitor _onIoError' + error);
};
Monitor.prototype._onIoEventsChanged = function () {
  var batch = this.startBatch('IoEventChanged');
  this._connectionEventsGetChanges(batch);
  batch.done('IoEventChanged');
};
Monitor.prototype._onIoStreamsChanged = function () {
  console.log('SOCKETIO', '_onIoStreamsChanged');
  var batch = this.startBatch('IoStreamsChanged');
  this._connectionStreamsGetChanges(batch);
  batch.done('IoStreamsChanged');
};



// -----------  filter changes ----------- //


Monitor.prototype._saveLastUsedFilter = function () {
  this._lastUsedFilterData = this.filter.getData();
};


Monitor.prototype._onFilterChange = function (signal, batch) {


  var changes = this.filter.compareToFilterData(this._lastUsedFilterData);

  var processLocalyOnly = 0;
  var foundsignal = 0;
  if (signal.signal === Filter.Messages.DATE_CHANGE) {  // only load events if date is wider
    foundsignal = 1;
    console.log('** DATE CHANGE ', changes.timeFrame);
    if (changes.timeFrame === 0) {
      return;
    }
    if (changes.timeFrame < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }

  }

  if (signal.signal === Filter.Messages.STREAMS_CHANGE) {
    foundsignal = 1;
    console.log('** STREAMS_CHANGE', changes.streams);
    if (changes.streams === 0) {
      return;
    }
    if (changes.streams < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }
  }

  if (signal.signal === Filter.Messages.STREAMS_CHANGE) {
    foundsignal = 1;
    console.log('** STREAMS_CHANGE', changes.streams);
    if (changes.streams === 0) {
      return;
    }
    if (changes.streams < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }
  }

  if (signal.signal === Filter.Messages.STRUCTURE_CHANGE) {
    foundsignal = 1;
    // force full refresh
  }


  if (! foundsignal) {
    throw new Error('Signal not found :' + signal.signal);
  }

  this._saveLastUsedFilter();



  if (processLocalyOnly) {
    this._refilterLocaly(Messages.ON_FILTER_CHANGE, {filterInfos: signal}, batch);
  } else {
    this._connectionEventsGetAllAndCompare(Messages.ON_FILTER_CHANGE, {filterInfos: signal}, batch);
  }
};

// ----------- internal ----------------- //

/**
 * Process events locally
 */
Monitor.prototype._refilterLocaly = function (signal, extracontent, batch) {

  var result = { enter : [], leave : [] };
  _.extend(result, extracontent); // pass extracontent to receivers
  _.each(_.clone(this._events.active), function (event) {
    if (! this.filter.matchEvent(event)) {
      result.leave.push(event);
      delete this._events.active[event.id];
    }
  }.bind(this));
  this._fireEvent(signal, result, batch);
};


Monitor.prototype._initEvents = function (batch) {
  batch = this.startBatch('Monitor:initEvents', batch);
  this._events = { active : {}};


  var filterWith = this.filter.getData(true, EXTRA_ALL_EVENTS);

  if (this.initWithPrefetch) {
    filterWith.limit = this.initWithPrefetch;
  } else {
    if (this.ensureFullCache) {  filterWith = REALLY_ALL_EVENTS; }
  }


  this.connection.events.get(filterWith,
    function (error, events) {
      if (error) {
        this._fireEvent(Messages.ON_ERROR, error, batch);
        batch.done('Monitor:initEvents error');
        return;
      }

      if (! this.initWithPrefetch) { this.lastSynchedST = this.connection.getServerTime(); }

      var result = [];

      _.each(events, function (event) {
        if (! this.ensureFullCache || this.filter.matchEvent(event)) {
          this._events.active[event.id] = event;
          result.push(event);
        }
      }.bind(this));


      this._fireEvent(Messages.ON_LOAD, result, batch);

      if (this.initWithPrefetch) {
        batch.waitForMeToFinish('delay');
        setTimeout(function () {
          this._connectionEventsGetChanges(batch);
          batch.done('delay');
        }.bind(this), 100);
      }
      batch.done('Monitor:initEvents finished');


    }.bind(this));
};





/**
 * @private
 */
Monitor.prototype._connectionEventsGetChanges = function (batch) {
  batch = this.startBatch('connectionEventsGetChanges', batch);
  if (this.eventsGetChangesInProgress) {
    this.eventsGetChangesNeeded = true;
    console.log('[WARNING] Skipping _connectionEventsGetChanges because one is in Progress');
    batch.done('connectionEventsGetChanges in Progress');
    return;
  }
  this.eventsGetChangesInProgress = true;
  this.eventsGetChangesNeeded = false;


  // var options = { modifiedSince : this.lastSynchedST};
  var options = { modifiedSince : this.lastSynchedST, state : 'all'};


  var filterWith = this.filter.getData(true, options);
  if (this.ensureFullCache) {
    filterWith = REALLY_ALL_EVENTS;
    filterWith = _.extend(filterWith, options);
  }
  this.lastSynchedST = this.connection.getServerTime();

  var result = { created : [], trashed : [], modified: []};

  this.connection.events.get(filterWith,
    function (error, events) {
      if (error) {
        this._fireEvent(Messages.ON_ERROR, error, batch);
        batch.done('connectionEventsGetChanges error');
        return;
      }

      _.each(events, function (event) {
        if (! this.ensureFullCache || this.filter.matchEvent(event)) {
          if (this._events.active[event.id]) {
            if (event.trashed && !this._events.active[event.id].trashed) { // trashed
              result.trashed.push(event);
              delete this._events.active[event.id];
            } else {
              result.modified.push(event);
              this._events.active[event.id] = event;
            }
          } else {
            if (this.ensureFullCache) { // can test streams  state (trashed)
              if (!event.trashed && event.stream && !event.stream.trashed) {
                result.created.push(event);
                this._events.active[event.id] = event;
              }
            } else {  // cannot test stream state
              if (!event.trashed) {
                result.created.push(event);
                this._events.active[event.id] = event;
              }
            }
          }
        }
      }.bind(this));

      this._fireEvent(Messages.ON_EVENT_CHANGE, result, batch);
      batch.done('connectionEventsGetChanges');

      // ---
      setTimeout(function () {
        this.eventsGetChangesInProgress = false;
        if (this.eventsGetChangesNeeded) {
          this._connectionEventsGetChanges();
        }
      }.bind(this), GETEVENT_MIN_REFRESH_RATE);

    }.bind(this));
};

/**
 * @private
 */
Monitor.prototype._connectionStreamsGetChanges = function (batch) {
  batch = this.startBatch('connectionStreamsGetChanges', batch);
  var previousStreamsData = {};
  var previousStreamsMap = {}; // !! only used to get back deleted streams..
  var created = [], modified = [], modifiedPreviousProperties = {}, trashed = [], deleted = [];

  var isStreamChanged = function (streamA, streamB) {
    return !_.isEqual(streamA, streamB);
  };


  // check if the stream has changed it.. and save it in the right message box
  var checkChangedStatus = function (stream) {


    if (! previousStreamsData[stream.id]) { // new stream
      created.push(stream);
    } else if (isStreamChanged(previousStreamsData[stream.id], stream.getData())) {

      if (previousStreamsData[stream.id].trashed !== stream.trashed) {
        if (!stream.trashed) {
          created.push(stream);
        } else {
          trashed.push(stream);
        }
      } else {
        modified.push(stream);
        modifiedPreviousProperties[stream.id] = previousStreamsData[stream.id];
      }
    }

    _.each(stream.children, function (child) {
      checkChangedStatus(child);
    });
    delete previousStreamsData[stream.id];
  };

  //-- get all current streams before matching with new ones --//
  var getFlatTree = function (stream) {
    previousStreamsData[stream.id] = stream.getData();
    previousStreamsMap[stream.id] = stream;

    _.each(stream.children, function (child) {
      getFlatTree(child);
    });
  };
  _.each(this.connection.datastore.getStreams(true), function (rootStream) {
    getFlatTree(rootStream);
  });

  this.connection.fetchStructure(function (error, result) {
    if (error) {
      batch.done('connectionStreamsGetChanges fetchStructure error');
      return;
    }
    _.each(result, function (rootStream) {
      checkChangedStatus(rootStream);
    });
    // each stream remaining in streams[] are deleted streams;
    _.each(previousStreamsData, function (streamData, streamId) {
      deleted.push(previousStreamsMap[streamId]);
    });

    this._fireEvent(Messages.ON_STRUCTURE_CHANGE,
      { created : created, trashed : trashed, modified: modified, deleted: deleted,
        modifiedPreviousProperties: modifiedPreviousProperties}, batch);

    this._onFilterChange({signal : Filter.Messages.STRUCTURE_CHANGE}, batch);
    batch.done('connectionStreamsGetChanges');
  }.bind(this));
};

/**
 * @private
 */
Monitor.prototype._connectionEventsGetAllAndCompare = function (signal, extracontent, batch) {
  this.lastSynchedST = this.connection.getServerTime();


  if (this.useCacheForEventsGetAllAndCompare) {



    // POC code to look into in-memory events for matching events..
    // do not activate until cache handles DELETE
    var result1 = { enter : [], leave : []};
    _.extend(result1, extracontent);


    // first cleanup same as : this._refilterLocaly(signal, extracontent, batch);
    if (! this._events) {
      throw new Error('Not yet started!!!');
    }
    _.each(_.clone(this._events.active), function (event) {
      if (! this.filter.matchEvent(event)) {
        result1.leave.push(event);
        delete this._events.active[event.id];
      }
    }.bind(this));



    var cachedEvents = this.connection.datastore.getEventsMatchingFilter(this.filter);
    _.each(cachedEvents, function (event) {
      if (! this._events.active[event.id]) {  // we don't care for already known event
        this._events.active[event.id] = event; // store it
        result1.enter.push(event);
      }
    }.bind(this));



    this._fireEvent(signal, result1, batch);

    // remove all events not matching filter


  }

  // look online
  if (! this.ensureFullCache)  { // not needed when full cache is enabled
    var result = { enter : [] };
    _.extend(result, extracontent); // pass extracontent to receivers

    var toremove = _.clone(this._events.active);

    batch = this.startBatch('connectionEventsGetAllAndCompare:online', batch);
    this.connection.events.get(this.filter.getData(true, EXTRA_ALL_EVENTS),
      function (error, events) {
        if (error) {
          this._fireEvent(Messages.ON_ERROR, error, batch);
          batch.done('connectionEventsGetAllAndCompare:online error');
          return;
        }
        _.each(events, function (event) {
          if (this._events.active[event.id]) {  // already known event we don't care
            delete toremove[event.id];
          } else {
            this._events.active[event.id] = event;
            result.enter.push(event);
          }
        }.bind(this));
        _.each(_.keys(toremove), function (streamid) {
          delete this._events.active[streamid]; // cleanup not found streams
        }.bind(this));
        result.leave = _.values(toremove); // unmatched events are to be removed
        this._fireEvent(signal, result, batch);
        batch.done('connectionEventsGetAllAndCompare:online');
      }.bind(this));
  }
};


/**
 * TODO write doc
 * return informations on events
 */
Monitor.prototype.stats = function (force, callback) {
  this.connection.profile.getTimeLimits(force, callback);
};

module.exports = Monitor;


