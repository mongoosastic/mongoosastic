'use strict'

const mongoose = require('mongoose')
const should = require('should')
const elasticsearch = require('elasticsearch')
const config = require('./config')
const esClient = config.getClient();
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')
const indexName = "es-test"
const DummySchema = new Schema({
  text: String
})
DummySchema.plugin(mongoosastic, {
  esClient: esClient,
  index: indexName
});
const Dummy = mongoose.model('Dummy', DummySchema)

describe('forceIndexRefresh connection option', function () {
  before(function (done) {
    // connect to mongodb
    mongoose.connect(config.mongoUrl, function () {
      // delete the index from elasticsearch
      config.deleteIndexIfExists([indexName], function (err) {
        // recreate the index
        Dummy.createMapping({
        "analysis" : {
          "analyzer":{
            "content":{
            "type":"custom",
            "tokenizer":"whitespace"
            }
          }
        }
      }, function(err, mapping) {
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
  
  it('should refresh the index immediately (forceIndexRefresh: true)', function (done) {
    DummySchema.plugin(mongoosastic, {
      esClient: esClient,
      index: indexName,
      forceIndexRefresh: true
    });
    const Dummy3 = mongoose.model('Dummy', DummySchema)
    const d = new Dummy3({text: 'Text1'})

    doOperation(Dummy3, d, indexName, 1, done)
  })

  it('should not refresh the index immediately (forceIndexRefresh: false)', function (done) {
    DummySchema.plugin(mongoosastic, {
      esClient: esClient,
      index: indexName,
      forceIndexRefresh: false
    });
    const Dummy2 = mongoose.model('Dummy', DummySchema)
    const d = new Dummy2({text: 'Text1'})

    doOperation(Dummy2, d, indexName, 0, done)
  })
})

function doOperation(Model, object, indexName, resultNumber, callback) {
  // save object
  object.save(function(err, savedObject) {
    if(err) {
      return callback(err)
    }
    // wait for indexing
    savedObject.on('es-indexed', function(err){
      if (err) {
        return callback(err)
      }
      // look for the object just saved
      Model.search({
        term: {_id: savedObject._id}
      },
      function (err, results) {
        results.hits.total.should.eql(resultNumber)
        // clean the db
        savedObject.remove(function(err) {
          if (err) {
            return callback(err)
          }
          savedObject.on('es-removed', function(err) {
            if (err) {
              return callback(err)
            }
            setTimeout(callback, config.INDEXING_TIMEOUT);
          })
        })
      })
    })
  })
}