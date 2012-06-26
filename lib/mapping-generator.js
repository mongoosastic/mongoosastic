function Generator(){
}

Generator.prototype.generateMapping = function(schema, cb){
  var mapping = {}
  for (var field in schema.tree){
    var value = schema.tree[field]
      , def = schema.paths[field];
    if(def){
      mapping[field] = {type:def.instance?def.instance.toLowerCase():'object'}
      if(mapping[field].type =='objectid'){
        mapping[field].type = 'string';
        continue;
      }
    }
    for(var prop in value){
      if(prop.indexOf('es_') == 0 && prop != 'es_indexed'){
        mapping[field][prop.replace(/^es_/, '')] = value[prop];
      }
    }
    
  }
  delete mapping._id;
  cb(null, {properties:mapping});
}

module.exports = Generator;
