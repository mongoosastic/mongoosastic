'use strict'

const mongoose = require('mongoose')
const elasticsearch = require('elasticsearch')
const esClient = new elasticsearch.Client()
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

let GeoBoundingBoxSchema
let GeoBoundingBoxModel

describe('Geo Bounding Box Test', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, config.mongoOpts, function () {
      config.deleteIndexIfExists(['geoboundingdocs'], function () {
        GeoBoundingBoxSchema = new Schema({
          text: {
            type: String,
            es_indexed: true
          },
          geo_with_lat_lon: {
            geo_point: {
              type: String,
              es_type: 'geo_point',
              es_indexed: true
            },
            lat: { type: Number },
            lon: { type: Number }
          }
        })

        GeoBoundingBoxSchema.plugin(mongoosastic)
        GeoBoundingBoxModel = mongoose.model('geoboundingdoc', GeoBoundingBoxSchema)

        GeoBoundingBoxModel.createMapping(function (err, mapping) {
          GeoBoundingBoxModel.deleteMany(function () {
            esClient.indices.getMapping({
              index: 'geoboundingdocs'
            }, function (err, mapping) {
              done()
            //   (mapping.geodoc !== undefined
            //     ? mapping.geodoc /* ES 0.9.11 */
            //     : mapping.geodocs.mappings
            //   ).properties.frame.type.should.eql('geo_point')
            //   done()
            })
          })
        })
      })
    })
  })

  after(function (done) {
    config.deleteIndexIfExists(['geoboundingdocs'], function () {
      GeoBoundingBoxModel.deleteMany(function () {
        GeoBoundingBoxModel.esClient.close()
        mongoose.disconnect()
        esClient.close()
        done()
      })
    })
  })

  it('should be able to create and store geo coordinates', function (done) {
    const geo = new GeoBoundingBoxModel({
      text: '1',
      geo_with_lat_lon: {
        lat: 41.12,
        lon: -71.34
      }
    })

    const geo2 = new GeoBoundingBoxModel({
      text: '2',
      geo_with_lat_lon: {
        lat: 40.12,
        lon: -71.34
      }
    })

    const geo3 = new GeoBoundingBoxModel({
      text: '3',
      geo_with_lat_lon: {
        lat: 41,
        lon: -73
      }
    })

    config.saveAndWaitIndex(geo, function (err) {
      if (err) {
        throw err
      }

      config.saveAndWaitIndex(geo2, function (err2) {
        if (err2) {
          throw err2
        }

        config.saveAndWaitIndex(geo3, function (err3) {
          if (err3) {
            throw err3
          }
          // Mongodb request
          GeoBoundingBoxModel.find({}, function (err3, res) {
            if (err3) throw err3
            res.length.should.eql(3)
            done()
          })
        })
      })
    })
  })

  it('should be able to find geo coordinates in the indexes', function (done) {
    setTimeout(function () {
      // ES request
      GeoBoundingBoxModel.search({
        match_all: {}
      }, function (err, res) {
        if (err) throw err
        res.hits.total.should.eql(3)
        done()
      })
    }, config.INDEXING_TIMEOUT)
  })

  it('should be able to resync geo coordinates from the database', function (done) {
    config.deleteIndexIfExists(['geodocs'], function () {
      GeoBoundingBoxModel.createMapping(function () {
        const stream = GeoBoundingBoxModel.synchronize()
        let count = 0

        stream.on('data', function () {
          count++
        })

        stream.on('close', function () {
          count.should.eql(3)

          setTimeout(function () {
            GeoBoundingBoxModel.search({
              match_all: {}
            }, function (err, res) {
              if (err) throw err
              res.hits.total.should.eql(3)
              done()
            })
          }, config.INDEXING_TIMEOUT)
        })
      })
    })
  })

  it('should be able to search bounding box', function (done) {
    const geoQuery = {
      bool: {
        must: {
          match_all: {}
        },
        filter: {
          geo_bounding_box: {
            geo_with_lat_lon: {
              top_left: {
                lat: 42,
                lon: -72
              },
              bottom_right: {
                lat: 40,
                lon: -74
              }
            }
          }
        }
      }
    }

    setTimeout(function () {
      GeoBoundingBoxModel.search(geoQuery, function (err1, res1) {
        if (err1) throw err1
        res1.hits.total.should.eql(2)
        res1.hits.hits.length.should.eql(2)
        done()
      })
    }, config.INDEXING_TIMEOUT)
  })
})
