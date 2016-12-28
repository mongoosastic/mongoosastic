'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const CommentSchema = new Schema({
  user: String,
  post_date: {
    type: Date,
    es_type: 'date'
  },
  message: {
    type: String
  },
  title: {
    type: String,
    es_boost: 2.0
  }
})

CommentSchema.plugin(mongoosastic, {
  bulk: {
    size: 2,
    delay: 100
  }
})

const Comment = mongoose.model('Comment', CommentSchema)

describe('Count', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      Comment.remove(function () {
        config.deleteIndexIfExists(['comments'], function () {
          const comments = [
            new Comment({
              user: 'terry',
              title: 'Ilikecars'
            }),
            new Comment({
              user: 'fred',
              title: 'Ihatefish'
            })
          ]
          async.forEach(comments, function (item, cb) {
            item.save(cb)
          }, function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function () {
    mongoose.disconnect()
    Comment.esClient.close()
  })

  it('should count a type', function (done) {
    Comment.esCount({
      term: {
        user: 'terry'
      }
    }, function (err, results) {
      results.count.should.eql(1)
      done(err)
    })
  })

  it('should count a type without query', function (done) {
    Comment.esCount(function (err, results) {
      results.count.should.eql(2)
      done(err)
    })
  })
})
