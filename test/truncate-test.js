'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const DummySchema = new Schema({
  text: String
})

DummySchema.plugin(mongoosastic)

const Dummy = mongoose.model('DummyTruncate', DummySchema)

describe('Truncate', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, config.mongoOpts, function () {
      Dummy.deleteMany(function () {
        config.deleteIndexIfExists(['dummytruncates'], function () {
          const dummies = [
            new Dummy({
              text: 'Text1'
            }),
            new Dummy({
              text: 'Text2'
            })
          ]
          async.forEach(dummies, function (item, cb) {
            item.save(cb)
          }, function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    Dummy.deleteMany(function () {
      config.deleteIndexIfExists(['dummytruncates'], function () {
        Dummy.esClient.close()
        mongoose.disconnect()
        done()
      })
    })
  })

  describe('esTruncate', function () {
    it('should be able to truncate all documents', function (done) {
      Dummy.esTruncate(function () {
        setTimeout(function esTruncateNextTick () {
          Dummy.search({
            query_string: {
              query: 'Text1'
            }
          }, function (err, results) {
            results.hits.total.should.eql(0)
            done(err)
          })
        }, config.INDEXING_TIMEOUT)
      })
    })
  })
})
