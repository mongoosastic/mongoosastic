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
    mongoose.connect(config.mongoUrl, config.mongoOpts, function () {
      BlogPost.deleteMany(function () {
        config.deleteIndexIfExists(['blogposts'], done)
      })
    })
  })

  after(function (done) {
    BlogPost.deleteMany(function () {
      config.deleteIndexIfExists(['blogposts'], function () {
        mongoose.disconnect()
        BlogPost.esClient.close()
        esClient.close()
        done()
      })
    })
  })

  it('should create a mapping with boost field added', function (done) {
    BlogPost.createMapping(function () {
      esClient.indices.getMapping({
        index: 'blogposts'
      }, function (err, mapping) {
        const props = mapping.blogposts.mappings.properties

        props.title.type.should.eql('text')
        props.title.boost.should.eql(2.0)
        done()
      })
    })
  })
})
