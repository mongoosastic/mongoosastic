var elasticsearch = require('elasticsearch')
  , generator     = new(require('./mapping-generator'))
  , serialize     = require('./serialize')
  , events        = require('events')
  , nop           = require('nop')

module.exports = function Mongoosastic(schema, options){
  var mapping = getMapping(schema)
    , indexName = options && options.index
    , typeName  = options && options.type
    , alwaysHydrate = options && options.hydrate
    , defaultHydrateOptions = options && options.hydrateOptions
    , _mapping = null
    , host = options && options.host ? options.host : 'localhost'
    , port = options && options.port ? options.port : 9200
    , esClient  = new elasticsearch.Client({host: {host: host, port: port}})
    , bulk = options && options.bulk
    , bulkBuffer = []
    , bulkTimeout

  setUpMiddlewareHooks(schema)
    
  /**
  * ElasticSearch Client
  */
  schema.statics.esClient = esClient

  /**
   * Create the mapping. Takes an optionnal settings parameter and a callback that will be called once
   * the mapping is created

   * @param settings Object (optional)
   * @param callback Function
   */
  schema.statics.createMapping = function(settings, cb) {
    if(arguments.length < 2) {
        cb = arguments[0] || nop
        settings = undefined
    }

    setIndexNameIfUnset(this.modelName)

    createMappingIfNotPresent({
      client: esClient,
      indexName: indexName,
      typeName: typeName,
      schema: schema,
      settings: settings
    }, cb)
  }

  /**
   * @param options  Object (optional)
   * @param callback Function
   */
  schema.methods.index = function(options, cb){
    if (arguments.length < 2) {
      cb = arguments[0] || nop
      options = {}
    }

    setIndexNameIfUnset(this.constructor.modelName)

    var index = options.index || indexName
      , type = options.type || typeName

    if(bulk) {
      bulkIndex({
        index: index,
        type: type,
        model: this
      })
      setImmediate(cb)
    } else {
      esClient.index({
        index: index,
        type: type,
        id: this._id.toString(),
        body: serialize(this, mapping)
      }, cb)
    }
  }

  /**
  * Unset elastic search index
  * @param options - (optional) options for unIndex
  * @param callback - callback when unIndex is complete
  */
  schema.methods.unIndex = function(options, cb){
    if (arguments.length < 2) {
      cb = arguments[0] || nop
      options = {}
    }

    setIndexNameIfUnset(this.constructor.modelName)

    options.index  = options.index || indexName
    options.type   = options.type  || typeName
    options.model  = this
    options.client = esClient
    options.tries  = 3

    if(bulk)
      bulkDelete(options, cb)
    else
      deleteByMongoId(options, cb)
  }

  /**
   * Delete all documents from a type/index
   * @param options - (optional) specify index/type
   * @param callback - callback when truncation is complete
   */
  schema.statics.esTruncate = function(options, cb) {
    if (arguments.length < 2) {
      cb = arguments[0] || nop
      options = {}
    }

    var index = options.index || indexName
      , type  = options.type  || typeName

    esClient.deleteByQuery({
      index: index,
      type: type,
      body: {
        query: {
          match_all: {}
        }
      }
    }, cb)
  }

  /**
   * Synchronize an existing collection
   *
   * @param query - query for documents you want to synchronize
   */
  schema.statics.synchronize = function(query){
    var em = new events.EventEmitter()
      , readyToClose
      , closeValues = []
      , counter = 0
      , close = function(){em.emit.apply(em, ['close'].concat(closeValues))}

    //Set indexing to be bulk when synchronizing to make synchronizing faster
    bulk = bulk || {
      delay: 1000,
      size: 1000
    }

    query = query || {}

    setIndexNameIfUnset(this.modelName)

    var stream = this.find(query).stream()

    stream.on('data', function(doc){
      counter++
      doc.save(function(err){
        if (err)
          return em.emit('error', err)

        doc.on('es-indexed', function(err, doc){
          counter--
          if(err){
            em.emit('error', err)
          }else{
            em.emit('data', null, doc)
          }
        })
      })
    })

    stream.on('close', function(a, b){
      closeValues = [a, b]
      var closeInterval = setInterval(function() {
        if (counter === 0 && bulkBuffer.length === 0) {
          clearInterval(closeInterval)
          close()
        }
      }, 1000)
    })

    stream.on('error', function(err){
      em.emit('error', err)
    })

    return em
  }
  /**
   * ElasticSearch search function
   *
   * @param query - query object to perform search with
   * @param options - (optional) special search options, such as hydrate
   * @param callback - callback called with search results
   */
  schema.statics.search = function(query, options, cb){
    if (arguments.length === 2) {
      cb = arguments[1]
      options = {}
    }

    var model = this
      , esQuery = {
        body: {query: query},
        index: options.index || indexName,
        type:  options.type  || typeName
      }

    Object.keys(options).forEach(function(opt) {
      if (!opt.match(/hydrate/) && options.hasOwnProperty(opt))
        esQuery[opt] = options[opt]
    })

    setIndexNameIfUnset(model.modelName)

    esClient.search(esQuery, function(err, res){
      if(err){
        cb(err)
      } else {
        if (alwaysHydrate || options.hydrate)
          hydrate(res, model, options.hydrateOptions || defaultHydrateOptions || {}, cb)
        else
          cb(null, res)
      }
    })
  }

  function bulkDelete(options, cb) {
    bulkAdd({
      delete: {
        _index: options.index || indexName, 
        _type: options.type || typeName, 
        _id: options.model._id.toString()
      }
    })
    cb()
  }

  function bulkIndex(options) {
    bulkAdd({
      index: {
        _index: options.index || indexName, 
        _type: options.type || typeName, 
        _id: options.model._id.toString()
      }
    })
    bulkAdd(options.model)
  }

  function clearBulkTimeout() {
    clearTimeout(bulkTimeout)
    bulkTimeout = undefined
  }

  function bulkAdd(instruction) {
    bulkBuffer.push(instruction)

    //Return because we need the doc being indexed
    //Before we start inserting
    if (instruction.index && instruction.index._index)
      return

    if(bulkBuffer.length >= (bulk.size || 1000)) {
      schema.statics.flush()
      clearBulkTimeout()
    } else if (bulkTimeout === undefined){
      bulkTimeout = setTimeout(function(){
        schema.statics.flush()
        clearBulkTimeout()
      }, bulk.delay || 1000)
    }
  }

  schema.statics.flush = function(cb){
    cb = cb || function(err) { if (err) console.log(err) }

    esClient.bulk({
      body: bulkBuffer
    }, function(err) {
      cb(err)
    })
    bulkBuffer = []
  }

  schema.statics.refresh = function(options, cb){
    if (arguments.length < 2) {
      cb = arguments[0] || nop
      options = {}
    }

    setIndexNameIfUnset(this.modelName)
    esClient.indices.refresh({
      index: options.index || indexName
    }, cb)
  }

  function setIndexNameIfUnset(model){
    var modelName = model.toLowerCase()
    if(!indexName){
      indexName = modelName + "s"
    }
    if(!typeName){
      typeName = modelName
    }
  }


  /**
   * Use standard Mongoose Middleware hooks
   * to persist to Elasticsearch
   */
  function setUpMiddlewareHooks(schema) {
    schema.post('remove', function(){
      setIndexNameIfUnset(this.constructor.modelName)

      var options = {
        index: indexName,
        type: typeName,
        tries: 3,
        model: this,
        client: esClient
      }

      if(bulk) {
        bulkDelete(options, nop)
      } else {
        deleteByMongoId(options, nop)
      }
    })

    /**
     * Save in elastic search on save.
     */
    schema.post('save', function(){
      var model = this

      model.index(function(err, res){
        model.emit('es-indexed', err, res)
      })
    })
  }

}

function createMappingIfNotPresent(options, cb) {
  var client    = options.client
    , indexName = options.indexName
    , typeName  = options.typeName
    , schema    = options.schema
    , settings  = options.settings

  generator.generateMapping(schema, function(err, mapping) {
    var completeMapping = {}
    completeMapping[typeName] = mapping
    client.indices.exists({index: indexName}, function(err, exists) {
      if (err)
        return cb(err)

      if (exists) {
        client.indices.putMapping({
          index: indexName,
          type: typeName,
          body: completeMapping
        }, cb)
      } else {
        client.indices.create({index: indexName}, function(err) {
          if (err)
            return cb(err)

          client.indices.putMapping({
            index: indexName,
            type: typeName,
            body: completeMapping
          }, cb)
        })
      }
    })
  })
}

function hydrate(res, model, options, cb){
  var results = res.hits
    , resultsMap = {}
    , ids = results.hits.map(function(a, i){
      resultsMap[a._id] = i
      return a._id
    })
    , query = model.find({_id:{$in:ids}})

  // Build Mongoose query based on hydrate options
  // Example: {lean: true, sort: '-name', select: 'address name'}
  Object.keys(options).forEach(function(option){
    query[option](options[option])
  })

  query.exec(function(err, docs){
    if(err) {
      return cb(err)
    } else {
      var hits = []

      docs.forEach(function(doc) {
        var i = resultsMap[doc._id]
        hits[i] = doc
      })
      results.hits = hits
      res.hits = results
      cb(null, res)
    }
  })
}

function getMapping(schema){
  var retMapping = {}
  generator.generateMapping(schema, function(err, mapping){
    retMapping = mapping
  })
  return retMapping
}

function deleteByMongoId(options, cb){
  var index = options.index
    , type = options.type
    , client = options.client
    , model = options.model
    , tries = options.tries

  client.delete({
    index: index,
    type: type,
    id: model._id.toString()
  }, function(err, res){
    if(err && err.message.indexOf('404') > -1){
      setTimeout(function(){
        if(tries <= 0) {
          return cb(err)
        } else {
          options.tries = --tries
          deleteByMongoId(options, cb)
        }
      }, 500)
    }else{
     model.emit('es-removed', err, res)
     cb(err)
    }
  })
}
