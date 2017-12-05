/* global describe, it, before, beforeEach, after, afterEach */
var Pryv = require('../../../source/main'),
  should = require('should'),
  config = require('../test-support/config.js'),
  async = require('async'),
  fs = require('fs');


describe('Connection.events', function () {
  this.timeout(20000);

  var connection, testStream;

  before(function (done) {
    testStream = {
      id: 'ConnectionEventsTestStream',
      name: 'ConnectionEventsTestStream'
    };
    connection = new Pryv.Connection(config.connectionSettings);
    connection.streams.create(testStream, function (err, newStream) {
      if (err) {
        return done(err);
      }
      testStream = newStream;
      done();
    });
  });

  after(function (done) {
    async.series([
      function (stepDone) {
        connection.streams.delete(testStream, function (err, trashedStream) {
          testStream = trashedStream;
          stepDone(err);
        });
      },
      function (stepDone) {
        connection.streams.delete(testStream, function (err) {
          stepDone(err);
        });
      }
    ], done);
  });

  describe('get()', function () {

    var deletedEventId, testStartTime, eventCreated;

    before(function (done) {

      var eventDeleted = {
        content: 'I am a deleted test event from js lib, please kill me',
        type: 'note/txt',
        streamId: testStream.id
      };
      async.times(20, function (n, next) {
        var eventData = {
          streamId: 'ConnectionEventsTestStream',
          type: 'note/txt',
          content: 'Event ' + (n + 1)
        };
        connection.events.create(eventData, function (err, event) {
          testStartTime = event.time;
          next(err, event);
        });
      }, function (err, events) {
        if (err) { return console.error(err); }
        eventCreated = events;
      });
      async.series([
        function (stepDone) {
          connection.events.create(eventDeleted, function (err, event) {
            if(err) {
              return stepDone(err);
            }
            eventDeleted = event;
            deletedEventId = event.id;
            stepDone();
          });
        },
        function (stepDone) {
          connection.events.delete(eventDeleted, function (err) {
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventDeleted, function (err) {
            stepDone(err);
          });
        }
      ], done);
    });

    after(function () {
      async.times(20, function (i, next) {
        connection.events.delete(eventCreated[i], function (err, event) {
          next(err, event);
        });
      }, function (err) {
        if (err) { return console.error(err); }
      });
    });

    it('must return the last 20 non-trashed Event objects (sorted descending) by default',
      function (done) {
        connection.events.get({}, function (err, events) {
          should.not.exist(err);
          should.exist(events);
          events.length.should.equal(20);
          var lastTime = Number.POSITIVE_INFINITY;
          events.forEach(function (event) {
            event.time.should.not.be.above(lastTime);
            event.should.be.instanceOf(Pryv.Event);
            var trashed = event.trashed ? true : false;
            trashed.should.equal(false);
            lastTime = event.time;
          });
          done();
        });
      });


    it('must return deleted events when the flag includeDeletions is set', function (done) {
      var filter = {includeDeletions: true, modifiedSince: testStartTime};
      connection.events.get(filter, function (err, events) {
        should.not.exist(err);
        should.exist(events.eventDeletions);
        var found = false;
        events.eventDeletions.forEach(function (deletedEvent) {
          if (deletedEvent.id === deletedEventId) {
            found = true;
          }
        });
        found.should.be.eql(true);
        done();
      });
    });

    it('must return events matching the given filter', function (done) {
      var filter = {limit: 10, types: ['note/txt']};
      connection.events.get(filter, function (err, events) {
        events.length.should.equal(filter.limit);
        events.forEach(function (event) {
          filter.types.indexOf(event.type).should.not.equal(-1);
        });
        done();
      });
    });

    it('must return an error if the given filter contains an invalid parameter', function (done) {
      var filter = {fromTime: 'toto'};
      connection.events.get(filter, function (err, events) {
        should.exist(err);
        should.not.exist(events);
        done();
      });
    });

    // Dead end filter is used when we don't want to fetch anymore data for a connection
    // but still want to preserve the cached data.
    it('must receive an empty array of events when using a dead end filter', function (done) {
      var deadEndFilter = new Pryv.Filter();
      deadEndFilter.streamsIds = [];
      connection.events.get(deadEndFilter, function (err, emptyEvents) {
        should.not.exist(err);
        should.exist(emptyEvents);
        emptyEvents.should.be.instanceOf(Array);
        emptyEvents.length.should.equal(0);
        done();
      });
    });

    it('must accept a null filter', function (done) {
      connection.events.get(null, function (err, events) {
        should.not.exist(err);
        should.exist(events);
        done();
      });
    });

    it('must return an empty array if there are no events', function (done) {
      var filter = {fromTime: 10, toTime: 11};
      connection.events.get(filter, function (err, events) {
        events.should.be.instanceOf(Array);
        events.length.should.equal(0);
        done();
      });
    });
  });

  describe('create()', function () {
    var eventToDelete, singleActivityStream;

    before(function (done) {
      singleActivityStream = {name: 'singleActivityStream', singleActivity: true};
      connection.streams.create(singleActivityStream, function (err, newStream) {
        should.not.exist(err);
        should.exist(newStream.id);
        singleActivityStream = newStream;
        done(err);
      });
    });

    afterEach(function (done) {
      if (eventToDelete !== null) {
        async.series([
          function (stepDone) {
            connection.events.delete(eventToDelete, function (err, trashedEvent) {
              eventToDelete = trashedEvent;
              stepDone(err);
            });
          },
          function (stepDone) {
            connection.events.delete(eventToDelete, function (err) {
              eventToDelete = null;
              stepDone(err);
            });
          }
        ], done);
      } else {
        done();
      }
    });

    after(function (done) {
      async.series([
        function (stepDone) {
          connection.streams.delete(singleActivityStream, function (err, trashedStream) {
            singleActivityStream = trashedStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.streams.delete(singleActivityStream, function (err) {
            stepDone(err);
          });
        }
      ], done);
    });

    it('must accept an event-like object and return an Event object', function (done) {
      var eventData = {
        content: 'I am a test from js lib, please kill me',
        type: 'note/txt',
        streamId: testStream.id
      };
      connection.events.create(eventData, function (err, event) {
        should.not.exist(err);
        should.exist(event);
        event.should.be.instanceOf(Pryv.Event);
        eventToDelete = event;
        done();
      });
    });

    // TODO functionality not yet implemented
    it.skip('must accept an array of event-like objects and return an array of Event objects');

    it('must return events with default values for unspecified properties', function (done) {
      var eventData = {
        content: 'I am a test from js lib, please kill me',
        type: 'note/txt',
        streamId: testStream.id
      };
      connection.events.create(eventData, function (err, event) {
        should.exist(event.id);
        should.exist(event.time);
        should.exist(event.tags);
        should.exist(event.created);
        should.exist(event.createdBy);
        eventToDelete = event;
        done();
      });
    });

    it('must return a stoppedId field when called in a singleActivity stream that' +
      ' currently has a running event',
      function (done) {
        var eventDataSingleActivity = {
          streamId: singleActivityStream.id, type: 'activity/plain', duration: null};
        var stoppedEventId;
        async.series([
          function (stepDone) {
            connection.events.start(eventDataSingleActivity, function (err, event) {
              should.not.exist(err);
              should.exist(event);
              stoppedEventId = event.id;
              stepDone();
            });
          },
          function (stepDone) {
            connection.events.create(eventDataSingleActivity, function (err, event, stoppedId) {
              should.not.exist(err);
              should.exist(event);
              should.exist(stoppedId);
              stoppedId.should.eql(stoppedEventId);
              stepDone();
            });
          },
          function (stepDone) {
            connection.events.stopStream(
              {id: singleActivityStream.id}, null, null, function (err) {
                stepDone(err);
              });
          }
        ], done);

      });

    it('must return an error if the given event data is invalid', function (done) {
      var invalidData = {
        content: 'I am a devil event which is missing streamId',
        type: 'note/txt'
      };
      connection.events.create(invalidData, function (err, event) {
        should.exist(err);
        should.not.exist(event);
        eventToDelete = null;
        done();
      });
    });

    it('must return a periods-overlap error when called in a singleActivity stream ' +
      'and durations overlap',
      function (done) {
        var time = 1000,
            duration = 500;
        async.series([
          function (stepDone) {
            eventToDelete = {
              streamId: singleActivityStream.id, type: 'activity/plain',
              time: time, duration: duration
            };
            connection.events.create(eventToDelete, function (err, event) {
              eventToDelete = event;
              stepDone(err);
            });
          },
          function (stepDone) {
            var overlappingEvent = {
              streamId: singleActivityStream.id, type: 'activity/plain', time: time + duration/2,
              duration: duration
            };
            connection.events.create(overlappingEvent, function (err) {
              should.exist(err);
              stepDone();
            });
          }
        ], done);
      });

    // TODO: not implement yet
    // when some errors occurs error callback is null and
    // the result array has an error flag (.hasError)
    it.skip('must return an error for each invalid event (when given multiple items)');
  });


  describe('createWithAttachment()', function () {

    var eventWithAttachment;

    after(function (done) {
      async.series([
        function (stepDone) {
          connection.events.delete(eventWithAttachment, function (err, trashedEvent) {
            eventWithAttachment = trashedEvent;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventWithAttachment, function (err) {
            stepDone(err);
          });
        }
      ], done);
    });

    it('must accept attachment only with Event object', function (done) {
      var pictureData = fs.readFileSync(__dirname + '/../test-support/photo.PNG');
      should.exist(pictureData);

      eventWithAttachment = {
        streamId: testStream.id, type: 'picture/attached',
        description: 'test'
      };

      var formData = Pryv.utility.forgeFormData('attachment0', pictureData, {
        type: 'image/png',
        filename: 'attachment0'
      });

      connection.events.createWithAttachment(eventWithAttachment, formData, function (err, event) {
        should.not.exist(err);
        should.exist(event);
        event.should.be.instanceOf(Pryv.Event);
        eventWithAttachment = event;
        done(err);
      });
    });
  });

  describe.skip('start() - stopEvent() - stopStream()', function () {

    var eventData, eventId, eventToStop, stream, singleActivityStream;

    before(function (done) {
      singleActivityStream = {
        id: 'singleActivityStreamId',
        name: 'singleActivityStreamName',
        singleActivity: true};
      stream = {id: 'startStopStreamId', name: 'startStopTestStreamName'};
      eventData = {type: 'activity/plain'};

      async.series([
        function (stepDone) {
          connection.streams.create(stream, function (err, newStream) {
            stream = newStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.streams.create(singleActivityStream, function (err, newStream) {
            singleActivityStream = newStream;
            stepDone(err);
          });
        }
      ], done());
    });

    after(function (done) {
      async.series([
        function (stepDone) {
          connection.streams.delete(stream, function (err, trashedStream) {
            stream = trashedStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.streams.delete(stream, function (err) {
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.streams.delete(singleActivityStream, function (err, trashedStream) {
            singleActivityStream = trashedStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.streams.delete(singleActivityStream, function (err) {
            stepDone(err);
          });
        }
      ], done());
    });

    it('must start an event and stop it using stopEvent() in normal stream', function (done) {
      async.series([
        function (stepDone) {
          eventData.streamId = stream.id;
          connection.events.start(eventData, function (err, event) {
            should.not.exist(err);
            eventToStop = event;
            should.exist(event);
            should.not.exist(event.duration);
            eventId = event.id;
            stepDone();
          });
        },
        function (stepDone) {
          connection.events.stopEvent(eventToStop, null, function (err, stoppedId) {
            should.not.exist(err);
            should.exist(stoppedId);
            stoppedId.should.equal(eventId);
            stepDone();
          });
        }
      ], done);
    });

    it('must start an event and stop it using stopEvent() in singleActivity stream',
      function (done) {
        async.series([
          function (stepDone) {
            eventData.streamId = singleActivityStream.id;
            connection.events.start(eventData, function (err, event) {
              should.not.exist(err);
              eventToStop = event;
              should.exist(event);
              should.not.exist(event.duration);
              eventId = event.id;
              stepDone();
            });
          },
          function (stepDone) {
            connection.events.stopEvent(eventToStop, null, function (err, stoppedId) {
              should.not.exist(err);
              should.exist(stoppedId);
              stoppedId.should.equal(eventId);
              stepDone();
            });
          }
        ], done);
      });

    it('must start an event and stop it using stopStream()', function (done) {
      async.series([
        function (stepDone) {
          eventData.streamId = singleActivityStream.id;
          connection.events.start(eventData, function (err, event) {
            should.not.exist(err);
            should.exist(event);
            should.not.exist(event.duration);
            eventToStop = event;
            eventId = eventToStop.id;
            stepDone();
          });
        },
        function (stepDone) {
          connection.events.stopStream(
            {id: eventToStop.streamId}, null, null, function (err, stoppedId) {
              should.not.exist(err);
              should.exist(stoppedId);
              stoppedId.should.eql(eventId);
              stepDone();
            });
        }
      ], done);
    });

  });

  describe('update()', function () {
    var eventToUpdate, eventToUpdate2, arrayOfEventsToUpdate,
      eventSingleActivityToUpdate, eventSingleActivityToUpdate2,
      singleActivityStream;

    before(function (done) {

      async.series([
        function (stepDone) {
          singleActivityStream = {
            id: 'singleActivityTestStream',
            name: 'singleActivityTestStream',
            type: 'activity/plain',
            singleActivity: true
          };
          connection.streams.create(singleActivityStream, function (err, stream) {
            singleActivityStream = stream;
            stepDone(err);
          });
        },
        function (stepDone) {
          eventToUpdate =
          {content: 'I am going to be updated', streamId: testStream.id, type: 'note/txt'};
          connection.events.create(eventToUpdate, function (err, event) {
            eventToUpdate = event;
            return stepDone(err);
          });
        },
        function (stepDone) {
          eventToUpdate2 = {
            content: 'I am also going to be updated', streamId: testStream.id,
            type: 'note/txt'
          };
          connection.events.create(eventToUpdate2, function (err, event) {
            eventToUpdate2 = event;
            return stepDone(err);
          });
        },
        function (stepDone) {
          eventSingleActivityToUpdate = {
            streamId: singleActivityStream.id, type: 'activity/plain',
            time: 100, duration: 10
          };
          connection.events.create(eventSingleActivityToUpdate, function (err, event) {
            eventSingleActivityToUpdate = event;
            return stepDone(err);
          });
        },
        function (stepDone) {
          eventSingleActivityToUpdate2 = {
            streamId: singleActivityStream.id, type: 'activity/plain', time: 200,
            duration: 10
          };
          connection.events.create(eventSingleActivityToUpdate2, function (err, event) {
            eventSingleActivityToUpdate2 = event;
            return stepDone(err);
          });
        }
      ], done);
    });

    after(function (done) {
      async.series([
        function (stepDone) {
          connection.events.delete(eventToUpdate, function (err, trashedEvent) {
            eventToUpdate = trashedEvent;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventToUpdate, function (err) {
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventToUpdate2, function (err, trashedEvent) {
            eventToUpdate2 = trashedEvent;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventToUpdate2, function (err) {
            stepDone(err);
          });
        }, function (stepDone) {
          connection.events.delete(eventSingleActivityToUpdate, function (err, trashedEvent) {
            eventSingleActivityToUpdate = trashedEvent;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventSingleActivityToUpdate, function (err) {
            stepDone(err);
          });
        }, function (stepDone) {
          connection.events.delete(eventSingleActivityToUpdate2, function (err, trashedEvent) {
            eventSingleActivityToUpdate2 = trashedEvent;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventSingleActivityToUpdate2, function (err) {
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.streams.delete(singleActivityStream, function (err, trashedStream) {
            singleActivityStream = trashedStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.streams.delete(singleActivityStream, function (err) {
            stepDone(err);
          });
        }
      ], done);
    });

    it('must accept an Event object and return the updated event', function (done) {
      var newContent = 'I was updated';
      eventToUpdate.content = newContent;
      connection.events.update(eventToUpdate, function (err, updatedEvent) {
        should.not.exist(err);
        should.exist(updatedEvent);
        updatedEvent.should.be.instanceOf(Pryv.Event);
        updatedEvent.content.should.equal(newContent);
        done();
      });
    });

    // TODO: event-like object support not implemented yet, fails on getData() in update method
    // where event.getData() is called on event-like object and fails.
    it.skip('must accept an event-like object and return an Event object', function (done) {
      var newContent = 'I was updated again';
      eventToUpdate.content = newContent;
      var eventDataToUpdate = eventToUpdate.getData();
      connection.events.update(eventDataToUpdate, function (err, updatedEvent) {
        should.not.exist(err);
        should.exist(updatedEvent);
        updatedEvent.should.be.instanceOf(Pryv.Event);
        updatedEvent.content.should.equal(newContent);
        done();
      });
    });

    // TODO not implemented yet
    it.skip('must accept an array of Event objects', function (done) {
      var newContent1 = 'I was updated';
      var newContent2 = 'I was also updated';
      arrayOfEventsToUpdate[0].content = newContent1;
      arrayOfEventsToUpdate[1].content = newContent2;
      connection.events.update(arrayOfEventsToUpdate, function (err, updatedEvents) {
        should.not.exist(err);
        should.exist(updatedEvents);
        Array.isArray(updatedEvents).should.be.true();
        updatedEvents.forEach(function (e) {
          if (e.id === arrayOfEventsToUpdate[0].id) {
            e.content.should.equal(newContent1);
          }
          if (e.id === arrayOfEventsToUpdate[1].id) {
            e.content.should.equal(newContent2);
          }
        });
        done();
      });
    });

    it('must return an error if the event is invalid', function (done) {
      var tmp = eventToUpdate.streamId;
      eventToUpdate.streamId = null;
      connection.events.update(eventToUpdate, function (err, event) {
        should.exist(err);
        should.not.exist(event);
        eventToUpdate.streamId = tmp;
        done();
      });
    });


    it('must return an invalid-operation error if duration=null and ' +
    'other events exist later in time', function (done) {
      eventSingleActivityToUpdate.duration = null;
      connection.events.update(eventSingleActivityToUpdate, function (err) {
        should.exist(err);
        done();
      });
    });

    it('must return a periods-overlap error when called in a singleActivity stream ' +
    'and durations overlap', function (done) {
      eventSingleActivityToUpdate2.time = eventSingleActivityToUpdate.time +
      eventSingleActivityToUpdate.duration / 2;
      connection.events.update(eventSingleActivityToUpdate2, function (err) {
        should.exist(err);
        done();
      });
    });

  });


  describe('addAttachment()', function () {
    var event, formData, filename;

    before(function (done) {
      var pictureData = fs.readFileSync(__dirname + '/../test-support/photo.PNG');
      should.exist(pictureData);

      event = {
        streamId: testStream.id, type: 'picture/attached',
        description: 'test'
      };
      filename = 'testPicture';

      formData = Pryv.utility.forgeFormData('attachment0', pictureData, {
        type: 'image/png',
        filename: filename
      });

      event = {
        streamId: testStream.id,
        type: 'picture/attached'
      };
      connection.events.create(event, function (err, newEvent) {
        event = newEvent;
        done(err);
      });
    });

    after(function (done) {
      async.series([
        function (stepDone) {
          connection.events.delete(event, function (err, trashedEvent) {
            event = trashedEvent;
            return stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(event, function (err) {
            return stepDone(err);
          });
        }
      ], done);
    });

    it('must accept an Attachment and return the event with the right attachment property',
      function (done) {
        connection.events.addAttachment(event.id, formData, function (err, event) {
          should.not.exist(err);
          should.exist(event);
          should.exist(event.attachments);
          event.attachments[0].fileName.should.be.eql(filename);
          done();
        });
      });

    it('must return an error in case of invalid parameters', function (done) {
      connection.events.addAttachment('dontcare', 'dontcar', function (err) {
        should.exist(err);
        done();
      });
    });
  });

  // TODO see if useful or not, since the URL is used directly to get an Attachment content
  describe('getAttachment()', function () {

    var event, formData, attachment, originalFile;

    before(function (done) {
      originalFile = fs.readFileSync(__dirname + '/../test-support/photo.PNG');
      should.exist(originalFile);

      event = {
        streamId: testStream.id, type: 'picture/attached',
        description: 'testing getAttachment() method'
      };
      var filename = 'testGetAttachmentPicture';

      formData = Pryv.utility.forgeFormData('attachment0', originalFile, {
        type: 'image/png',
        filename: filename
      });

      event = {
        streamId: testStream.id,
        type: 'picture/attached'
      };
      async.series([
        function (stepDone) {
          connection.events.create(event, function (err, newEvent) {
            event = newEvent;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.addAttachment(event.id, formData, function (err, eventWithAttachment) {
            event = eventWithAttachment;
            attachment = event.attachments[0];
            stepDone(err);
          });
        }
      ], done);
    });

    after(function (done) {
      async.series([
        function (stepDone) {
          connection.events.delete(event, function (err, trashedEvent) {
            event = trashedEvent;
            return stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(event, function (err) {
            return stepDone(err);
          });
        }
      ], done);
    });

    it('must accept an attachment\'s and its event\'s parameters and ' +
    'return a readable stream that contains the file', function (done) {
      var pack = {
        readToken: attachment.readToken,
        fileId: attachment.id,
        eventId: event.id
      };
      async.series([
        function (stepDone) {
          connection.events.getAttachment(pack, function (err, res) {
            should.not.exist(err);
            should.exist(res);
            var temp = [];
            res.on('data', function (data) {
              temp.push(data);
            });
            res.on('end', function () {
              var result = Buffer.concat(temp);
              should.equal(Buffer.compare(originalFile,result), 0);
              stepDone();
            });
            res.on('error', function (err) {
              stepDone(err);
            });
          });
        }
      ], done);
    });

    it('must return an error in case of invalid parameters', function (done) {
      var pack = {
        readToken: attachment.readToken,
        fileId: 'not-existent-id',
        eventId: event.id
      };
      connection.events.getAttachment(pack, function (err) {
        should.exist(err);
        done();
      });
    });
  });


  describe('removeAttachment()', function () {

    // TODO
    it('must accept an attachment and return the updated event');

    // TODO
    it('must accept the eventId and fileId and return the updatedEvent');

    // TODO
    it('must return an error in case of invalid parameters');
  });


  describe('delete()', function () {
    var eventToTrash;

    beforeEach(function (done) {
      eventToTrash = {
        content: 'I am going to be trashed or event deleted',
        streamId: testStream.id,
        type: 'note/txt'
      };
      connection.events.create(eventToTrash, function (err, event) {
        eventToTrash = event;
        done(err);
      });
    });

    afterEach(function (done) {
      if (eventToTrash !== null) {
        connection.events.delete(eventToTrash, function (err) {
          done(err);
        });
      } else {
        done();
      }
    });

    it('must accept an Event object and return an Event object flagged as trashed',
      function (done) {
        connection.events.delete(eventToTrash, function (err, updatedEvent) {
          should.not.exist(err);
          should.exist(updatedEvent);
          updatedEvent.should.be.instanceOf(Pryv.Event);
          updatedEvent.trashed.should.equal(true);
          done();
        });
      });

    // TODO: update implementation to match API - when event is deleted, the id and deleted
    // timestamp must be returned.
    it('must return null when deleting a trashed event', function (done) {
      async.series([
        function (stepDone) {
          connection.events.delete(eventToTrash, function (err, trashedEvent) {
            should.not.exist(err);
            should.exist(trashedEvent);
            trashedEvent.trashed.should.be.equal(true);
            eventToTrash = trashedEvent;
            stepDone(err);
          });
        },
        function (stepDone) {
          connection.events.delete(eventToTrash, function (err, deletedEvent) {
            should.not.exist(err);
            should.not.exist(deletedEvent);
            eventToTrash = deletedEvent;
            stepDone(err);
          });
        }
      ], done);
    });

    // TODO: not implemented yet
    it.skip('must accept an event id', function (done) {
      var id = eventToTrash.id;
      connection.events.delete(id, function (err, trashedEvent) {
        should.not.exist(err);
        trashedEvent.should.be.instanceOf(Pryv.Event);
        trashedEvent.trashed.should.be.true();
        done();
      });
    });

    // TODO: not implemented yet
    it('must accept an array of event ids');

    // TODO: not implemented yet
    it('must accept an array of Event objects');

    it('must return an error when the specified event does not exist', function (done) {
      connection.events.delete({id: 'unexistant-id-54s65df4'}, function (err, updatedEvent) {
        should.exist(err);
        should.not.exist(updatedEvent);
        done();
      });
    });
  });

});
