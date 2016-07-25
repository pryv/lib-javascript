/* global before, describe, it */

var pryv = require('../../../source/main'),
  should = require('should'),
  nock = require('nock'),
  responses = require('../test-support/responses.js');

// !! Monitor tests are made online

var testProfile = function (preFetchStructure) {

  var localEnabledStr = preFetchStructure ? ' + LocalStorage' : '';
  var username = 'test-user';
  var auth = 'test-token';
  var settings = {
    username: username,
    auth: auth,
    port: 443,
    ssl: true,
    domain: 'test.io'
  };
  describe('Profile' + localEnabledStr, function () {
    this.timeout(15000);
    var connection = new pryv.Connection(settings);
    if (preFetchStructure) {
      nock('https://' + username + '.' + settings.domain)
        .get('/streams?state=all')
        .reply(200, responses.streams, responses.headersStandard);
      before(function (done) {
        connection.fetchStructure(function (error) {
          should.not.exist(error);
          done();
        });
      });
    }

    it('conn.profile.setPublic()', function (done) {
      var data = {test1 : 'testA', test2: null};
      var response = {profile: data};
      nock('https://' + username + '.' + settings.domain)
        .put('/profile/app')
        .reply(200, response, responses.headersStandard);
      connection.profile.setPublic(data, function (error, result) {
        should.not.exist(error);
        should.exist(result);
        result.should.eql(response);
        done();
      });
    });

    it('conn.profile.setPrivate()', function (done) {

      var data = {test1 : 'testA', test2: null};
      var response = {profile: data};
      nock('https://' + username + '.' + settings.domain)
        .put('/profile/private')
        .reply(200, response, responses.headersStandard);
      connection.profile.setPrivate(data, function (error, result) {
        should.not.exist(error);
        should.exist(result);
        result.should.eql(response);
        done();
      });
    });

    it('conn.profile.getPublic(null)', function (done) {
      nock('https://' + username + '.' + settings.domain)
        .get('/profile/app')
        .reply(200, responses.profile, responses.headersStandard);
      connection.profile.getPublic(null, function (error, result) {
        should.not.exist(error);
        result.should.eql(responses.profile.profile);
        done();
      });
    });

    it('conn.profile.getPrivate(null)', function (done) {
      nock('https://' + username + '.' + settings.domain)
        .get('/profile/private')
        .reply(200, responses.profile, responses.headersStandard);
      connection.profile.getPrivate(null, function (error, result) {
        should.not.exist(error);
        result.should.eql(responses.profile.profile);
        done();
      });
    });

    it('conn.profile.getPublic(key)', function (done) {
      nock('https://' + username + '.' + settings.domain)
        .get('/profile/app')
        .reply(200, responses.profile, responses.headersStandard);
      connection.profile.getPublic('setting1', function (error, result) {
        should.not.exist(error);
        result.should.eql(responses.profile.profile.setting1);
        done();
      });
    });

    it('conn.profile.getPrivate(key)', function (done) {
      nock('https://' + username + '.' + settings.domain)
        .get('/profile/private')
        .reply(200, responses.profile, responses.headersStandard);
      connection.profile.getPrivate('setting1', function (error, result) {
        should.not.exist(error);
        result.should.eql(responses.profile.profile.setting1);
        done();
      });
    });

  });

};

testProfile(false);

