/* global describe, it */

var Pryv = require('../../source/main'),
  _ = require('underscore'),
  should = require('should');

describe('Filter', function () {

  it('Create a new filter with settings', function (done) {
    var settings =  {streams : ['test'], state: 'all', modifiedSince: 1};
    var filter = new Pryv.Filter(settings);

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
    var filter1 = new Pryv.Filter();
    filter1.timeFrameST = [0, 1];
    filter1.streamsIds = ['a', 'b', 'c'];

    var filter2 = new Pryv.Filter();
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


describe('Filter matchEvent', function () {
  var username = 'test-user',
    auth = 'test-token',
    settings = {
      port: 443,
      ssl: true,
      domain: 'test.io'
    },
    connection = new Pryv.Connection(username, auth, settings);



  var filter1 = new Pryv.Filter();
  filter1.timeFrameST = [0, 2];
  filter1.streamsIds = ['a', 'b', 'c'];

  var filter2 = new Pryv.Filter();
  filter2.timeFrameST = [null, null];
  filter2.streamsIds = null;

  it('Event in filter timeframe', function (done) {
    var event1 = new Pryv.Event(connection, {streamId : 'a', time : 1});
    filter1.matchEvent(event1).should.equal(1);
    filter2.matchEvent(event1).should.equal(1);

    var event2 = new Pryv.Event(connection, {streamId : 'a', time : 3});
    filter1.matchEvent(event2).should.equal(0);

    done();
  });


  it('Event in filter timeframe', function (done) {
    var event1 = new Pryv.Event(connection, {streamId : 'a', time : 1});
    filter1.matchEvent(event1).should.equal(1);
    filter2.matchEvent(event1).should.equal(1);

    var event2 = new Pryv.Event(connection, {streamId : 'e', time : 1});
    filter1.matchEvent(event2).should.equal(0);

    done();
  });

});

