'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const BookSchema = new Schema({
  title: String
})

BookSchema.plugin(mongoosastic, {
  bulk: {
    size: 100,
    delay: 1000
  }
})

const Book = mongoose.model('Book2', BookSchema)

describe('Bulk mode', function () {
  before(function (done) {
    config.deleteIndexIfExists(['book2s'], function () {
      mongoose.connect(config.mongoUrl, function () {
        const client = mongoose.connections[0].db
        client.collection('book2s', function () {
          Book.remove(done)
        })
      })
    })
  })

  before(function (done) {
    async.forEach(config.bookTitlesArray(), function (title, cb) {
      new Book({
        title: title
      }).save(cb)
    }, done)
  })

  before(function (done) {
    Book.findOne({
      title: 'American Gods'
    }, function (err, book) {
      book.remove(done)
    })
  })

  after(function (done) {
    mongoose.disconnect()
    Book.esClient.close()
    done()
  })

  it('should index all objects and support deletions too', function (done) {
    // This timeout is important, as Elasticsearch is "near-realtime" and the index/deletion takes time that
    // needs to be taken into account in these tests
    setTimeout(function () {
      Book.search({
        match_all: {}
      }, function (err, results) {
        results.should.have.property('hits').with.property('total', 52)
        done()
      })
    }, config.BULK_ACTION_TIMEOUT)
  })
})
