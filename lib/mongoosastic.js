var esClient  = new(require('elastical').Client);


module.exports = function elasticSearchPlugin(schema, options){
  var indexedFields = getIndexedFields(schema)
    , indexName = options && options.index
    , typeName  = options && options.type
    , alwaysHydrate = options && options.hydrate;
  
  schema.post('remove', function(){
    deleteByMongoId(esClient, this, indexName,typeName, 3);
  });

  schema.post('save', function(){
    var model = this
      , modelName = model.constructor.modelName.toLowerCase();
    if(!indexName){
      indexName = modelName + "s";
    }
    if(!typeName){
      typeName = modelName;
    }
    esClient.index(indexName, typeName, serialize(model, indexedFields), function(err, res){
      model.emit('es-indexed', err, res);
    });
  });

  schema.statics.search = function(query, options, cb){
    var model = this;

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
}

var actions = {
  mapResults: function(results, model, cb){
    results.hits = results.hits.map(function(hit){
      return hit._source;
    });
    cb(null, results);
  }, 
  hydrate: function(results, model, cb){
    var ids = results.hits.map(function(a){
      return a._source._mongoId
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
  
  serializedForm._mongoId = model._id.toString()
  delete serializedForm._id
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
  var search = {
    query:{
      term:{_mongoId:model._id.toString()}
    }
  };
  client.search(search, function(err, res){
    if(res.total == 0){
      if(tries >= 0){
        setTimeout(function(){
          deleteByMongoId(client, model, indexName, typeName, --tries);
        }, 800);
      }else{
        throw new Error("Unable to delete object with _mongoId of " + model._id + " from index");
      }
    }else{
      client.delete(indexName, typeName, res.hits[0]._id, function(err, res){
        model.emit('es-removed', err, res);
      });
    }
  });
}
