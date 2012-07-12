function Generator(){
}

Generator.prototype.generateMapping = function(schema, cb){
  var tree = schema.tree,
      paths = schema.paths,
      mapping = getMapping(tree, paths, '');

  cb(null, {properties:mapping});
};

module.exports = Generator;



//
// Generates the mapping
//
// Can be called recursively.
//
// @param tree
// @param paths
// @param fieldPrefix
// @return the mapping
//
function getMapping(tree, paths, fieldPrefix) {
  var mapping = {};

  for (var field in tree){
    var value = tree[field],
        def = paths[fieldPrefix + field];

    // If field exists on this dimension.
    if(def){
      mapping[field] = {type:def.instance?def.instance.toLowerCase():'object'};
      if(mapping[field].type === 'objectid'){
        mapping[field].type = 'string';
        continue;
      }
      // If it is a subSchema then call that
      if (mapping[field].type === 'object' && def.schema){
        mapping[field].properties = getMapping(def.schema.tree, def.schema.paths, '');
      }
    }

    for(var prop in value){
      // Map to field if it's an Elasticsearch option
      if(prop.indexOf('es_') === 0 && prop !== 'es_indexed'){
        mapping[field][prop.replace(/^es_/, '')] = value[prop];
      }

      // Create mapping for the subfield if this is one.
      var tmpFieldPrefix = fieldPrefix + field + '.';
      if (paths[tmpFieldPrefix + prop]) {
        mapping[field] = { properties : {} };
        mapping[field].properties = getMapping(value, paths, tmpFieldPrefix);
      }
    }
  }

  delete mapping._id;
  return mapping;
}
