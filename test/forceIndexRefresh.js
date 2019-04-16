'use strict'

const mongoose = require('mongoose')
const config = require('./config')
const esClient = config.getClient()
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')
const indexName = 'es-test'
const DummySchema = new Schema({
  text: String
})
DummySchema.plugin(mongoosastic, {
  esClient: esClient,
  index: indexName
})
const Dummy = mongoose.model('Dummy', DummySchema)

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
          Dummy.remove(function (err) {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    // disconnect mongodb
    mongoose.disconnect()
    // disconnect elasticsearch
    config.close()
    done()
  })

  it('should always suceed: refresh the index immediately on insert', function (done) {
    DummySchema.plugin(mongoosastic, {
      esClient: esClient,
      index: indexName,
      forceIndexRefresh: true
    })
    const Dummy3 = mongoose.model('Dummy', DummySchema)
    const d = new Dummy3({text: 'Text1'})

    doInsertOperation(Dummy3, d, indexName, done)
  })

  it('should fail randomly: refresh the index every 1s on insert', function (done) {
    DummySchema.plugin(mongoosastic, {
      esClient: esClient,
      index: indexName,
      forceIndexRefresh: false
    })
    const Dummy2 = mongoose.model('Dummy', DummySchema)
    const d = new Dummy2({text: 'Text1'})

    doInsertOperation(Dummy2, d, indexName, done)
  })

  it('should always suceed: refresh the index immediately on update', function (done) {
    DummySchema.plugin(mongoosastic, {
      esClient: esClient,
      index: indexName,
      forceIndexRefresh: true
    })
    const Dummy3 = mongoose.model('Dummy', DummySchema)
    const d = new Dummy3({text: 'Text1'})

    doUpdateOperation(Dummy3, d, 'this is the new text', indexName, done)
  })

  it('should fail randomly: refresh the index every 1s on update', function (done) {
    DummySchema.plugin(mongoosastic, {
      esClient: esClient,
      index: indexName,
      forceIndexRefresh: false
    })
    const Dummy2 = mongoose.model('Dummy', DummySchema)
    const d = new Dummy2({text: 'Text1'})

    doUpdateOperation(Dummy2, d, 'this is the new text', indexName, done)
  })
})

function doInsertOperation (Model, object, indexName, callback) {
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
        term: {_id: savedObject._id}
      },
      function (err, results) {
        results.hits.total.should.eql(1)
        // clean the db
        savedObject.remove(function (err) {
          if (err) {
            return callback(err)
          }
          savedObject.on('es-removed', function (err) {
            if (err) {
              return callback(err)
            }
            callback()
          })
        })
      })
    })
  })
}

function doUpdateOperation (Model, object, newText, indexName, callback) {
  // save object
  object.save(function (err, savedObject) {
    if (err) {
      return callback(err)
    }
    // update object
    Model
      .findOneAndUpdate({_id: savedObject._id}, {text: newText}, {'new': true})
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
            term: {_id: savedObject._id.toString()}
          },
          function (err, results) {
            results.hits.total.should.eql(1)
            results.hits.hits[0]._source.text.should.eql(newText)

            // clean the db
            updatedObject.remove(function (err) {
              if (err) {
                return callback(err)
              }
              updatedObject.on('es-removed', function (err) {
                if (err) {
                  return callback(err)
                }
                callback()
              })
            })
          })
        })
      })
  })
}
