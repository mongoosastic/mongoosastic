'use strict'

const elasticsearch = require('elasticsearch')
const esClient = new elasticsearch.Client({
  host: 'localhost:9200',
  deadTimeout: 0,
  keepAlive: false
})
const async = require('async')

const INDEXING_TIMEOUT = process.env.INDEXING_TIMEOUT || 2000
const BULK_ACTION_TIMEOUT = process.env.BULK_ACTION_TIMEOUT || 4000

function deleteIndexIfExists (indexes, done) {
  async.forEach(indexes, function (index, cb) {
    esClient.indices.exists({
      index: index
    }, function (err, exists) {
      if (exists) {
        esClient.indices.delete({
          index: index
        }, cb)
      } else {
        cb()
      }
    })
  }, done)
}

function createModelAndEnsureIndex (Model, obj, cb) {
  const dude = new Model(obj)
  dude.save(function (err) {
    if (err) return cb(err)

    dude.on('es-indexed', function () {
      setTimeout(function () {
        cb(null, dude)
      }, INDEXING_TIMEOUT)
    })
  })
}

function createModelAndSave (Model, obj, cb) {
  const dude = new Model(obj)
  dude.save(cb)
}

function saveAndWaitIndex (model, cb) {
  model.save(function (err) {
    if (err) cb(err)
    else {
      model.once('es-indexed', cb)
      model.once('es-filtered', cb)
    }
  })
}

function bookTitlesArray () {
  const books = [
    'American Gods',
    'Gods of the Old World',
    'American Gothic'
  ]
  let idx
  for (idx = 0; idx < 50; idx++) {
    books.push('ABABABA' + idx)
  }
  return books
}

module.exports = {
  mongoUrl: 'mongodb://localhost/es-test',
  INDEXING_TIMEOUT: INDEXING_TIMEOUT,
  BULK_ACTION_TIMEOUT: BULK_ACTION_TIMEOUT,
  deleteIndexIfExists: deleteIndexIfExists,
  createModelAndEnsureIndex: createModelAndEnsureIndex,
  createModelAndSave: createModelAndSave,
  saveAndWaitIndex: saveAndWaitIndex,
  bookTitlesArray: bookTitlesArray,
  getClient: function () {
    return esClient
  },
  close: function () {
    esClient.close()
  }
}
