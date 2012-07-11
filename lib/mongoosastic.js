var elastical = require('elastical')
  , generator = new(require('./mapping-generator'))
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
  }
  /**
   * Save in elastic search on save. 
   */
  schema.post('save', function(){
    var model = this;
    setIndexNameIfUnset(model.constructor.modelName);
    esClient.index(indexName, typeName, serialize(model, indexedFields), {id:model._id.toString()}, function(err, res){
      model.emit('es-indexed', err, res);
    });
  });

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
        actions[alwaysHydrate || options.hydrate?'hydrate':'mapResults'](results, model,cb);
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
        client.putMapping(indexName, completeMapping, cb);
      } else {
        client.createIndex(indexName, {mappings:completeMapping}, cb);
      }
    });
  });
}
var actions = {
  mapResults: function(results, model, cb){
    cb(null, results);
  }, 
  hydrate: function(results, model, cb){
    var ids = results.hits.map(function(a){
      return a._id;
    });
    model.find({_id:{$in:ids}}, function(err, docs){
      if(err){
        return cb(err)
      }else{
        results.hits = docs;
        cb(null, results);
      }
    });
  }
}
function serialize(model, indexedFields){
  var serializedForm = {};
    
  if(indexedFields.length > 0){
    indexedFields.forEach(function(field){
      serializedForm[field] = model.get(field);
    });
  }else{
    serializedForm = model.toJSON();
  }
  delete serializedForm._id
  delete serializedForm.id
  return serializedForm;
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
