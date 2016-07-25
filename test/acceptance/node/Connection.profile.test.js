/* global describe, it, before */
var Pryv = require('../../../source/main'),
  should = require('should'),
  config = require('../test-support/config.js');

describe('Connection.profile', function () {
  this.timeout(10000);
  var connection, errorConnection;

  before(function (done) {
    errorConnection = new Pryv.Connection(config.connectionSettings);

    Pryv.Connection.login(config.loginParams, function (err, newConnection) {
        connection = newConnection;
        done(err);
      });
  });

  describe('getPrivate()', function () {

    it('must return the user\'s private profile set', function (done) {
      connection.profile.getPrivate(null, function (err, res) {
        should.not.exist(err);
        should.exist(res);
        done(err);
      });
    });

    it('must return an error', function (done) {
      errorConnection.profile.getPrivate(null, function (err) {
        should.exist(err);
        done();
      });
    });
  });

  describe('getPublic()', function () {

    it('must return the user\'s current public profile set', function (done) {
      var connection = new Pryv.Connection(config.connectionSettings);
      connection.profile.getPublic(null, function (err, res) {
        should.not.exist(err);
        should.exist(res);
        done();
      });
    });

    // TODO Connect with invalid token
    it.skip('must return an error', function (done) {
      errorConnection.profile.getPublic(null, function (err) {
        should.exist(err);
        done();
      });
    });
  });

  describe('setPrivate()', function () {
    
  });

  describe('setPublic()', function () {

  });

  describe('getTimeLimits()', function () {

  });

});