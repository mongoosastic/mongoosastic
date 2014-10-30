var mongoose = require('mongoose'),
  should = require('should'),
  config = require('./config'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  async = require('async'),
  mongoosastic = require('../lib/mongoosastic');

var DummySchema = new Schema({
  text: String
});
DummySchema.plugin(mongoosastic);

var Dummy = mongoose.model('Dummy', DummySchema);

describe('Truncate', function() {
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
            }),
          ];
          async.forEach(dummies, function(item, cb) {
            item.save(cb);
          }, function() {
            setTimeout(done, config.indexingTimeout);
          });
        });
      });
    });
  });
  after(function(done) {
    Dummy.remove(done);
  });
  describe('truncate', function() {
    it('should be able to truncate all documents', function(done) {
      Dummy.esTruncate(function(err) {
        Dummy.search({
          query_string: {
            query: 'Text1'
          }
        }, function(err, results) {
          results.hits.total.should.eql(0);
          done(err);
        });
      });
    });
  });
});
