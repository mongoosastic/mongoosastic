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

describe('Elasticsearch Connection', function() {

  before(function(done) {
    var esClient = new elasticsearch.Client;

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
            esClient.indices.refresh().then(done.bind(this, null));
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

    DummySchema.plugin(mongoosastic);
    var Dummy = mongoose.model('Dummy2', DummySchema, 'dummys');

    tryDummySearch(Dummy, done);

  });

  it('should be able to connect with explicit options', function(done) {

    DummySchema.plugin(mongoosastic, {
      host: 'localhost',
      port: 9200
    });

    var Dummy = mongoose.model('Dummy3', DummySchema, 'dummys');

    tryDummySearch(Dummy, done);

  });

  it('should be able to connect with an array of hosts', function(done) {

    DummySchema.plugin(mongoosastic, {
      hosts: [
        'localhost:9200',
        'localhost:9200'
      ]
    });
    var Dummy = mongoose.model('Dummy4', DummySchema, 'dummys');

    tryDummySearch(Dummy, done);

  });

  it('should be able to connect with an existing elasticsearch client', function(done) {

    var esClient = new elasticsearch.Client({host: 'localhost:9200'});

    esClient.ping({
      requestTimeout: 1000
    }, function(err) {
      if (err) {
        return done(err);
      }

      DummySchema.plugin(mongoosastic, {
        esClient: esClient
      });
      var Dummy = mongoose.model('Dummy5', DummySchema, 'dummys');

      tryDummySearch(Dummy, done);
    });

  });

});

function tryDummySearch(model, cb) {
  model.esClient.indices.refresh().then(function(){
    model.search({
      query_string: {
        query: 'Text1'
      }
    }, function(err, results) {
      if(err) return cb(err);

      results.hits.total.should.eql(0);
      model.esClient.close();
      cb(err);
    });
  })
}
