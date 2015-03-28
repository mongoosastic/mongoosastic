var mongoose = require('mongoose'),
  async = require('async'),
  config = require('./config'),
  Schema = mongoose.Schema,
  mongoosastic = require('../lib/mongoosastic');

var BondSchema = new Schema({
  name: String,
  type: {type: String, default: 'Other Bond'},
  price: Number
});

BondSchema.plugin(mongoosastic);

var Bond = mongoose.model('Bond', BondSchema);

describe('Query DSL', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      Bond.remove(function() {
        config.deleteIndexIfExists(['bonds'], function() {
          var bonds = [
            new Bond({name: 'Bail', type: 'A', price: 10000}),
            new Bond({name: 'Commercial', type: 'B', price: 15000}),
            new Bond({name: 'Construction', type: 'B', price: 20000}),
            new Bond({name: 'Legal', type: 'C', price: 30000})
          ];
          async.forEach(bonds, config.saveAndWaitIndex, function() {
            setTimeout(done, config.indexingTimeout);
          });
        });
      });
    });
  });

  after(function(done) {
    Bond.remove();
    Bond.esClient.close();
    mongoose.disconnect();
    done();
  });

  describe('range', function() {
    it('should be able to find within range', function(done) {
      Bond.search({
        range: {
          price: {
            from: 20000,
            to: 30000
          }
        }
      }, function(err, res) {
        res.hits.total.should.eql(2);
        res.hits.hits.forEach(function(bond) {
          ['Legal', 'Construction'].should.containEql(bond._source.name);
        });

        done();
      });
    });
  });
});
