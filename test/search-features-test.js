var mongoose = require('mongoose'),
  async = require('async'),
  config = require('./config'),
  Schema = mongoose.Schema,
  Bond,
  mongoosastic = require('../lib/mongoosastic');

var BondSchema = new Schema({
  name: String,
  type: {
    type: String,
    default: 'Other Bond'
  },
  price: Number
});


BondSchema.plugin(mongoosastic);

Bond = mongoose.model('Bond', BondSchema);

describe('Query DSL', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      Bond.remove(function() {
        config.deleteIndexIfExists(['bonds'], function() {
          var bonds = [
            new Bond({
              name: 'Bail',
              type: 'A',
              price: 10000
            }),
            new Bond({
              name: 'Commercial',
              type: 'B',
              price: 15000
            }),
            new Bond({
              name: 'Construction',
              type: 'B',
              price: 20000
            }),
            new Bond({
              name: 'Legal',
              type: 'C',
              price: 30000
            })
          ];
          async.forEach(bonds, config.saveAndWaitIndex, function() {
            setTimeout(done, config.INDEXING_TIMEOUT);
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

  describe('Sort', function() {

    var getNames = function(res) {
      return res._source.name;
    };
    var expectedDesc = ['Legal', 'Construction', 'Commercial', 'Bail'];
    var expectedAsc = expectedDesc.concat([]).reverse(); // clone and reverse

    describe('Simple sort', function() {

      it('should be able to return all data, sorted by name ascending', function(done) {
        Bond.search({
          match_all: {}
        }, {
          sort: 'name:asc'
        }, function(err, res) {
          res.hits.total.should.eql(4);
          expectedAsc.should.eql(res.hits.hits.map(getNames));

          done();
        });
      });

      it('should be able to return all data, sorted by name descending', function(done) {
        Bond.search({
          match_all: {}
        }, {
          sort: ['name:desc']
        }, function(err, res) {
          res.hits.total.should.eql(4);
          expectedDesc.should.eql(res.hits.hits.map(getNames));

          done();
        });
      });
    });

    describe('Complex sort', function() {

      it('should be able to return all data, sorted by name ascending', function(done) {
        Bond.search({
          match_all: {}
        }, {
          sort: {
            name: {
              order: 'asc'
            }
          }
        }, function(err, res) {
          res.hits.total.should.eql(4);
          expectedAsc.should.eql(res.hits.hits.map(getNames));

          done();
        });
      });

      it('should be able to return all data, sorted by name descending', function(done) {
        Bond.search({
          match_all: {}
        }, {
          sort: {
            name: {
              order: 'desc'
            },
            type: {
              order: 'asc'
            }
          }
        }, function(err, res) {
          res.hits.total.should.eql(4);
          expectedDesc.should.eql(res.hits.hits.map(getNames));

          done();
        });
      });
    });

  });

  describe('Aggregations', function() {

    describe('Simple aggregation', function() {

      it('should be able to group by term', function(done) {
        Bond.search({
          match_all: {}
        }, {
          aggs: {
            'names': {
              'terms': {
                'field': 'name'
              }
            }
          }
        }, function(err, res) {
          res.aggregations.names.buckets.should.eql([
            {
              doc_count: 1,
              key: 'bail'
            },
            {
              doc_count: 1,
              key: 'commercial'
            },
            {
              doc_count: 1,
              key: 'construction'
            },
            {
              doc_count: 1,
              key: 'legal'
            }
          ]);

          done();
        });
      });

    });

  });

  describe('test', function() {

    it('should do a fuzzy query', function(done) {
      var getNames = function(res) {
        return res._source.name;
      };

      Bond.search({
        match: {
          name: {
            query: 'comersial',
            fuzziness: 2
          }
        }
      }, function(err, res) {

        res.hits.total.should.eql(1);
        ['Commercial'].should.eql(res.hits.hits.map(getNames));
        done();
      });

    });

  });

});
