'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const rankSchema = new Schema({
  title: String,
  rank: Number
})

rankSchema.plugin(mongoosastic)

const RankModel = mongoose.model('rank', rankSchema)

describe('Hydrate with ES data', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      RankModel.remove(function () {
        config.deleteIndexIfExists(['ranks'], function () {
          // Quotes are from Terry Pratchett's Discworld books
          const esResultTexts = [
            new RankModel({
              title: 'The colour of magic',
              rank: 2
            }),
            new RankModel({
              title: 'The Light Fantastic',
              rank: 4
            }),
            new RankModel({
              title: 'Equal Rites',
              rank: 0
            }),
            new RankModel({
              title: 'MorzartEstLà',
              rank: -10.4
            })
          ]
          async.forEach(esResultTexts, config.saveAndWaitIndex, function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    RankModel.remove()
    RankModel.esClient.close()
    mongoose.disconnect()
    done()
  })

  describe('Preserve ordering from MongoDB on hydration', function () {
    it('should return an array of objects ordered \'desc\' by MongoDB', function (done) {
      RankModel.esSearch({}, {
        hydrate: true,
        hydrateOptions: {sort: '-rank'}
      }, function (err, res) {
        if (err) done(err)

        res.hits.total.should.eql(4)
        res.hits.hits[0].rank.should.eql(4)
        res.hits.hits[1].rank.should.eql(2)
        res.hits.hits[2].rank.should.eql(0)
        res.hits.hits[3].rank.should.eql(-10.4)

        done()
      })
    })
  })

  describe('Preserve ordering from MongoDB on hydration', function () {
    it('should return an array of objects ordered \'asc\' by MongoDB', function (done) {
      RankModel.esSearch({}, {
        hydrate: true,
        hydrateOptions: {sort: 'rank'}
      }, function (err, res) {
        if (err) done(err)

        res.hits.total.should.eql(4)
        res.hits.hits[0].rank.should.eql(-10.4)
        res.hits.hits[1].rank.should.eql(0)
        res.hits.hits[2].rank.should.eql(2)
        res.hits.hits[3].rank.should.eql(4)

        done()
      })
    })
  })

  describe('Preserve ordering from ElasticSearch on hydration', function () {
    it('should return an array of objects ordered \'desc\' by ES', function (done) {
      RankModel.esSearch({
        sort: [{
          rank: {
            order: 'desc'
          }
        }]
      }, {
        hydrate: true,
        hydrateOptions: {sort: undefined}
      }, function (err, res) {
        if (err) done(err)
        res.hits.total.should.eql(4)
        res.hits.hits[0].rank.should.eql(4)
        res.hits.hits[1].rank.should.eql(2)
        res.hits.hits[2].rank.should.eql(0)
        res.hits.hits[3].rank.should.eql(-10.4)

        done()
      })
    })
  })

  describe('Preserve ordering from ElasticSearch on hydration', function () {
    it('should return an array of objects ordered \'asc\' by ES', function (done) {
      RankModel.esSearch({
        sort: [{
          rank: {
            order: 'asc'
          }
        }]
      }, {
        hydrate: true,
        hydrateOptions: {sort: undefined}
      }, function (err, res) {
        if (err) done(err)
        res.hits.total.should.eql(4)
        res.hits.hits[0].rank.should.eql(-10.4)
        res.hits.hits[1].rank.should.eql(0)
        res.hits.hits[2].rank.should.eql(2)
        res.hits.hits[3].rank.should.eql(4)

        done()
      })
    })
  })
})
