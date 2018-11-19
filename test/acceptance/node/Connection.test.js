/* global describe, it */
var Pryv = require('../../../source/main'),
  should = require('should'),
  _ = require('underscore'),
  config = require('../test-support/config.js');

describe('Connection', function () {
  this.timeout(10000);

  // instantiate Connection
  describe('Connection()', function () {

    it('must construct a Connection object with the provided parameters', function (done) {
      var connection = new Pryv.Connection(config.connectionSettings);
      should.exist(connection);
      done();
    });

    it('must return an error when constructor parameters are invalid', function (done) {
      var invalidSettings = null;
      var caughtError, connection;
      try {
        connection = new Pryv.Connection(invalidSettings);
      } catch (error) {
        caughtError = error;
      }
      should.exist(caughtError);
      done();
    });
  });

  describe('attachCredentials()', function () {

    it('must accept username and token credentials', function (done) {
      var offlineCon = new Pryv.Connection(config.connectionSettings);

      var uName = 'user';
      var tk = 'token';

      offlineCon.attachCredentials({
        username: uName,
        auth: tk
      }, function (err, updatedConnection) {
        should.not.exist(err);
        should.exist(updatedConnection);
        should.exist(offlineCon.username);
        should.exist(offlineCon.auth);
        updatedConnection.username.should.be.eql(uName);
        updatedConnection.auth.should.be.eql(tk);
        done();
      });
    });

    it('must return an error when one of the parameters is missing', function (done) {
      var offlineCon = new Pryv.Connection(config.connectionSettings);

      var uName = 'user';

      offlineCon.attachCredentials({
        username: uName
      }, function (err) {
        should.exist(err);
        done();
      });
    });
  });

  // find out if authorize and login need to be combined or left separate
  // with a before() clause on login()
  describe('authorize()', function () {

  });

  describe('login()', function () {
    it('must return a Connection with an access token of type personal', function (done) {

      Pryv.Connection.login(config.loginParams, function (err, newConnection) {
          should.not.exist(err);
          should.exist(newConnection);
          newConnection.username.should.be.eql(config.loginParams.username);
          should.exist(newConnection.auth);
          newConnection.accessInfo(function (err, result) {
            should.not.exist(err);
            should.exist(result);
            result.type.should.be.eql('personal');
            done();
          });
        });
    });

    it('must return an error when the credentials are invalid', function (done) {
      var errorParams = _.clone(config.loginParams);
      errorParams.password = 'falsePassword';
      Pryv.Connection.login(errorParams, function (err) {
        should.exist(err);
        done();
      });
    });

  });

  describe('fetchStructure()', function () {

    it('must return the streams structure', function (done) {
      var connection = new Pryv.Connection(config.connectionSettings);
      connection.fetchStructure(function (err, result) {
        should.not.exist(err);
        should.exist(result);
        result.should.be.instanceOf(Array);
        done();
      });
    });

    // TODO find fail cases
    it('must return an error message when ..?');
  });

  describe('accessInfo()', function () {

    it('must return this connection\'s access info', function (done) {
      var connection = new Pryv.Connection(config.connectionSettings);
      connection.accessInfo(function (err, result) {
        should.not.exist(err);
        should.exist(result);
        done();
      });
    });

    it('must return an error if the username/token are invalid', function (done) {
      var invalidConnectionSettings = {
        username: 'fakeUser',
        auth: 'xxxxx',
        staging: true
      };
      var connection = new Pryv.Connection(invalidConnectionSettings);
      connection.accessInfo(function (err) {
        should.exist(err);
        done();
      });
    });
  });

  describe('privateProfile()', function () {

    it('must return this connection\'s private profile', function (done) {
      Pryv.Connection.login(config.loginParams, function (err, newConnection) {
        newConnection.privateProfile(function (err, result) {
          should.not.exist(err);
          should.exist(result);
          done(err);
        });
      });
    });
  });

  describe('getLocalTime()', function () {

    it('must return the local time', function (done) {
      var connection = new Pryv.Connection(config.connectionSettings);
      should.exist(connection.getLocalTime(new Date().getTime() + 1000));
      done();
    });
  });

  describe('getServerTime()', function () {

    it('must return the server time', function (done) {
      var connection = new Pryv.Connection(config.connectionSettings);
      should.exist(connection.getLocalTime(new Date().getTime()));
      done();
    });
  });

  describe('monitor()', function () {

    var connection = new Pryv.Connection(config.connectionSettings);

    it('must instantiate a monitor with the provided filter', function (done) {
      var filter = new Pryv.Filter();
      filter.streams = [config.testDiaryStreamId, config.testActivityStreamId];
      connection.monitor(filter);
      done();
    });

  });

  describe('batchCall()', function () {

    var connection = new Pryv.Connection(config.connectionSettings);

    it('execute the requested calls in the appropriate order', function (done) {

      var streamId = 'batchCallStreamId',
          streamName = 'batchCallStreamToDelete',
          eventType = 'pressure/mmhg';

      var methodsData = [
        {
          'method': 'streams.create',
          'params': {
            'id': streamId,
            'name': streamName
          }
        },
        {
          'method': 'events.create',
          'params': {
            'time': 1385046854.282,
            'streamId': streamId,
            'type': eventType,
            'content': 120
          }
        },
        {
          'method': 'events.create',
          'params': {
            'time': 1385046854.282,
            'streamId': streamId,
            'type': eventType,
            'content': 80
          }
        },
        {
          'method': 'streams.delete',
          'params': {
            'id': streamId,
            'mergeEventsWithParent': false
          }
        },
        {
          'method': 'streams.delete',
          'params': {
            'id': streamId,
            'mergeEventsWithParent': false
          }
        }
      ];

      connection.batchCall(methodsData, function (err, data) {
        should.not.exist(err);
        should.exist(data);
        data.length.should.eql(methodsData.length);
        data.forEach(function (result) {
          if (result.event) {
            var eventResult = result.event;
            should.exist(eventResult.id);
            should.exist(eventResult.created);
            should.exist(eventResult.createdBy);
            should.exist(eventResult.modified);
            should.exist(eventResult.modifiedBy);
            should.exist(eventResult.tags);
            eventResult.streamId.should.eql(streamId);
            eventResult.type.should.eql(eventType);
          } else if (result.stream) {
            var streamResult = result.stream;
            should.exist(streamResult.created);
            should.exist(streamResult.createdBy);
            should.exist(streamResult.modified);
            should.exist(streamResult.modifiedBy);
            should.not.exist(streamResult.parentId);
            streamResult.id.should.eql(streamId);
            streamResult.name.should.eql(streamName);
          } else if (result.streamDeletion) {
            var streamDeletion = result.streamDeletion;
            streamDeletion.id.should.eql(streamId);
          } else {
            done('unknown result', result);
          }
        });
        done(err);
      });
    });

    it('should return an error when the request has the wrong format', function (done) {

      var methodsData = 'I am going to generate an error because I am not an array';

      connection.batchCall(methodsData, function (err, data) {
        should.exist(err);
        should.not.exist(data);
        done();
      });
    });

    it('should generate an error for each failing call', function (done) {

      var streamId = 'myOneGoodStreamInMyBatchCall';

      var methodsData = [
        {
          method: 'wrong method name',
          params: {
            id: 'stuff that should not be processed'
          }
        },
        {
          method: 'streams.create',
          params: {
            id: streamId,
            name: 'myOneGoodStreamInMyBatchCall'
          }
        },
        {
          'method': 'events.create',
          'params': {
            streamId: 'aStreamIdThatDoesNotExist',
            type: 'note/txt',
            content: 'youhou'
          }
        },
        {
          method: 'streams.update',
          params: {
            update: {
              id: streamId,
              wrongField: 'this is an unsupported field that should generate an error'
            }
          }
        },
        {
          'method': 'streams.delete',
          'params': {
            'id': streamId,
            'mergeEventsWithParent': false
          }
        },
        {
          'method': 'streams.delete',
          'params': {
            'id': streamId,
            'mergeEventsWithParent': false
          }
        }
      ];

      connection.batchCall(methodsData, function (err, data) {
        should.not.exist(err);
        should.exist(data);
        data.length.should.eql(methodsData.length);
        should.exist(data[0].error);
        should.exist(data[1].stream);
        should.exist(data[2].error);
        should.exist(data[3].error);
        should.exist(data[4].stream);
        should.exist(data[5].streamDeletion);
        done(err);
      });
    });
  });

});