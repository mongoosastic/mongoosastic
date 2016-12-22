'use strict'

const mongoose = require('mongoose')
const elasticsearch = require('elasticsearch')
const esClient = new elasticsearch.Client({
  deadTimeout: 0,
  keepAlive: false
})
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const TweetSchema = new Schema({
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

TweetSchema.plugin(mongoosastic)

const BlogPost = mongoose.model('BlogPost', TweetSchema)

describe('Add Boost Option Per Field', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      BlogPost.remove(function () {
        config.deleteIndexIfExists(['blogposts'], done)
      })
    })
  })

  after(function (done) {
    mongoose.disconnect()
    BlogPost.esClient.close()
    esClient.close()
    done()
  })

  it('should create a mapping with boost field added', function (done) {
    BlogPost.createMapping(function () {
      esClient.indices.getMapping({
        index: 'blogposts',
        type: 'blogpost'
      }, function (err, mapping) {
        /* elasticsearch 1.0 & 0.9 support */
        const props = mapping.blogpost !== undefined
          ? mapping.blogpost.properties /* ES 0.9.11 */
          : mapping.blogposts.mappings.blogpost.properties
        /* ES 1.0.0 */

        props.title.type.should.eql('string')
        props.title.boost.should.eql(2.0)
        done()
      })
    })
  })
})
