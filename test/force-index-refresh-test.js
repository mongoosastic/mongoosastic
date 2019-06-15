'use strict'

const mongoose = require('mongoose')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')
const indexName = 'es-test'
const DummySchema = new Schema({
  text: String
})
const DummySchemaRefresh = new Schema({
  text: String
})
DummySchema.plugin(mongoosastic, {
  index: indexName,
  type: '_doc'
})
DummySchemaRefresh.plugin(mongoosastic, {
  index: indexName,
  type: '_doc',
  forceIndexRefresh: true
})
const Dummy = mongoose.model('Dummy', DummySchema)
const DummyRefresh = mongoose.model('DummyRefresh', DummySchemaRefresh)

describe('forceIndexRefresh connection option', function () {
  before(function (done) {
    // connect to mongodb
    mongoose.connect(config.mongoUrl, config.mongoOpts, function () {
      // delete the index from elasticsearch
      config.deleteIndexIfExists([indexName], function (err) {
        // recreate the index
        Dummy.createMapping({
          'analysis': {
            'analyzer': {
              'content': {
                'type': 'custom',
                'tokenizer': 'whitespace'
              }
            }
          }
        }, function (err, mapping) {
          // clean mongodb
          config.deleteDocs([Dummy, DummyRefresh], function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    config.deleteIndexIfExists([indexName], function (err) {
      config.deleteDocs([Dummy, DummyRefresh], function () {
        // disconnect mongodb
        mongoose.disconnect()
        // disconnect elasticsearch
        Dummy.esClient.close()
        DummyRefresh.esClient.close()
        done()
      })
    })
  })

  it('should always suceed: refresh the index immediately on insert', function (done) {
    const d = new DummyRefresh({ text: 'Text1' })
    const refresh = true

    doInsertOperation(DummyRefresh, d, indexName, refresh, done)
  })

  it('should fail randomly: refresh the index every 1s on insert', function (done) {
    const d = new Dummy({ text: 'Text1' })
    const refresh = false

    doInsertOperation(Dummy, d, indexName, refresh, done)
  })

  it('should always suceed: refresh the index immediately on update', function (done) {
    const d = new DummyRefresh({ text: 'Text1' })
    const refresh = true

    doUpdateOperation(DummyRefresh, d, 'this is the new text', indexName, refresh, done)
  })

  it('should fail randomly: refresh the index every 1s on update', function (done) {
    const d = new Dummy({ text: 'Text1' })
    const refresh = false

    doUpdateOperation(Dummy, d, 'this is the new text', indexName, refresh, done)
  })
})

function doInsertOperation (Model, object, indexName, refresh, callback) {
  // save object
  object.save(function (err, savedObject) {
    if (err) {
      return callback(err)
    }
    // wait for indexing
    savedObject.on('es-indexed', function (err) {
      if (err) {
        return callback(err)
      }
      // look for the object just saved
      Model.search({
        term: { _id: savedObject._id }
      },
      function (err, results) {
        if (refresh) {
          results.hits.total.should.eql(1)
        } else {
          results.hits.total.should.eql(0)
        }
        callback()
      })
    })
  })
}

function doUpdateOperation (Model, object, newText, indexName, refresh, callback) {
  // save object
  object.save(function (err, savedObject) {
    if (err) {
      return callback(err)
    }
    // update object
    Model
      .findOneAndUpdate({ _id: savedObject._id }, { text: newText }, { 'new': true })
      .exec(function (err, updatedObject) {
        if (err) {
          return callback(err)
        }
        // wait for indexing
        updatedObject.on('es-indexed', function (err) {
          if (err) {
            return callback(err)
          }
          // look for the object just saved
          Model.search({
            term: { _id: savedObject._id.toString() }
          },
          function (err, results) {
            if (refresh) {
              results.hits.total.should.eql(1)
              results.hits.hits[0]._source.text.should.eql(newText)
            } else {
              results.hits.total.should.eql(0)
            }
            callback()
          })
        })
      })
  })
}
