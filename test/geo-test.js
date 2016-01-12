var mongoose = require('mongoose'),
  elasticsearch = require('elasticsearch'),
  esClient = new elasticsearch.Client(),
  config = require('./config'),
  Schema = mongoose.Schema,
  mongoosastic = require('../lib/mongoosastic');

var GeoSchema;
var GeoModel;

describe('GeoTest', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      config.deleteIndexIfExists(['geodocs'], function() {

        GeoSchema = new Schema({
          myId: Number,
          frame: {
            coordinates: [],
            type: {
              type: String
            },
            geo_shape: {
              type: String,
              es_type: 'geo_shape',
              es_tree: 'quadtree',
              es_precision: '1km'
            }
          }
        });

        GeoSchema.plugin(mongoosastic);
        GeoModel = mongoose.model('geodoc', GeoSchema);

        GeoModel.createMapping(function() {
          GeoModel.remove(function() {

            esClient.indices.getMapping({
              index: 'geodocs',
              type: 'geodoc'
            }, function(err, mapping) {
              (mapping.geodoc !== undefined ?
                mapping.geodoc : /* ES 0.9.11 */
                mapping.geodocs.mappings.geodoc /* ES 1.0.0 */
              ).properties.frame.type.should.eql('geo_shape');
              done();
            });
          });
        });

      });
    });
  });

  after(function(done) {
    GeoModel.esClient.close();
    mongoose.disconnect();
    esClient.close();
    done();
  });

  it('should be able to create and store geo coordinates', function(done) {

    var geo = new GeoModel({
      myId: 1,
      frame: {
        type: 'envelope',
        coordinates: [[1, 4], [3, 2]]
      }
    });

    var geo2 = new GeoModel({
      myId: 2,
      frame: {
        type: 'envelope',
        coordinates: [[2, 3], [4, 0]]
      }
    });

    config.saveAndWaitIndex(geo, function(err) {
      if (err) {
        throw err;
      }

      config.saveAndWaitIndex(geo2, function(err2) {
        if (err2) {
          throw err2;
        }

        // Mongodb request
        GeoModel.find({}, function(err3, res) {
          if (err3) throw err3;
          res.length.should.eql(2);
          res[0].frame.type.should.eql('envelope');
          res[0].frame.coordinates[0].should.eql([1, 4]);
          res[0].frame.coordinates[1].should.eql([3, 2]);
          done();
        });
      });
    });

  });

  it('should be able to find geo coordinates in the indexes', function(done) {
    setTimeout(function() {
      // ES request
      GeoModel.search({
        match_all: {}
      }, {
        sort: 'myId:asc'
      }, function(err, res) {
        if (err) throw err;
        res.hits.total.should.eql(2);
        res.hits.hits[0]._source.frame.type.should.eql('envelope');
        res.hits.hits[0]._source.frame.coordinates.should.eql([[1, 4], [3, 2]]);
        done();
      });
    }, config.INDEXING_TIMEOUT);
  });

  it('should be able to resync geo coordinates from the database', function(done) {
    config.deleteIndexIfExists(['geodocs'], function() {
      GeoModel.createMapping(function() {
        var stream = GeoModel.synchronize(),
          count = 0;

        stream.on('data', function() {
          count++;
        });

        stream.on('close', function() {
          count.should.eql(2);

          setTimeout(function() {
            GeoModel.search({
              match_all: {}
            }, {
              sort: 'myId:asc'
            }, function(err, res) {
              if (err) throw err;
              res.hits.total.should.eql(2);
              res.hits.hits[0]._source.frame.type.should.eql('envelope');
              res.hits.hits[0]._source.frame.coordinates.should.eql([[1, 4], [3, 2]]);
              done();
            });
          }, config.INDEXING_TIMEOUT);
        });
      });
    });
  });

  it('should be able to search points inside frames', function(done) {
    var geoQuery = {
      filtered: {
        query: {
          match_all: {}
        },
        filter: {
          geo_shape: {
            frame: {
              shape: {
                type: 'point',
                coordinates: [3, 1]
              }
            }
          }
        }
      }
    };

    setTimeout(function() {
      GeoModel.search(geoQuery, function(err1, res1) {
        if (err1) throw err1;
        res1.hits.total.should.eql(1);
        res1.hits.hits[0]._source.myId.should.eql(2);
        geoQuery.filtered.filter.geo_shape.frame.shape.coordinates = [1.5, 2.5];
        GeoModel.search(geoQuery, function(err2, res2) {
          if (err2) throw err2;
          res2.hits.total.should.eql(1);
          res2.hits.hits[0]._source.myId.should.eql(1);

          geoQuery.filtered.filter.geo_shape.frame.shape.coordinates = [3, 2];
          GeoModel.search(geoQuery, function(err3, res3) {
            if (err3) throw err3;
            res3.hits.total.should.eql(2);

            geoQuery.filtered.filter.geo_shape.frame.shape.coordinates = [0, 3];
            GeoModel.search(geoQuery, function(err4, res4) {
              if (err4) throw err4;
              res4.hits.total.should.eql(0);
              done();
            });
          });
        });
      });
    }, config.INDEXING_TIMEOUT);
  });

});
