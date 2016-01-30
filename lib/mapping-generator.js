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

  if (paths[field] && paths[field].options.type === Boolean) {
    return 'boolean';
  }

  if (paths[field]) {
    type = paths[field].instance ? paths[field].instance.toLowerCase() : 'object';
  }

  return type;
}

//
// Generates the mapping
//
// Can be called recursively.
//
// @param cleanTree
// @param inPrefix
// @return the mapping
//
function getMapping(cleanTree, inPrefix) {
  var mapping = {},
    value, field, prop,
    implicitFields = [],
    hasEsIndex = false,
    prefix = inPrefix !== '' ? inPrefix + '.' : inPrefix;

  for (field in cleanTree) {
    if (!cleanTree.hasOwnProperty(field)) {
      continue;
    }
    value = cleanTree[field];
    mapping[field] = {};
    mapping[field].type = value.type;

    // Check if field was explicity indexed, if not keep track implicitly
    if (value.es_indexed) {
      hasEsIndex = true;
    } else if (value.type) {
      implicitFields.push(field);
    }

    // If there is no type, then it's an object with subfields.
    if (typeof value === 'object' && !value.type) {
      mapping[field].type = 'object';
      mapping[field].properties = getMapping(value, prefix + field);
    }

    // If it is a objectid make it a string.
    if (value.type === 'objectid') {
      if (value.ref && value.es_schema) {
        mapping[field].type = 'object';
        mapping[field].properties = getMapping(value, prefix + field);
        continue;
      }
      // do not continue here so we can handle other es_ options
      mapping[field].type = 'string';
    }

    // If indexing a number, and no es_type specified, default to double
    if (value.type === 'number' && value.es_type === undefined) {
      mapping[field].type = 'double';
      continue;
    }

    // Else, it has a type and we want to map that!
    for (prop in value) {
      // Map to field if it's an Elasticsearch option
      if (value.hasOwnProperty(prop) && prop.indexOf('es_') === 0 && prop !== 'es_indexed') {
        mapping[field][prop.replace(/^es_/, '')] = value[prop];
      }
    }

    // if type is never mapped, delete mapping
    if (mapping[field].type === undefined) {
      delete mapping[field];
    }
  }

  // If one of the fields was explicitly indexed, delete all implicit fields
  if (hasEsIndex) {
    implicitFields.forEach(function checkImplicit(implicitField) {
      delete mapping[implicitField];
    });
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
function getCleanTree(tree, paths, inPrefix) {

  var cleanTree = {},
    type = '',
    value = {},
    field,
    prop,
    treeNode,
    subTree,
    key,
    geoFound = false,
    prefix = inPrefix !== '' ? inPrefix + '.' : inPrefix;

  for (field in tree) {
    if (prefix === '' && (field === 'id' || field === '_id')) {
      continue;
    }

    type = getTypeFromPaths(paths, prefix + field);
    value = tree[field];

    if (value.es_indexed === false) {
      continue;
    }

    // Field has some kind of type
    if (type) {
      // If it is an nested schema
      if (value[0]) {
        // A nested array can contain complex objects
        nestedSchema(paths, field, cleanTree, value, prefix); // eslint-disable-line no-use-before-define
      } else if (value.type && Array.isArray(value.type)) {
        // An object with a nested array
        nestedSchema(paths, field, cleanTree, value, prefix); // eslint-disable-line no-use-before-define
        // Merge top level es settings
        for (prop in value) {
          // Map to field if it's an Elasticsearch option
          if (value.hasOwnProperty(prop) && prop.indexOf('es_') === 0 && prop !== 'es_indexed') {
            cleanTree[field][prop] = value[prop];
          }
        }
      } else if (paths[field] && paths[field].options.es_schema && paths[field].options.es_schema.tree && paths[field].options.es_schema.paths) {
        subTree = paths[field].options.es_schema.tree;
        if (paths[field].options.es_select) {
          for (treeNode in subTree) {
            if (!subTree.hasOwnProperty(treeNode)) { continue; }
            if (paths[field].options.es_select.split(' ').indexOf(treeNode) === -1) {
              delete subTree[treeNode];
            }
          }
        }
        cleanTree[field] = getCleanTree(subTree, paths[field].options.es_schema.paths, '');
      } else if (value === String || value === Object || value === Date || value === Number || value === Boolean || value === Array) {
        cleanTree[field] = {};
        cleanTree[field].type = type;
      } else {
        cleanTree[field] = {};
        for (key in value) {
          if (value.hasOwnProperty(key)) {
            cleanTree[field][key] = value[key];
          }
        }
        cleanTree[field].type = type;
      }

      // It has no type for some reason
    } else {
      // Because it is an geo_* object!!
      if (typeof value === 'object') {
        for (key in value) {
          if (value.hasOwnProperty(key) && /^geo_/.test(key)) {
            cleanTree[field] = value[key];
            geoFound = true;
          }
        }

        if (geoFound) {
          continue;
        }
      }

      // If it's a virtual type, don't map it
      if (typeof value === 'object' && value.getters && value.setters && value.options) {
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
// Define a nested schema
//
// @param paths
// @param field
// @param cleanTree
// @param value
// @param prefix
// @return cleanTree modified
//
function nestedSchema(paths, field, cleanTree, value, prefix) {
  // A nested array can contain complex objects
  if (paths[prefix + field] && paths[prefix + field].schema && paths[prefix + field].schema.tree && paths[prefix + field].schema.paths) {
    cleanTree[field] = getCleanTree(paths[prefix + field].schema.tree, paths[prefix + field].schema.paths, '');
  } else if (paths[prefix + field] && paths[prefix + field].caster && paths[prefix + field].caster.instance) {
    // Even for simple types the value can be an object if there is other attributes than type
    if (typeof value[0] === 'object') {
      cleanTree[field] = value[0];
    } else {
      cleanTree[field] = {};
    }

    cleanTree[field].type = paths[prefix + field].caster.instance.toLowerCase();
  } else if (!paths[field] && prefix) {
    if (paths[prefix + field] && paths[prefix + field].caster && paths[prefix + field].caster.instance) {
      cleanTree[field] = {
        type: paths[prefix + field].caster.instance.toLowerCase()
      };
    }
  } else {
    cleanTree[field] = {
      type: 'object'
    };
  }
}

function Generator() {}

Generator.prototype.generateMapping = function generateMapping(schema, cb) {
  var cleanTree = getCleanTree(schema.tree, schema.paths, ''),
    mapping;
  delete cleanTree[schema.get('versionKey')];
  mapping = getMapping(cleanTree, '');
  cb(null, {
    properties: mapping
  });
};

module.exports = Generator;
