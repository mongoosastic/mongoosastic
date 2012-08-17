var elastical = require('elastical')
  , generator = new(require('./mapping-generator'))
  , serialize = require('./serialize')
  , events    = require('events');

module.exports = function elasticSearchPlugin(schema, options){
  var indexedFields = getIndexedFields(schema)
    , indexName = options && options.index
    , typeName  = options && options.type
    , alwaysHydrate = options && options.hydrate
    , _mapping = null
    , host = options && options.host ? options.host : 'localhost'
    , port = options && options.port ? options.port : 9200
    , esClient  = new elastical.Client(host,{port:port});

  schema.post('remove', function(){
    var model = this;
    setIndexNameIfUnset(model.constructor.modelName);
    deleteByMongoId(esClient, model, indexName, typeName, 3);
  });
  
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
   * Create the mapping. Takes a callback that will be called once 
   * the mapping is created
   */
  schema.statics.createMapping = function(cb){
    setIndexNameIfUnset(this.modelName);
    createMappingIfNotPresent(esClient, indexName, typeName, schema, cb);
  };
  /**
   * Save in elastic search on save. 
   */
  schema.post('save', function(){
    var model = this;
    model.index(function(err, res){
      model.emit('es-indexed', err, res);
    });
  });
  
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
    esClient.index(index || indexName, type || typeName, serialize(model, indexedFields), {id:model._id.toString()}, cb);
  }
  /**
   * Synchronize an existing collection
   *
   * @param callback - callback when synchronization is complete
   */
  schema.statics.synchronize = function(){
    var model = this
      , em = new events.EventEmitter();

    setIndexNameIfUnset(model.modelName);
    var stream = model.find().stream();

    stream.on('data', function(doc){
      var self = this;
      self.pause();
      doc.save(function(){
        doc.on('es-indexed', function(err, doc){
          if(err){
            em.emit('error', err);
          }else{
            em.emit('data', null, doc);
          }
          self.resume();
        });
      });
    });
    stream.on('close', function(a, b){
      em.emit('close', a, b);
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
          hydrate(results, model, cb);
        }else{
          cb(null, res);
        }
      }
    });
  };
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
function hydrate(results, model, cb){
  var resultsMap = {}
  var ids = results.hits.map(function(a, i){
    resultsMap[a._id] = i
    return a._id;
  });
  model.find({_id:{$in:ids}}, function(err, docs){
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
function getIndexedFields(schema){
  var indexedFields = [];
  for(var k in schema.tree){
    if(schema.tree[k].es_indexed){
      indexedFields.push(k);
    }
  }
  return indexedFields;
}
function deleteByMongoId(client, model,indexName, typeName, tries){
    client.delete(indexName, typeName, model._id.toString(), function(err, res){
      if(err && err.message.indexOf('404') > -1){
        setTimeout(function(){
          if(tries <= 0){
            // future issue.. what do we do!?
          }else{
            deleteByMongoId(client, model, indexName, typeName, tries--);
          }
        }, 500);
      }else{
       model.emit('es-removed', err, res);
      }
    });
}
