/* global describe, it, before, after */
var Pryv = require('../../../source/main'),
  should = require('should'),
  config = require('../test-support/config.js');

describe('Connection.account', function () {
  this.timeout(10000);

  var connection;
  before(function (done) {
      Pryv.Connection.login(config.loginParams, function (err, newConnection) {
        connection = newConnection;
        done(err);
      });
  });

  describe('getInfo()', function () {

    it('must return user account info (e.g. username, email, language)', function (done) {
      connection.account.getInfo(function (error, result) {
        should.not.exist(error);
        should.exist(result);
        result.should.have.properties('username', 'email', 'language');
        done();
      });
    });

    it('must return an error when the connection lacks sufficient permissions', function (done) {
      var insufficientPermissionConnection = new Pryv.Connection(config.connectionSettings);
      insufficientPermissionConnection.account.getInfo(function (error) {
        should.exist(error);
        done();
      });
    });
  });

  describe('changePassword()', function () {

    var newPassword = 'testPassword';
    var truePassword = config.loginParams.password;

    after(function (done) {
      connection.account.changePassword(newPassword, truePassword, function (err) {
        done(err);
      });
    });

    it('must change the account password', function (done) {
      connection.account.changePassword(truePassword, newPassword, function (err) {
        should.not.exist(err);
        done(err);
      });
    });

    it('must return an error when the given "old" password is not valid', function (done) {
      connection.account.changePassword('wrongpassword', 'dontcare', function (error) {
        should.exist(error);
        done();
      });
    });

    it('must return an error when the given "new" password does not match requirements',
      function (done) {
      var invalidNewPassword = '';
      connection.account.changePassword(truePassword, invalidNewPassword, function (err) {
        should.exist(err);
        done();
      });
    });

    it('must return an error when the connection lacks sufficient permissions', function (done) {
      var insufficientPermissionConnection = new Pryv.Connection(config.connectionSettings);
      insufficientPermissionConnection.account.changePassword(newPassword, truePassword,
        function (error) {
        should.exist(error);
        done();
      });
    });
  });
});
