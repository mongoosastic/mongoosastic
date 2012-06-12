var esClient  = new(require('elastical').Client);

module.exports = function elasticSearchPlugin(schema, options){
  var indexedFields = getIndexedFields(schema)
    , indexName = options && options.index
    , typeName  = options && options.type
    
  schema.post('save', function(){
    var model = this;
    if(!indexName){
      indexName = model.constructor.modelName.toLowerCase() + "s";
    }
    if(!typeName){
      typeName = model.constructor.modelName.toLowerCase();
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
        if(options.hydrate){
          hydrate(results, model, cb);
        }else{
          getResults(results, model, cb);
        }
      }
    });
  };
}

function getResults(results, model, cb){
  results.hits = results.hits.map(function(hit){
    var model = hit._source;
    return model;
  });
  cb(null, results);
}
function hydrate(results, model, cb){
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
