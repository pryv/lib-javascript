/* global describe, it */
var pryv = require('../../../source/main'),
  should = require('should'),
  nock = require('nock'),
  responses = require('../test-support/responses.js'),
  _ = require('lodash');



describe('Connection', function () {

  var username = 'test-user',
    auth = 'test-token';
  var settings = {
    username: username,
    auth: auth,
    port: 443,
    ssl: true,
    domain: 'test.io'
  };
  var generatedConnectionId = 'https://test-user.test.io:443/?auth=test-token';


  var generatedShortId = 'test-user:pryv-explorer';

  var connection = new pryv.Connection(settings);
  var serialId = 'C' +  (pryv.Connection._serialCounter - 1);


  describe('connection id generation', function () {


    it('should return correct url', function (done) {
      connection.id.should.equal(generatedConnectionId);
      done();
    });

  });

  describe('serialId', function () {

    it('should exists', function (done) {
      connection.serialId.should.equal(serialId);
      done();
    });

  });

  describe('displayId with connection not initialized', function () {

    it('should throw error', function (done) {
      var displayId = null;
      var catchedError = null;
      try {
        displayId = connection.displayId;
      } catch (error) {
        catchedError = error;
      }
      should.exist(catchedError);
      should.not.exist(displayId);
      done();
    });

  });

  describe('reachability test on api-headers', function () {
    this.timeout(15000);

    it('should return API_UNREACHABLE Error', function (done) {
      var endPoint = 'https://' + username + '.' + settings.domain;
      nock(endPoint)
        .get('/whatever')
        .reply(200, responses.accessInfo, ['invalid headers']);

      connection.request({
        method: 'GET',
        path: '/whatever',
        callback: function (error, result) {
          should.exist(error);
          error.id.should.eql('API_UNREACHEABLE');
          should.exist(result);
          done();
        }
      });
    });
  });


  describe('connection.request responseInfo contains headers and code', function () {
    this.timeout(15000);

    var headers = {toto : 'titi'};
    _.extend(headers,  responses.headersStandard);


    function testResultInfo(resultInfo, code) {
      should.exists(resultInfo.code);
      resultInfo.code.should.equal(code);
      should.exists(resultInfo.headers);
      should.exists(resultInfo.headers.toto);
      resultInfo.headers.toto.should.equal('titi');
    }

    it('on invalid request', function (done) {
      var endPoint = 'https://' + username + '.' + settings.domain;
      nock(endPoint)
        .get('/whatever')
        .reply(400, {error: {id: 'invalid-parameters-format', message: 'Test message'}}, headers);

      connection.request({
        method: 'GET',
        path: '/whatever',
        callback: function (error, result, resultInfo) {
          should.exists(result);
          should.exists(error);
          testResultInfo(resultInfo, 400);
          done();
        }
      });
    });

    it('on valid request', function (done) {
      var endPoint = 'https://' + username + '.' + settings.domain;
      nock(endPoint)
        .get('/whatever')
        .reply(200, responses.accessInfo, headers);

      connection.request({
        method: 'GET',
        path: '/whatever',
        callback: function (error, result, resultInfo) {
          should.exists(result);
          should.not.exists(error);
          testResultInfo(resultInfo, 200);
          done();
        }
      });
    });

  });


  describe('accessInfo()', function () {
    this.timeout(15000);

    it('should call the proper API method', function (done) {
      nock('https://' + username + '.' + settings.domain)
        .get('/access-info')
        .reply(200, responses.accessInfo, responses.headersStandard);
      var requestTime = (new Date()).getTime();
      connection.accessInfo(function (err, result) {
        var responseTime =  (new Date()).getTime();

        should.not.exist(err);
        should.exist(result);
        result.should.eql(responses.accessInfo);

        connection.serverInfos.deltaTime.should.be.within(1, 15);
        connection.serverInfos.apiVersion.should.equal('nock nock');
        connection.serverInfos.lastSeenLT.should.be.within(requestTime, responseTime);
        done();
      });
    });
  });

  describe('displayId with connection initialized', function () {

    it('should not throw error', function (done) {
      var displayId = null;
      var catchedError = null;
      try {
        displayId = connection.displayId;
      } catch (error) {
        catchedError = error;
      }
      should.not.exist(catchedError);
      displayId.should.equal(generatedShortId);
      done();
    });

  });

  describe('time management', function () {

    it('getLocalTime getServerTime', function (done) {

      var serverTime = 0;
      var localTime = connection.getLocalTime(serverTime);
      connection.getServerTime(localTime).should.equal(serverTime);


      connection.getServerTime().should.be.approximately(
        connection.getServerTime((new Date()).getTime()), 1
      );

      done();
    });


  });

});
