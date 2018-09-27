/* global describe, it, before, after */
const Pryv = require('../../../source/main');
const should = require('should');
const config = require('../test-support/config.js');
const async = require('async');
const _ = require('lodash');
const bluebird = require('bluebird');
const assert = require('assert');


// Encodes the strategy we use to ensure an object is in the remote pryv 
// database before starting a test. 
//
// Example: 
// 
//   ensureStream = new EnsureEntity({
//     createClosure: (attrs) => {
//       // Create a stream with attrs given, return Promise<Stream>.
//     },
//     deleteClosure: (attrs) => {
//       // Delete a stream (identified by attrs)
//     },
//   });
// 
class EnsureEntity {
  constructor(opts) {
    this.configure('create', opts);
    this.configure('delete', opts);
  }

  // Configures the action either from 'actionMethod' or 'actionClosure', 
  // assigns to 'this.actionClosure'. 
  // 
  configure(action, opts) {
    const closureName = `${action}Closure`;
    const method = opts[`${action}Method`];

    if (method != null) {
      this[closureName] = async (attrs) => {
        return bluebird.fromCallback(
          cb => method(attrs, cb));
      };
    }
    else {
      const closure = opts[closureName];
      assert(closure != null, `Please specify either ${action}Method or ${action}Closure.`);

      this[closureName] = closure;
    }
  }

  async ensure(attrs) {
    try {
      return await this.createClosure(attrs);
    }
    catch (err) {
      // We could not create the object; let's assume it was because it is already
      // there and wasn't properly cleaned after a test failure. Delete it, 
      // then retry. 

      await this.deleteClosure(attrs);
      try {
        await this.deleteClosure(attrs);
      } 
      catch (err) { 
        // IGNORE
      }
      return this.createClosure(attrs);
    }
  }

  async createOnly(attrs) {
    return await this.createClosure(attrs);
  }
}

const conn = new Pryv.Connection(config.connectionSettings);
const streams = conn.streams;
const ensureStream = new EnsureEntity({
  deleteMethod: streams.delete.bind(streams), 
  createMethod: streams.create.bind(streams), 
});

describe('Connection.accesses', function () {
  this.timeout(10000);

  let accessConnection;
  let ensureAccess;
  before(async () => {
    accessConnection = await bluebird.fromCallback(
      cb => Pryv.Connection.login(config.loginParams, cb));
    
    const accesses = accessConnection.accesses;
    ensureAccess = new EnsureEntity({
      deleteClosure: async (attrs) => {
        const all = await bluebird.fromCallback(
          cb => accesses.get(cb));

        const access = _.find(all, a => a.name === attrs.name); 
        assert(access != null);

        return bluebird.fromCallback(cb => accesses.delete(access.id, cb));
      },
      createMethod: accesses.create.bind(accesses), 
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

    before(async () => {
      testStream = await ensureStream.ensure({
        id: 'accessTestStream',
        name: 'accessTestStream'
      });
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

    before(async () => {
      testStream = await ensureStream.ensure({
        id: 'accessTestStream',
        name: 'accessTestStream'
      });

      testAccess = await ensureAccess.ensure({
        type: 'shared',
        name: 'testAccess',
        permissions: [
          {
            streamId: testStream.id,
            level: 'read'
          }
        ]
      });

      streamConnection = new Pryv.Connection(config.connectionSettings);
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

    let testAccess, testStream;
    before(async () => {
      testStream = await ensureStream.ensure({
        id: 'accessTestStream',
        name: 'accessTestStream'
      });
      testAccess = await ensureAccess.ensure({
        type: 'shared',
        name: 'testAccess',
        permissions: [
          {
            streamId: testStream.id,
            level: 'read'
          }
        ]
      });
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