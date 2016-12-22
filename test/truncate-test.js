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

const Dummy = mongoose.model('Dummy', DummySchema)

describe('Truncate', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      Dummy.remove(function () {
        config.deleteIndexIfExists(['dummys'], function () {
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
    Dummy.remove()
    Dummy.esClient.close()
    mongoose.disconnect()
    done()
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
