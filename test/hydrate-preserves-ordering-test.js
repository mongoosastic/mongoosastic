var mongoose = require('mongoose'),
    async = require('async'),
    config = require('./config'),
    Schema = mongoose.Schema,
    rankModel,
    mongoosastic = require('../lib/mongoosastic');

var rankSchema = new Schema({
  title: String,
  rank: Number
});

rankSchema.plugin(mongoosastic);

rankModel = mongoose.model('rank', rankSchema);

describe('Hydrate with ES data', function() {

  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      rankModel.remove(function() {
        config.deleteIndexIfExists(['ranks'], function() {

          // Quotes are from Terry Pratchett's Discworld books
          var esResultTexts = [
            new rankModel({
              title: 'The colour of magic',
              rank: 2
            }),
            new rankModel({
              title: 'The Light Fantastic',
              rank: 4
            }),
            new rankModel({
              title: 'Equal Rites',
              rank: 0
            }),
            new rankModel({
              title: 'MorzartEstLà',
              rank: -10.4
            })
          ];
          async.forEach(esResultTexts, config.saveAndWaitIndex, function() {
            setTimeout(done, config.INDEXING_TIMEOUT);
          });
        });
      });
    });
  });

  after(function(done) {
    rankModel.remove();
    rankModel.esClient.close();
    mongoose.disconnect();
    done();
  });

  describe('Preserve ordering from MongoDB on hydration', function() {
    it('should return an array of objects ordered \'desc\' by MongoDB', function(done) {

      rankModel.esSearch({}, {
        hydrate: true,
        hydrateOptions: {sort: '-rank'}
      }, function (err, res) {
        if (err) done(err);

        res.hits.total.should.eql(4);
        res.hits.hits[0].rank.should.eql(4);
        res.hits.hits[1].rank.should.eql(2);
        res.hits.hits[2].rank.should.eql(0);
        res.hits.hits[3].rank.should.eql(-10.4);

        done();
      });
    });

  });

  describe('Preserve ordering from MongoDB on hydration', function() {
    it('should return an array of objects ordered \'asc\' by MongoDB', function(done) {

      rankModel.esSearch({}, {
        hydrate: true,
        hydrateOptions: {sort: 'rank'}
      }, function (err, res) {
        if (err) done(err);

        res.hits.total.should.eql(4);
        res.hits.hits[0].rank.should.eql(-10.4);
        res.hits.hits[1].rank.should.eql(0);
        res.hits.hits[2].rank.should.eql(2);
        res.hits.hits[3].rank.should.eql(4);

        done();
      });
    });

  });

  describe('Preserve ordering from ElasticSearch on hydration', function() {
      it('should return an array of objects ordered \'desc\' by ES', function (done) {

          rankModel.esSearch({
              sort: [{
                  rank: {
                      order: 'desc'
                  }
              }]
          }, {
              hydrate: true,
              hydrateOptions: {sort: undefined}
          }, function (err, res) {
              if (err) done(err);
              res.hits.total.should.eql(4);
              res.hits.hits[0].rank.should.eql(4);
              res.hits.hits[1].rank.should.eql(2);
              res.hits.hits[2].rank.should.eql(0);
              res.hits.hits[3].rank.should.eql(-10.4);

              done();
          });
      });
  });

  describe('Preserve ordering from ElasticSearch on hydration', function() {
    it('should return an array of objects ordered \'asc\' by ES', function(done) {

      rankModel.esSearch({
        sort: [{
            rank: {
              order: 'asc'
          }
        }]
      }, {
        hydrate: true,
        hydrateOptions: {sort: undefined}
      }, function (err, res) {
        if (err) done(err);
        res.hits.total.should.eql(4);
        res.hits.hits[0].rank.should.eql(-10.4);
        res.hits.hits[1].rank.should.eql(0);
        res.hits.hits[2].rank.should.eql(2);
        res.hits.hits[3].rank.should.eql(4);

        done();
      });
    });
  });

});
