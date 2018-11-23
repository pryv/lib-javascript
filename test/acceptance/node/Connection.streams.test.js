/* global describe, it, before, after */
var Pryv = require('../../../source/main'),
  should = require('should'),
  config = require('../test-support/config.js'),
  async = require('async'),
  _ = require('underscore'),
  cuid = require('cuid');

// TODO: wait to have test account with given data to update tests
// (i.e number of trashed stream/children)
describe('Connection.streams', function () {
  this.timeout(20000);

  function getRandomNum(max) {
    return Math.floor(Math.random() * max);
  }

  var connection = new Pryv.Connection(config.connectionSettings);

  describe('get()', function () {
    // TODO: maybe verify tree structure

    var testTimeStart, diaryStream, streamDelete, streamWithNoChildren;

    before(function (done) {
      diaryStream = {
          name: 'Diary' + getRandomNum(10000)
        };
      streamDelete = {
          name: 'Deleted' + getRandomNum(10000)
        };
      streamWithNoChildren = {
        name: 'nochildstream' + getRandomNum(10000)
      };

      async.series([
        function (stepDone) {
          connection.streams.create(streamWithNoChildren, function (err, stream) {
            if (err && err.id !== 'item-already-exists') {
              return stepDone(err);
            }
            streamWithNoChildren = stream;
            stepDone();
          });
        },
        function (stepDone) {
          connection.streams.create(diaryStream, function (err, stream) {
            if (err && err.id !== 'item-already-exists') {
              return stepDone(err);
            }
            diaryStream = stream;
            stepDone();
          });
        },
        function (stepDone) {
          connection.streams.create({parentId: diaryStream.id, name: 'diaryChild'},
            function (err, stream) {
              if (err && err.id !== 'item-already-exists') {
                return stepDone(err);
              }
              diaryStream = stream;
              stepDone();
            });
        },
        function (stepDone) {
          connection.streams.create(streamDelete, function (err, stream) {
            if (err && err.id !== 'item-already-exists') {
              return stepDone(err);
            }
            streamDelete = stream;
            stepDone();
          });
        },
        function (stepDone) {
          testTimeStart = new Date().getTime() / 1000;
          connection.streams.delete(streamDelete, stepDone);
        }
      ], done);
    });

    after (function (done) {
      connection.batchCall([
        {
          method: 'streams.delete',
          params: _.pick(diaryStream, 'id')
        },
        {
          method: 'streams.delete',
          params: _.extend(_.pick(diaryStream, 'id'), { mergeEventsWithParent: false })
        },
        {
          method: 'streams.delete',
          params: _.pick(streamWithNoChildren, 'id')
        },
        {
          method: 'streams.delete',
          params: _.extend(_.pick(streamWithNoChildren, 'id'), { mergeEventsWithParent: false })
        }
      ], function (err, results) {
        if (err) { return done(err); }
        for (var i = 0; i < results.length; i++) {
          if (results[i].error) { return done(results[i].error); }
        }
        done();
      });
    });

    it('must return a tree of non-trashed Stream objects by default', function (done) {
      connection.streams.get(null, function (error, streams) {
        should.not.exist(error);
        should.exist(streams);

        (function checkStreams(array) {
          array.should.be.instanceOf(Array);
          array.forEach(function (stream) {
            stream.should.be.instanceOf(Pryv.Stream);
            var trashed = stream.trashed ? true : false;
            trashed.should.equal(false);
            if (stream.children) {
              checkStreams(stream.children);
            }
          });
        })(streams);
        done();
      });
    });

    it('must return streams matching the given filter', function (done) {
      var filter = {parentId: diaryStream.id};
      connection.streams.get(filter, function (error, streams) {
        should.exist(streams);
        streams.forEach(function (stream) {
          stream.parentId.should.equal(filter.parentId);
        });
        done();
      });
    });

    it('must return an empty array if there are no matching streams', function (done) {
      var filter = {parentId: streamWithNoChildren.id};
      connection.streams.get(filter, function (error, streams) {
        should.not.exist(error);
        streams.length.should.equal(0);
        done();
      });
    });

    it('must return trashed streams when the field state is set to \'all\'', function (done) {
      var filter = {state: 'all'};
      connection.streams.get(filter, function (err, streams) {
        should.not.exists(err);
        should.exists(streams);
        var found = false;
        streams.forEach(function (stream) {
          if (stream.id === streamDelete.id) {
            found = true;
          }
        });
        found.should.equal(true);
        done();
      });
    });

    it('must return an error if the given filter contains invalid parameters', function (done) {
      var filter = {parentId: 42, state: 'toto'};
      connection.streams.get(filter, function (error, streams) {
        should.exist(error);
        should.not.exist(streams);
        done();
      });
    });

    it('must accept a null filter', function (done) {
      connection.streams.get(null, function (err, streams) {
        should.not.exist(err);
        should.exist(streams);
        streams.forEach(function (stream) {
          stream.should.be.instanceOf(Pryv.Stream);
        });
        done();
      });
    });

  });

  describe('create()', function () {
    var streamData1, streamData2,
      stream, stream2;

    before(function (done) {
      streamData1 = {
        name: 'testStreamName1' + getRandomNum(10000)
      };
      streamData2 = {
        name: 'testStreamName2' + getRandomNum(10000)
      };
      done();
    });

    after(function (done) {
      connection.batchCall([
        {
          method: 'streams.delete',
          params: _.pick(stream, 'id')
        },
        {
          method: 'streams.delete',
          params: _.extend(_.pick(stream, 'id'), { mergeEventsWithParent: false })
        },
        {
          method: 'streams.delete',
          params: _.pick(stream2, 'id')
        },
        {
          method: 'streams.delete',
          params: _.extend(_.pick(stream2, 'id'), { mergeEventsWithParent: false })
        }
      ], function (err, results) {
        if (err) { return done(err); }
        for (var i = 0; i < results.length; i++) {
          if (results[i].error) { return done(results[i].error); }
        }
        done();
      });
    });

    it('must accept a stream-like object and return a Stream object', function (done) {
      connection.streams.create(streamData1, function(err, newStream) {
        should.not.exist(err);
        should.exist(newStream);
        newStream.should.be.instanceOf(Pryv.Stream);
        stream = newStream;
        done();
      });
    });

    // TODO not implemented yet
    it.skip('must accept an array of stream-like objects and return an array of Stream objects');

    it('must return streams with default values for unspecified properties', function (done) {
      connection.streams.create(streamData2, function(err, newStream) {
        should.not.exist(err);
        should.exist(newStream.id);
        should.exist(newStream.created);
        should.exist(newStream.createdBy);
        should.exist(newStream.modified);
        should.exist(newStream.modifiedBy);
        stream2 = newStream;
        done();
      });
    });

    // TODO: find out what similar means to generate error
    it.skip('must return an item-already-exists error if a similar stream already exists.',
      function (done) {
      connection.streams.create(streamData1, function (err) {
        should.exist(err);
        done();
      });
    });

    it('must return an error if the given stream data is invalid', function (done) {
      var invalidStream = {};
      connection.streams.create(invalidStream, function (err) {
        should.exist(err);
        done();
      });
    });

    it('must return an error for each invalid stream (when given multiple items)');
  });

  describe('update()', function () {
    var streamParent = {
      id: 'libjs-test-stream-parent-update',
      name: 'libjs-test-stream-parent-update' + getRandomNum(10000),
      parentId: null
    };
    var streamToUpdate = {
      id: 'libjs-test-stream-update-to-update',
      name: 'libjs-test-stream-update-to-update' + getRandomNum(10000),
      parentId: streamParent.id
    };
    var streamToMove = {
      id: 'libjs-test-stream-update-to-move',
      name: 'libjs-test-stream-update-to-move' + getRandomNum(10000),
      parentId: streamParent.id
    };

    before(function (done) {
      connection.batchCall([
        {
          method: 'streams.create',
          params: streamParent
        },
        {
          method: 'streams.create',
          params: streamToUpdate
        },
        {
          method: 'streams.create',
          params: streamToMove
        }
      ], function (err, results) {
        if (err) { return done(err); }
        for (var i = 0; i < results.length; i++) {
          if (results[i].error) { return done(results[i].error); }
        }
        done();
      });
    });

    after(function (done) {
      connection.batchCall([
        {
          method: 'streams.delete',
          params: streamParent
        },
        {
          method: 'streams.delete',
          params: _.extend(streamParent, { mergeEventsWithParent: false })
        }
      ], function (err, results) {
        if (err) { return done(err); }
        for (var i = 0; i < results.length; i++) {
          if (results[i].error) { return done(results[i].error); }
        }
        done();
      });
    });


    it('must accept a Stream object and return the updated stream', function (done) {
      streamToUpdate.name = 'libjs-test-stream2';
      connection.streams.update(streamToUpdate, function (error, updatedStream) {
        should.not.exist(error);
        should.exist(updatedStream);
        updatedStream.should.be.instanceOf(Pryv.Stream);
        updatedStream.name.should.equal('libjs-test-stream2');
        done();
      });
    });

    // TODO: implement functionality
    it('must accept an array of Stream objects');

    it('must return an error if the stream is invalid', function (done) {
      var invalidStream = {};
      connection.streams.update(invalidStream, function (err) {
        should.exist(err);
        done();
      });
    });

    it('must update the stream tree when the parent was updated', function (done) {
      streamToMove.parentId = streamToUpdate.id;
      connection.streams.update(streamToMove, function (error, updatedStream) {
        should.not.exist(error);
        should.exist(updatedStream);
        updatedStream.should.be.instanceOf(Pryv.Stream);
        updatedStream.parentId.should.equal(streamToUpdate.id);
        done();
      }.bind(this));
    });

    // TODO: same as in create()
    it('must return an item-already-exists error if a similar stream already exists');

  });

  describe('delete()', function () {    
    var streamParent = {
      id: 'libjs-test-stream-parent',
      name: 'libjs-test-stream-parent',
      parentId: null,
    };
    var streamToTrashSimple1 = {
      parentId: streamParent.id,
      name: 'libjs-test-stream-delete-trash1',
      id: 'libjs-test-stream-delete-trash1'
    };
    var streamToTrashSimple2 = {
      parentId: streamParent.id,
      name: 'libjs-test-stream-delete-trash2',
      id: 'libjs-test-stream-delete-trash2',
      trashed: true
    };
    var streamToTrashChildMerge = {
      parentId: streamParent.id,
      id: 'libjs-test-stream-delete-child-merge',
      name: 'libjs-test-stream-delete-child-merge'
    };
    var streamToTrashNoMerge1 = {
      id: 'libjs-test-stream-delete-no-merge1',
      parentId: streamParent.id,
      name: 'libjs-test-stream-delete-no-merge1'
    };
    var streamToTrashNoMerge2 = {
      id: 'libjs-test-stream-delete-no-merge2',
      parentId: streamParent.id,
      name: 'libjs-test-stream-delete-no-merge2'
    };
    var eventToMerge = {
      time: 1404155270,
      streamId: streamToTrashChildMerge.id,
      type: 'note/txt',
      content: 'libjs-test-stream-delete-to-merge',
      id: cuid()
    };
    var eventNoMerge1 = {
      streamId: streamToTrashNoMerge1.id,
      time: 1404155270,
      type: 'note/txt',
      content: 'libjs-test-stream-delete-no-merge1',
      id: cuid()
    };
    var eventNoMerge2 = {
      streamId: streamToTrashNoMerge2.id,
      time: 1404155270,
      type: 'note/txt',
      content: 'libjs-test-stream-delete-no-merge2',
      id: cuid()
    };
    
    before(function (done) {
      connection.batchCall([
        {
          method: 'streams.create',
          params: streamParent
        },
        {
          method: 'streams.create',
          params: streamToTrashSimple1
        },
        {
          method: 'streams.create',
          params: streamToTrashSimple2
        },
        {
          method: 'streams.create',
          params: streamToTrashChildMerge
        },
        {
          method: 'streams.create',
          params: streamToTrashNoMerge1
        },
        {
          method: 'streams.create',
          params: streamToTrashNoMerge2
        },
        {
          method: 'streams.create',
          params: streamToTrashSimple2
        },
        {
          method: 'events.create',
          params: eventToMerge
        },
        {
          method: 'streams.delete',
          params: streamToTrashChildMerge
        },
        {
          method: 'events.create',
          params: eventNoMerge1
        },
        {
          method: 'events.create',
          params: eventNoMerge2
        },
        {
          method: 'streams.delete',
          params: streamToTrashNoMerge2
        }
      ], function (err) {
        if (err) { return done(err); }
        // ignore errors here as it for some reason doesnt execute after if before fails
        /*
        for (var i = 0; i < results.length; i++) {
          if (results[i].error) { return done(results[i].error); }
        }
        */
        done();
      });
    });

    after(function (done) {
      connection.batchCall([
        {
          method: 'streams.delete',
          params: streamParent
        },
        {
          method: 'streams.delete',
          params: _.extend(streamParent, { mergeEventsWithParent: false })
        }
      ], function (err, results) {
        if (err) { return done(err); }
        for (var i = 0; i < results.length; i++) {
          if (results[i].error) { return done(results[i].error); }
        }
        done();
      });
    });

    it('must accept a stream-like object and return a Stream object flagged as trashed',
      function (done) {
        connection.streams.delete({id: streamToTrashSimple1.id}, function (error, updatedStream) {
          should.not.exist(error);
          should.exist(updatedStream);
          updatedStream.trashed.should.eql(true);
          done();
        });
      });

    it('must return null when deleting an already-trashed stream', function (done) {
      connection.streams.delete({id: streamToTrashSimple2.id}, function (error, updatedStream) {
        should.not.exist(updatedStream);
        should.not.exist(error);
        done();
      });
    });

    it('must accept a stream id', function (done) {
      connection.streams.delete(streamToTrashNoMerge1.id, function (error, updatedStream) {
        should.not.exist(error);
        should.exist(updatedStream);
        updatedStream.trashed.should.eql(true);
        done();
      });
    });

    it('must delete linked events by default when deleting an already-trashed stream');

    it('must not merge linked events into the parent stream when specified');

    it('must merge linked events into the parent stream when specified');

    it('must return an error when the specified stream does not exist', function (done) {
      connection.streams.delete('1234', function (error, updatedStream) {
        should.exist(error);
        should.not.exist(updatedStream);
        done();
      });
    });
  });
});
