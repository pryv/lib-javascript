/* global describe, it */

var pryv = require('../../../source/main'),
  _ = require('lodash'),
  should = require('should');


var testFilter = function (preFetchStructure) {

  var localEnabledStr = preFetchStructure ? ' + LocalStorage' : '';


  describe('Filter getData()' + localEnabledStr, function () {
    it('undefined streamIds is considered as null', function (done) {
      var settings =  {streams : ['test'], state: 'all', modifiedSince: 1};
      var filter = new pryv.Filter(settings);

      filter.streamsIds = undefined;
      filter.getData().hasOwnProperty('streams').should.equal(false);
      done();
    });
  });

  describe('Filter ' + localEnabledStr, function () {

    it('Create a new filter with settings', function (done) {
      var settings =  {streams : ['test'], state: 'all', modifiedSince: 1};
      var filter = new pryv.Filter(settings);

      should.exists(filter);
      filter.streamsIds[0].should.equal(settings.streams[0]);
      _.keys(filter.getData(true)).length.should.equal(3);
      _.keys(filter.getData(true, {toTime : 20})).length.should.equal(4);
      filter.timeFrameST = [0, 1];
      filter.getData().fromTime.should.equal(0);
      filter.getData().toTime.should.equal(1);


      done();
    });

    it('Compare two filters', function (done) {
      var filter1 = new pryv.Filter();
      filter1.timeFrameST = [0, 1];
      filter1.streamsIds = ['a', 'b', 'c'];

      var filter2 = new pryv.Filter();
      filter2.timeFrameST = [0, 1];
      filter2.streamsIds = ['a', 'b', 'c'];

      // -- timeframe
      var comparison1 = filter1.compareToFilterData(filter2.getData());
      comparison1.timeFrame.should.equal(0);
      comparison1.streams.should.equal(0);

      filter2.timeFrameST = [0, null];
      filter2.streamsIds = ['a', 'b', 'c', 'd'];
      var comparison2 = filter1.compareToFilterData(filter2.getData());
      comparison2.timeFrame.should.equal(-1);
      comparison2.streams.should.equal(-1);

      filter2.timeFrameST = [0, 2];  // <-- last change of f2
      var comparison3 = filter1.compareToFilterData(filter2.getData());
      comparison3.timeFrame.should.equal(-1);

      filter1.timeFrameST = [1, 2];
      filter2.streamsIds = null;
      var comparison4 = filter1.compareToFilterData(filter2.getData());
      comparison4.timeFrame.should.equal(-1);
      comparison4.streams.should.equal(-1);

      filter1.timeFrameST = [null, null];
      filter2.streamsIds = ['a'];
      var comparison5 = filter1.compareToFilterData(filter2.getData());
      comparison5.timeFrame.should.equal(1);
      comparison5.streams.should.equal(1);

      filter2.timeFrameST = [0, 3];
      filter2.streamsIds = [];
      var c = filter1.compareToFilterData(filter2.getData());
      c.timeFrame.should.equal(1);
      c.streams.should.equal(1);


      filter1.streamsIds = null;
      filter2.streamsIds = [];
      c = filter1.compareToFilterData(filter2.getData());
      c.streams.should.equal(1);

      filter1.streamsIds = null;
      filter2.streamsIds = ['a'];
      c = filter1.compareToFilterData(filter2.getData());
      c.streams.should.equal(1);


      filter1.streamsIds = [];
      filter2.streamsIds = null;
      c = filter1.compareToFilterData(filter2.getData());
      c.streams.should.equal(-1);


      done();
    });

  });


  describe('Filter matchEvent ' + localEnabledStr, function () {
    var username = 'test-user',
      auth = 'test-token',
      settings = {
        username: username,
        auth: auth,
        port: 443,
        ssl: true,
        domain: 'test.io'
      },
      connection = new pryv.Connection(settings);



    var filter1 = new pryv.Filter();
    filter1.timeFrameST = [0, 2];
    filter1.streamsIds = ['a', 'b', 'c'];

    var filter2 = new pryv.Filter();
    filter2.timeFrameST = [null, null];
    filter2.streamsIds = null;

    it('Event in filter timeframe', function (done) {
      var event1 = new pryv.Event(connection, {streamId : 'a', time : 1});
      filter1.matchEvent(event1).should.equal(true);
      filter2.matchEvent(event1).should.equal(true);

      var event2 = new pryv.Event(connection, {streamId : 'a', time : 3});
      filter1.matchEvent(event2).should.equal(false);

      done();
    });


    it('Event in filter timeframe', function (done) {
      var event1 = new pryv.Event(connection, {streamId : 'a', time : 1});
      filter1.matchEvent(event1).should.equal(true);
      filter2.matchEvent(event1).should.equal(true);

      var event2 = new pryv.Event(connection, {streamId : 'e', time : 1});
      if (preFetchStructure) {
        filter1.matchEvent(event2).should.equal(false);
      }
      done();
    });


    it('Event in trashed stream', function (done) {
      var settings =  {streams : ['a'], modifiedSince: 1};
      var filter = new pryv.Filter(settings);


      var event1 = new pryv.Event(connection, {streamId : 'a', time : 1, trashed: true});
      filter.matchEvent(event1).should.equal(false);

      filter.set({state: 'all'});
      filter.matchEvent(event1).should.equal(true);

      done();
    });

  });

};


//TODO write test with fetch structure done..
//testFilter(true);
testFilter(false);
