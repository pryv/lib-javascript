var _ = require('underscore');
var SignalEmitter = require('../Utility/SignalEmitter.js');
var MSGs =  require('../Messages.js');
var MyMsgs = MSGs.Monitor;


var EXTRA_ALL_EVENTS = {state : 'all', modifiedSince : -100000000 };

/**
 *
 * @type {Function}
 * @constructor
 */
var Monitor = module.exports = function (connection, filter) {
  SignalEmitter.extend(this, MyMsgs);
  this.connection = connection;
  this.id = 'M' + Monitor.serial++;

  this.filter = filter;

  if (this.filter.state) {
    throw new Error('Monitors only work for default state, not trashed or all');
  }

  this.filter.addEventListener(MSGs.Filter.ON_CHANGE, this._onFilterChange.bind(this));
  this._events = null;
};

Monitor.serial = 0;


// ----------- prototype  public ------------//

Monitor.prototype.start = function (done) {
  done = done || function () {};

  this.lastSynchedST = -1000000000000;
  this._connectionEventsGetAll();

  this.connection._ioSocketMonitors[this.id] = this;
  this.connection._startMonitoring(done);
};


Monitor.prototype.destroy = function () {
  delete this.connection._ioSocketMonitors[this.id];
  if (_.keys(this.connection._ioSocketMonitors).length === 0) {
    this.connection._stopMonitoring();
  }
};

Monitor.prototype.getEvents = function () {
  if (! this.events || ! this._events.active) {return []; }
  return this._events.active;
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
  this._connectionEventsGetChanges(MyMsgs.ON_EVENT_CHANGE);
};
Monitor.prototype._onIoStreamsChanged = function () { };



// -----------  filter changes ----------- //

Monitor.prototype._onFilterChange = function (signal/*, content*/) {
  this._connectionEventsGetAllAndCompare(MyMsgs.ON_FILTER_CHANGE, {filterInfos: signal});
};

// ----------- internal ----------------- //

/**
 *
 */
Monitor.prototype._connectionEventsGetAll = function () {
  this.lastSynchedST = this.connection.getServerTime();
  this._events = { active : {}};
  this.connection.events.get(this.filter, EXTRA_ALL_EVENTS,
    function (error, events) {
      if (error) { this._fireEvent(MyMsgs.ON_ERROR, error); }
      _.each(events, function (event) {
        this._events.active[event.id] = event;
      }.bind(this));
      this._fireEvent(MyMsgs.ON_LOAD, events);
    }.bind(this));
};


Monitor.prototype._connectionEventsGetChanges = function (signal) {
  var options = { modifiedSince : this.lastSynchedST, state : 'all'};
  this.lastSynchedST = this.connection.getServerTime();

  var result = { created : [], trashed : [], modified: []};

  this.connection.events.get(this.filter, options,
    function (error, events) {
      if (error) {
        this._fireEvent(MyMsgs.ON_ERROR, error);
      }

      _.each(events, function (event) {
        if (this._events.active[event.id]) {
          if (event.trashed) { // trashed
            result.trashed.push(event);
            delete this._events.active[event.id];
          } else {
            result.modified.push(event);
          }
        } else {
          result.created.push(event);
        }
      }.bind(this));

      this._fireEvent(signal, result);
    }.bind(this));
};


Monitor.prototype._connectionEventsGetAllAndCompare = function (signal, extracontent) {
  this.lastSynchedST = this.connection.getServerTime();


  console.log(JSON.stringify(this.filter.getData()));

  var result = { enter : [] };
  _.extend(result, extracontent); // pass extracontent to receivers

  var toremove = _.clone(this._events.active);

  this.connection.events.get(this.filter, EXTRA_ALL_EVENTS,
    function (error, events) {
      if (error) { this._fireEvent(MyMsgs.ON_ERROR, error); }
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
      this._fireEvent(signal, result);
    }.bind(this));

};




