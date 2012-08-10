function Generator(){
}

Generator.prototype.generateMapping = function(schema, cb){
  var cleanTree = getCleanTree(schema.tree, schema.paths, ''),
      mapping = getMapping(cleanTree, '');

  cb(null, { properties: mapping });
};

module.exports = Generator;



//
// Generates the mapping
//
// Can be called recursively.
//
// @param cleanTree
// @param prefix
// @return the mapping
//
function getMapping(cleanTree, prefix) {
  var mapping = {},
      value = {};

  if (prefix !== '') {
    prefix = prefix + '.';
  }

  for (var field in cleanTree) {
    value = cleanTree[field];
    mapping[field] = {};
    mapping[field].type = value.type;

    // If there is no type, then it's an object with subfields.
    if (!value.type) {
      mapping[field].type = 'object';
      mapping[field].properties = getMapping(value, prefix + field);
      continue;
    }

    // If it is a objectid make it a string.
    if(value.type === 'objectid'){
      mapping[field].type = 'string';
      continue;
    }

    // Else, it has a type and we want to map that!
    for (var prop in value) {
      // Map to field if it's an Elasticsearch option
      if (prop.indexOf('es_') === 0 && prop !== 'es_indexed') {
        mapping[field][prop.replace(/^es_/, '')] = value[prop];
      }
    }
  }

  return mapping;
}


//
// Generates a clean tree
//
// Can be called recursively.
//
// @param tree
// @param paths
// @param prefix
// @return the tree
//
function getCleanTree(tree, paths, prefix) {
  var cleanTree = {},
      type = '',
      value = {};

  delete tree.id;
  delete tree._id;

  if (prefix !== '') {
    prefix = prefix + '.';
  }

  for (var field in tree){
    type = getTypeFromPaths(paths, prefix + field);
    value = tree[field];

    // Field has some kind of type
    if (type) {
      // If it is an nestec schema
      if (value[0]) {
        //A nested schema can be just a blank object with no defined paths
        if(value[0].tree && value[0].paths){
          cleanTree[field] = getCleanTree(value[0].tree, value[0].paths, '');
        }else{
          cleanTree[field] = {
            type:'object'
          };
        }
      } else {
        cleanTree[field] = value;
        cleanTree[field].type = type;
      }

    // It has no type for some reason
    } else {
      // Because it is an geo_point object!!
      if (typeof value === 'object' && value.geo_point) {
        cleanTree[field] = value.geo_point;
        continue;
      }

      // Because it is some other object!! Or we assumed that it is one.
      if (typeof value === 'object') {
        cleanTree[field] = getCleanTree(value, paths, prefix + field);
      }
    }
  }

  return cleanTree;
}



//
// Get type from the mongoose schema
//
// Returns the type, so in case none is set, it's the mongoose type.
//
// @param paths
// @param field
// @return the type or false
//
function getTypeFromPaths(paths, field) {
  var type = false;

  if (paths[field] && paths[field].options.type === Date) {
    return 'date';
  }

  if (paths[field]) {
    type = paths[field].instance ? paths[field].instance.toLowerCase() : 'object';
  }

  return type;
}
