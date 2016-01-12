var mongoose = require('mongoose'),
  async = require('async'),
  elasticsearch = require('elasticsearch'),
  config = require('./config'),
  Schema = mongoose.Schema,
  mongoosastic = require('../lib/mongoosastic');

var DummySchema = new Schema({
  text: String
});

var Dummy = mongoose.model('Dummy1', DummySchema, 'dummys');

function tryDummySearch(model, cb) {
  setTimeout(function() {
    model.search({
      simple_query_string: {
        query: 'Text1'
      }
    }, {
      index: '_all'
    }, function(err, results) {
      if (err) {
        return cb(err);
      }

      results.hits.total.should.eql(0);
      model.esClient.close();
      cb(err);
    });
  }, config.INDEXING_TIMEOUT);

}

describe('Elasticsearch Connection', function() {

  before(function(done) {

    mongoose.connect(config.mongoUrl, function() {
      Dummy.remove(function() {
        config.deleteIndexIfExists(['dummys'], function() {
          var dummies = [
            new Dummy({
              text: 'Text1'
            }),
            new Dummy({
              text: 'Text2'
            })
          ];
          async.forEach(dummies, function(item, cb) {
            item.save(cb);
          }, function() {
            setTimeout(done, config.INDEXING_TIMEOUT);
          });
        });
      });
    });
  });

  after(function(done) {
    Dummy.remove();
    mongoose.disconnect();
    done();
  });

  it('should be able to connect with default options', function(done) {
    var Dummy2;

    DummySchema.plugin(mongoosastic);
    Dummy2 = mongoose.model('Dummy2', DummySchema, 'dummys');

    tryDummySearch(Dummy2, done);

  });

  it('should be able to connect with explicit options', function(done) {
    var Dummy3;

    DummySchema.plugin(mongoosastic, {
      host: 'localhost',
      port: 9200
    });

    Dummy3 = mongoose.model('Dummy3', DummySchema, 'dummys');

    tryDummySearch(Dummy3, done);

  });

  it('should be able to connect with an array of hosts', function(done) {
    var Dummy4;

    DummySchema.plugin(mongoosastic, {
      hosts: [
        'localhost:9200',
        'localhost:9200'
      ]
    });

    Dummy4 = mongoose.model('Dummy4', DummySchema, 'dummys');

    tryDummySearch(Dummy4, done);

  });

  it('should be able to connect with an existing elasticsearch client', function(done) {

    var esClient = new elasticsearch.Client({
      host: 'localhost:9200'
    });

    esClient.ping({
      requestTimeout: 1000
    }, function(err) {
      var Dummy5;

      if (err) {
        return done(err);
      }

      DummySchema.plugin(mongoosastic, {
        esClient: esClient
      });

      Dummy5 = mongoose.model('Dummy5', DummySchema, 'dummys');

      tryDummySearch(Dummy5, done);
    });

  });

});
