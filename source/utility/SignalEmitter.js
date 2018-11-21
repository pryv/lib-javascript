/**
 * (event)Emitter renamed to avoid confusion with prvy's events
 */


const _ = require('lodash');
const logger = console; 

var SignalEmitter = module.exports = function (messagesMap) {
  SignalEmitter.extend(this, messagesMap);
};


SignalEmitter.extend = function (object, messagesMap, name) {
  if (! name) {
    throw new Error('"name" parameter must be set');
  }
  object._signalEmitterEvents = {};
  _.each(_.values(messagesMap), function (value) {
    object._signalEmitterEvents[value] = [];
  });
  _.extend(object, SignalEmitter.prototype);
  object._signalEmitterName = name;
};


SignalEmitter.Messages = {
  /** called when a batch of changes is expected, content: <batchId> unique**/
  BATCH_BEGIN : 'beginBatch',
  /** called when a batch of changes is done, content: <batchId> unique**/
  BATCH_DONE : 'doneBatch',
  /** if an eventListener return this string, it will be removed automatically **/
  UNREGISTER_LISTENER : 'unregisterMePlease'
};

/**
 * Add an event listener
 * @param signal one of  Messages.SIGNAL.*.*
 * @param callback function(content) .. content vary on each signal.
 * If the callback returns SignalEmitter.Messages.UNREGISTER_LISTENER it will be removed
 * @return the callback function for further reference
 */
SignalEmitter.prototype.addEventListener = function (signal, callback) {
  this._signalEmitterEvents[signal].push(callback);
  return callback;
};


/**
 * remove the callback matching this signal
 */
SignalEmitter.prototype.removeEventListener = function (signal, callback) {
  for (var i = 0; i < this._signalEmitterEvents[signal].length; i++) {
    if (this._signalEmitterEvents[signal][i] === callback) {
      this._signalEmitterEvents[signal][i] = null;
    }
  }
};


/**
 * A changes occurred on the filter
 * @param signal
 * @param content
 * @param batch
 * @private
 */
SignalEmitter.prototype._fireEvent = function (signal, content, batch) {
  var batchId = batch ? batch.id : null;
  if (! signal) { throw new Error(); }

  var batchStr = batchId ? ' batch: ' + batchId + ', ' + batch.batchName : '';
  logger.log('FireEvent-' + this._signalEmitterName  + ' : ' + signal + batchStr);

  _.each(this._signalEmitterEvents[signal], function (callback) {
    if (callback !== null &&
      SignalEmitter.Messages.UNREGISTER_LISTENER === callback(content, batch)) {
      this.removeEventListener(signal, callback);
    }
  }, this);
};


SignalEmitter.batchSerial = 0;
/**
 * Start a batch process
 *
 * @param batchName Name of the new batch
 * @param orHookOnBatch Existing batch to hook on ("superbatch")
 * @return A batch object (call `done()` when done)
 * @private
 */
SignalEmitter.prototype.startBatch = function (name, orHookOnBatch) {

  if (! orHookOnBatch) {
    return new Batch(name, this);
  }
  name = orHookOnBatch.name + '/' + name;
  var batch = new Batch(name, this);
  orHookOnBatch.waitForMeToFinish(name + ':hook');
  batch.addOnDoneListener(name, function () {
    orHookOnBatch.done(name + ':hook');
  });
  return batch;
};

var Batch = function (name, owner) {
  this.owner = owner;
  this.name = name || 'x';
  this.id = owner._signalEmitterName + SignalEmitter.batchSerial++;
  this.waitFor = 0;
  this.history = [];
  this.doneCallbacks = {};
  this.waitForMeToFinish(this.name);
  this.owner._fireEvent(SignalEmitter.Messages.BATCH_BEGIN, this.id, this);

};



/**
 * listener are stored in key/map fashion, so addOnDoneListener('bob',..)
 * may be called several time, callback 'bob', will be done just once
 * @param key a unique key per callback
 * @param callback
 */
Batch.prototype.addOnDoneListener = function (key, callback) {
  this.checkAlreadyDone('addOnDoneListener(' + key + ')');
  this.doneCallbacks[key] = callback;
};

Batch.prototype.waitForMeToFinish = function (key) {
  this.checkAlreadyDone('waitForMeToFinish(' + key + ')');
  this.waitFor++;
  this.history.push({wait: key, waitFor: this.waitFor});
  return this;
};

Batch.prototype.done = function (key) {
  this.checkAlreadyDone('done(' + key + ')');
  key = key || '--';
  this.waitFor--;
  this.history.push({done: key, waitFor: this.waitFor});
  if (this.waitFor === 0) {

    this.doneTriggered = true;
    _.each(this.doneCallbacks, function (callback) {
      callback();
    });
    delete this.doneCallbacks; // prevents memory leaks
    this.owner._fireEvent(SignalEmitter.Messages.BATCH_DONE, this.id, this);
  }
};

Batch.prototype.checkAlreadyDone = function (addon) {
  if (this.doneTriggered) {
    var msg = 'Batch ' + this.name + ', ' + this.id + ' called ' + addon + '  when already done';
    throw new Error(msg + '     ' + JSON.stringify(this.history));
  }
};
