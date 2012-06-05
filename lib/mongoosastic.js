var esClient  = new(require('elastical').Client)


module.exports = function elasticSearchPlugin(schema, options){
  var indexedFields = getIndexedFields(schema);

  schema.post('save', function(){
    var model = this;

    esClient.index(options.index, options.type, serialize(model, indexedFields), function(err, res){
      model.emit('es-indexed', err, res);
    })
  });

  schema.statics.search = function(query, options, cb){
    if(typeof options != 'object'){
      cb = options
      options = {}
    }

    esClient.search(query, function(err, results, res){
      if(err){
        cb(err)
      }else{
        results.hits = results.hits.map(function(hit){
          return hit._source;
        });
        cb(null, results)
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
