var elastical = require('elastical')
  , generator = new(require('./mapping-generator'))
  , serialize = require('./serialize')
  , events    = require('events');

module.exports = function elasticSearchPlugin(schema, options){
  var mapping = getMapping(schema)
    , indexName = options && options.index
    , typeName  = options && options.type
    , alwaysHydrate = options && options.hydrate
    , defaultHydrateOptions = options && options.hydrateOptions
    , _mapping = null
    , host = options && options.host ? options.host : 'localhost'
    , port = options && options.port ? options.port : 9200
    , esClient  = new elastical.Client(host, options)
    , useRiver = options && options.useRiver;

  if (useRiver)
    setUpRiver(schema);
  else
    setUpMiddlewareHooks(schema);

  /**
   * Create the mapping. Takes a callback that will be called once
   * the mapping is created
   */
  schema.statics.createMapping = function(cb){
    setIndexNameIfUnset(this.modelName);
    createMappingIfNotPresent(esClient, indexName, typeName, schema, cb);
  };

  /**
   * @param indexName String (optional)
   * @param typeName String (optional)
   * @param callback Function
   */
  schema.methods.index = function(index, type, cb){
    if(cb == null && typeof index == 'function'){
      cb = index;
      index = null;
    }else if (cb == null && typeof type == 'function'){
      cb = type;
      type = null
    }
    var model = this;
    setIndexNameIfUnset(model.constructor.modelName);
    esClient.index(index || indexName, type || typeName, serialize(model, mapping), {id:model._id.toString()}, cb);
  }

  /**
  * Unset elastic search index
  */
  schema.methods.unIndex = function(){
    var model = this;
    setIndexNameIfUnset(model.constructor.modelName);
    deleteByMongoId(esClient, model, indexName, typeName, 3);
  }
  /**
   * Synchronize an existing collection
   *
   * @param callback - callback when synchronization is complete
   */
  schema.statics.synchronize = function(query){
    var model = this
      , em = new events.EventEmitter()
      , readyToClose
      , closeValues = []
      , counter = 0
      , close = function(){em.emit.apply(em, ['close'].concat(closeValues))}
      ;

    setIndexNameIfUnset(model.modelName);
    var stream = model.find(query).stream();

    stream.on('data', function(doc){
      counter++;
      doc.save(function(){
        doc.on('es-indexed', function(err, doc){
          counter--;
          if(err){
            em.emit('error', err);
          }else{
            em.emit('data', null, doc);
          }
          if (readyToClose && counter === 0)
            close()
        });
      });
    });
    stream.on('close', function(a, b){
      readyToClose = true;
      closeValues = [a, b];
      if (counter === 0)
        close()
    });
    stream.on('error', function(err){
      em.emit('error', err);
    });
    return em;
  };
  /**
   * ElasticSearch search function
   *
   * @param query - query object to perform search with
   * @param options - (optional) special search options, such as hydrate
   * @param callback - callback called with search results
   */
  schema.statics.search = function(query, options, cb){
    var model = this;
    setIndexNameIfUnset(model.modelName);

    if(typeof options != 'object'){
      cb = options;
      options = {};
    }
    query.index = indexName;
    esClient.search(query, function(err, results, res){
      if(err){
        cb(err);
      }else{
        if (alwaysHydrate || options.hydrate) {
          hydrate(results, model, options.hydrateOptions || defaultHydrateOptions || {}, cb);
        }else{
          cb(null, res);
        }
      }
    });
  };

  function setIndexNameIfUnset(model){
    var modelName = model.toLowerCase();
    if(!indexName){
      indexName = modelName + "s";
    }
    if(!typeName){
      typeName = modelName;
    }
  }


  /**
   * Use standard Mongoose Middleware hooks
   * to persist to Elasticsearch
   */
  function setUpMiddlewareHooks(schema) {
    schema.post('remove', function(){
      var model = this;
      setIndexNameIfUnset(model.constructor.modelName);
      deleteByMongoId(esClient, model, indexName, typeName, 3);
    });

    /**
     * Save in elastic search on save.
     */
    schema.post('save', function(){
      var model = this;
      model.index(function(err, res){
        model.emit('es-indexed', err, res);
      });
    });
  }

  /*
   * Experimental MongoDB River functionality
   * NOTICE: Only tested with:
   *    MongoDB V2.4.1
   *    Elasticsearch V0.20.6
   *    elasticsearch-river-mongodb V1.6.5
   *      - https://github.com/richardwilly98/elasticsearch-river-mongodb/
   */
  function setUpRiver(schema) {
    schema.statics.river = function(cb) {
      var model = this;
      setIndexNameIfUnset(model.modelName);
      if (!this.db.name) throw "ERROR: "+ model.modelName +".river() call before mongoose.connect"
      esClient.putRiver(
        'mongodb',
        indexName,
        {
          type: 'mongodb',
          mongodb: {
            db: this.db.name,
            collection: indexName,
            gridfs: (useRiver && useRiver.gridfs) ? useRiver.gridfs : false
          },
          index: {
              name: indexName,
              type: typeName
          }
        }, cb );
    }
  }
};


function createMappingIfNotPresent(client, indexName, typeName, schema, cb){
  generator.generateMapping(schema, function(err, mapping){
    var completeMapping = {};
    completeMapping[typeName] = mapping;
    client.indexExists(indexName, function(err, exists) {
      if (exists) {
        client.putMapping(indexName, typeName, completeMapping, cb);
      } else {
        client.createIndex(indexName, {mappings:completeMapping}, cb);
      }
    });
  });
}
function hydrate(results, model, options, cb){
  var resultsMap = {}
  var ids = results.hits.map(function(a, i){
    resultsMap[a._id] = i
    return a._id;
  });
  var query = model.find({_id:{$in:ids}});

  // Build Mongoose query based on hydrate options
  // Example: {lean: true, sort: '-name', select: 'address name'}
  Object.keys(options).forEach(function(option){
    query[option](options[option]);
  });

  query.exec(function(err, docs){
    if(err){
      return cb(err);
    }else{
      var hits = results.hits

      docs.forEach(function(doc) {
        var i = resultsMap[doc._id]
        hits[i] = doc
      })
      results.hits = hits;
      cb(null, results);
    }
  });
}
function getMapping(schema){
  var retMapping = {};
  generator.generateMapping(schema, function(err, mapping){
    retMapping = mapping;
  });
  return retMapping;
}
function deleteByMongoId(client, model,indexName, typeName, tries){
    client.delete(indexName, typeName, model._id.toString(), function(err, res){
      if(err && err.message.indexOf('404') > -1){
        setTimeout(function(){
          if(tries <= 0){
            // future issue.. what do we do!?
          }else{
            deleteByMongoId(client, model, indexName, typeName, --tries);
          }
        }, 500);
      }else{
       model.emit('es-removed', err, res);
      }
    });
}
