/* global describe, it */

var nock = require('nock'),
    should = require('should'),
    utility = require('../../../source/main').utility;

describe('utility', function () {

  var params = {
    id : 'test-id',
    limit: 20,
    array: ['a-0', 'a-1'],
    opt: null
  };
  var paramsToMerge = {
    skip : 10,
    username: null
  };

  describe('getQueryParametersString()', function () {
    var validQuery = 'id=test-id&limit=20&array%5B%5D=a-0&array%5B%5D=a-1';

    it('should return valid query', function () {
      utility.getQueryParametersString(params).should.eql(validQuery);
    });

  });

  describe('mergeAndClean()', function () {

    it('should return merged object without null value', function () {
      var res = utility.mergeAndClean(params, paramsToMerge);
      should.exist(res);
      should.not.exist(res.opt);
      should.not.exist(res.username);
      res.id.should.eql('test-id');
      res.skip.should.eql(10);
    });

  });

  describe('request()', function () {

    var testPack = {
      type : 'GET',
      host : 'test.com',
      port : 443,
      path : '/aPath',
      headers : '',
      payload : '',
      success : function () { return true; },
      error : function ()  { return false; },
      info : '',
      async : true,
      expectedStatus : '',
      ssl : true
    };
    var validData = {
      id: 'abc-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'mail@example.com'
    };

    it('should return valid data', function (done) {
      this.timeout(0);
      nock('https://' + testPack.host)
          .get(testPack.path)
          .reply(200, validData);
      testPack.success = function (data, request) {
        data.should.eql(validData);
        request.code.should.eql(200);
        done();
      };
      utility.request(testPack);
    });

  });

});
