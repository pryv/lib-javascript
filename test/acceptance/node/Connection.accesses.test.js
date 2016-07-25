/* global describe, it, before, after */
var Pryv = require('../../../source/main'),
  should = require('should'),
  config = require('../test-support/config.js'),
  async = require('async');

describe('Connection.accesses', function () {
  this.timeout(10000);

  var accessConnection;


  before(function (done) {
    Pryv.Connection.login(config.loginParams, function (err, newConnection) {
      accessConnection = newConnection;
      done(err);

    });
  });

  describe('get()', function () {
    it('must return the list of connection accesses', function (done) {
      accessConnection.accesses.get(function (err, res) {
        should.not.exist(err);
        should.exist(res);
        res.should.be.instanceOf(Array);
        res.forEach( function (access) {
          should.exist(access.id);
          should.exist(access.token);
          should.exist(access.name);
        });
        done();
      });
    });

    it('must return an error if an inappropriate token is used', function (done) {
      var badSettings = {
        username: 'badName',
        auth: 'falseToken',
        staging: true
      };
      var con = new Pryv.Connection(badSettings);
      con.accesses.get(function (err) {
        should.exist(err);
        done();
      });
    });

  });

  describe('create()', function () {

    var testAccess, testStream;

    before(function (done) {
      testStream = {
        id: 'accessTestStream',
        name: 'accessTestStream'
      };
      accessConnection.streams.create(testStream, function (err, newStream) {
        testStream = newStream;
        done(err);
      });
    });

    after(function (done) {
      async.series([
        function (stepDone) {
          accessConnection.streams.delete(testStream, function (err, trashedStream) {
            testStream = trashedStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          accessConnection.streams.delete(testStream, function (err) {
            stepDone(err);
          });
        },
        function (stepDone) {
          accessConnection.accesses.delete(testAccess.id, function (err) {
            stepDone(err);
          });
        }
      ], done);
    });

    it('must return the created access', function (done) {
      testAccess = {
        type: 'shared',
        name: 'testAccess',
        permissions: [
          {
            streamId: testStream.id,
            level: 'read'
          }
        ]};
      accessConnection.accesses.create(testAccess, function (err, newAccess) {
        should.not.exist(err);
        should.exist(newAccess);
        should.exist(newAccess.id);
        testAccess = newAccess;
        done();
      });
    });

    it('must return an error if the new access\'s parameters are invalid', function (done) {
      var invalidAccess = {
        type: 'wrongType',
        name: 'wrongAccess',
        permissions: [
          {
            streamId: testStream.id,
            level: 'wrongLevel'
          }
        ]};
      accessConnection.accesses.create(invalidAccess, function (err) {
        should.exist(err);
        done();
      });
    });

  });

  describe('update()', function () {

    var testAccess, testStream, streamConnection;

    before(function (done) {
      testStream = {
        id: 'accessTestStream',
        name: 'accessTestStream'
      };
      testAccess = {
        type: 'shared',
        name: 'testAccess',
        permissions: [
          {
            streamId: testStream.id,
            level: 'read'
          }
        ]};

      streamConnection = new Pryv.Connection(config.connectionSettings);

      async.series([
        function (stepDone) {
          streamConnection.streams.create(testStream, function (err, newStream) {
            testStream = newStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          accessConnection.accesses.create(testAccess, function (err, newAccess) {
            testAccess = newAccess;
            stepDone(err);
          });
        }
      ], done);

    });

    after(function (done) {
      async.series([
        function (stepDone) {
          accessConnection.accesses.delete(testAccess.id, function (err) {
            stepDone(err);
          });
        },
        function (stepDone) {
          streamConnection.streams.delete(testStream, function (err, trashedStream) {
            testStream = trashedStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          streamConnection.streams.delete(testStream, function (err) {
            stepDone(err);
          });
        }
      ], done);
    });

    it('must return the updated access', function (done) {
      testAccess.name = 'myNewAccessName';
      accessConnection.accesses.update(testAccess, function (err, updatedAccess) {
        should.not.exist(err);
        should.exist(updatedAccess);
        testAccess.name.should.eql(updatedAccess.name);
        testAccess = updatedAccess;
        done();
      });
    });

    it('must return an error if the updated access\'s parameters are invalid', function (done) {
      testAccess.permissions = [
          {
            fakeParam1: 'fghjkvbnm',
            fakeParam2: 'tzuiogfd'
          }
        ];
      accessConnection.accesses.update(testAccess, function (err) {
        should.exist(err);
        done();
      });
    });

    it('must return an error if the access to update doesn\'t have an id field', function (done) {
      var unexistingAccess = {};
      accessConnection.accesses.update(unexistingAccess, function (err) {
        should.exist(err);
        done();
      });
    });

  });

  describe('delete()', function () {

    var testAccess, testStream, streamConnection;

    before(function (done) {
      testStream = {
        id: 'accessTestStream',
        name: 'accessTestStream'
      };
      testAccess = {
        type: 'shared',
        name: 'testAccess',
        permissions: [
          {
            streamId: testStream.id,
            level: 'read'
          }
        ]};

      streamConnection = new Pryv.Connection(config.connectionSettings);

      async.series([
        function (stepDone) {
          streamConnection.streams.create(testStream, function (err, newStream) {
            testStream = newStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          accessConnection.accesses.create(testAccess, function (err, newAccess) {
            testAccess = newAccess;
            stepDone(err);
          });
        }
      ], done);

    });

    after(function (done) {
      async.series([
        function (stepDone) {
          streamConnection.streams.delete(testStream, function (err, trashedStream) {
            testStream = trashedStream;
            stepDone(err);
          });
        },
        function (stepDone) {
          streamConnection.streams.delete(testStream, function (err) {
            stepDone(err);
          });
        }
      ], done);
    });

    it('must return an item deletion with the deleted access\' id', function (done) {
      accessConnection.accesses.delete(testAccess.id, function (err, result) {
        should.not.exist(err);
        should.exist(result.accessDeletion);
        testAccess.id.should.be.eql(result.accessDeletion.id);
        done();
      });
    });

    it('must return an error if the id of the access to delete doesn\'t exist', function (done) {
      var fakeAccessId = 'wertzuiosdfghjkcvbnm';
      accessConnection.accesses.delete(fakeAccessId, function (err) {
        should.exist(err);
        done();
      });
    });

  });


});