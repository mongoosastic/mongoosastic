var esClient  = new(require('elastical').Client)
  , generator = new(require('./mapping-generator'));

module.exports = function elasticSearchPlugin(schema, options){
  var indexedFields = getIndexedFields(schema)
    , indexName = options && options.index
    , typeName  = options && options.type
    , alwaysHydrate = options && options.hydrate
    , _mapping = null;

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
   * Save in elastic search on save. 
   */
  schema.post('save', function(){
    var model = this;
    setIndexNameIfUnset(model.constructor.modelName);
    createMappingIfNotPresent(_mapping, indexName, typeName, schema, function(){
      _mapping = true;
      esClient.index(indexName, typeName, serialize(model, indexedFields), {id:model._id.toString()}, function(err, res){
        model.emit('es-indexed', err, res);
      });
    });
  });

  /**
   * Synchronize an existing collection
   *
   * @param callback - callback when synchronization is complete
   */
  schema.statics.synchronize = function(cb){
    var model = this
      , count = 0;
    setIndexNameIfUnset(model.modelName);
    var stream = model.find().stream();

    stream.on('data', function(doc){
      var self = this;
      self.pause();
      doc.save(function(){
        count++;
        self.resume();
      });
    });
    stream.on('close', function(){
      cb(null, count);
    });
    stream.on('error', cb);
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

function createMappingIfNotPresent(_mapping, indexName, typeName, schema, cb){
  if(!_mapping){
    // get the mapping, if it doesnt exist, create it!
    esClient.getMapping(indexName, typeName, function(err, mapping){
      if(404 == mapping.status){
        generator.generateMapping(schema, function(err, mapping){
          var completeMapping = {};
          completeMapping[typeName] = mapping;
          esClient.createIndex(indexName, {mappings:completeMapping},cb);
        });
      }else{
        _mapping = mapping;
      }
    });
  }else{
    cb()
  }
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
