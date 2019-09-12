'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema
const config = require('./config')
const mongoosastic = require('../lib/mongoosastic')

const RefreshSchema = new Schema({
  title: String
})

RefreshSchema.plugin(mongoosastic)

const Refresh = mongoose.model('Refresh', RefreshSchema)

describe('Refresh', function () {
  before(function * () {
    yield (done) => config.deleteIndexIfExists(['refreshs'], done)
    yield (done) => mongoose.connect(config.mongoUrl, config.mongoOpts, done)
    yield (done) => Refresh.deleteMany({}, done)
  })

  after(function * () {
    yield (done) => Refresh.deleteMany({}, done)
    yield (done) => mongoose.disconnect(done)
    yield (done) => config.deleteIndexIfExists(['refreshs'], done)
  })

  it('should flushed after refresh', function * () {
    yield (done) => Refresh.createMapping(done)
    const refresh = new Refresh({ title: `${Date.now()}` })
    yield (done) => config.saveAndWaitIndex(refresh, done)
    yield (done) => Refresh.refresh(done)

    const results = yield (done) => Refresh.search({
      match_all: {}
    }, done)
    results.hits.total.should.eql(1)
  })
})
