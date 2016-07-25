/* global before, describe, it */

// jshint -W098
var pryv = require('../../../source/main'),
  should = require('should'),
  config = require('../../acceptance/test-support/config.js'),
  fs = require('fs');


// TODO: remove because covered in acceptance/Connection.events.test.create().
// it('must accept attachment only with Event object');
var testEvents = function () {


  var streamId = config.testDiaryStreamId;

  describe('Connection.events', function () {
    this.timeout(15000);



    var connection = new pryv.Connection(config.connectionSettings);

    var pictureData = fs.readFileSync(__dirname + '/../test-support/photo.PNG');

    before(function (done) {
      should.exist(pictureData);
      done();
    });


    // TODO Fix this test (it cause crash of other test)
    it('createWithAttachment( eventData )', function (done) {

      var eventData = {streamId : streamId, type : 'picture/attached', description: 'test'};

      var formData = pryv.utility.forgeFormData('attachment0', pictureData, {
        type: 'image/png',
        filename: 'attachment0'
      });

      var event = null;
      event = connection.events.createWithAttachment(eventData, formData,
        function (err, resultJson) {
          should.not.exist(err);
          should.exist(resultJson);
          done();
        });

    });

  });

};

testEvents();

