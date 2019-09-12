'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema
const config = require('./config')
const mongoosastic = require('../lib/mongoosastic')

const TaskSchema = new Schema({
  content: String
})
TaskSchema.plugin(mongoosastic, {
  routing: function (doc) {
    return doc.content
  }
})

const Task = mongoose.model('Task', TaskSchema)

describe('Routing', function () {
  let res

  before(function * () {
    yield (done) => mongoose.connect(config.mongoUrl, config.mongoOpts, done)
    yield (done) => config.deleteIndexIfExists(['tasks'], done)
    yield (done) => Task.deleteMany({}, done)
  })

  after(function * () {
    yield (done) => Task.deleteMany({}, done)
    yield (done) => mongoose.disconnect(done)
    yield (done) => config.deleteIndexIfExists(['tasks'], done)
    Task.esClient.close()
  })

  it('should found task if no routing', function * () {
    const task = yield Task.create({ content: Date.now() })
    yield (done) => setTimeout(done, config.INDEXING_TIMEOUT)

    res = yield (done) => Task.search({
      query_string: {
        query: task.content
      }
    }, done)

    res.hits.total.should.eql(1)
    res._shards.total.should.above(1)

    yield task.remove()
  })

  it('should found task if routing with task.content', function * () {
    const now = Date.now()
    const task = yield Task.create({ content: now })
    yield (done) => setTimeout(done, config.INDEXING_TIMEOUT)

    res = yield (done) => Task.search({
      query_string: {
        query: task.content
      }
    }, {
      routing: task.content
    }, done)

    res.hits.total.should.eql(1)
    res._shards.total.should.eql(1)

    yield task.remove()
  })

  it('should not found task if routing with invalid routing', function * () {
    const now = Date.now()
    const task = yield Task.create({ content: now })
    yield (done) => setTimeout(done, config.INDEXING_TIMEOUT)

    res = yield (done) => Task.search({
      query_string: {
        query: task.content
      }
    }, {
      routing: `${now + 1}`
    }, done)

    res.hits.total.should.eql(0)
    res._shards.total.should.eql(1)

    yield task.remove()
  })

  it('should not found task after remove', function * () {
    const task = yield Task.create({ content: Date.now() })
    yield task.remove()
    yield (done) => setTimeout(done, config.INDEXING_TIMEOUT)

    res = yield (done) => Task.search({
      query_string: {
        query: task.content
      }
    }, done)

    res.hits.total.should.eql(0)
    res._shards.total.should.above(1)
  })

  it('should not found task after unIndex', function * () {
    const task = yield Task.create({ content: Date.now() })
    yield (done) => task.unIndex(done)
    yield (done) => setTimeout(done, config.INDEXING_TIMEOUT)

    res = yield (done) => Task.search({
      query_string: {
        query: task.content
      }
    }, done)

    res.hits.total.should.eql(0)
    res._shards.total.should.above(1)

    yield task.remove()
  })

  it('should not found task after esTruncate', function * () {
    const task = yield Task.create({ content: Date.now() })
    yield (done) => setTimeout(done, config.INDEXING_TIMEOUT)
    yield (done) => Task.esTruncate(done)
    yield (done) => setTimeout(done, config.INDEXING_TIMEOUT)

    res = yield (done) => Task.search({
      query_string: {
        query: task.content
      }
    }, done)

    res.hits.total.should.eql(0)
    res._shards.total.should.above(1)

    yield task.remove()
  })
})
