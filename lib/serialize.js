module.exports = serialize;

function _serializeObject(object, mapping) {
  var serialized = {};
  for (var field in mapping.properties) {
    var val = serialize(object[field], mapping.properties[field]);
    if (val !== undefined) {
      serialized[field] = val;
    }
  }
  return serialized;
}

function serialize(model, mapping) {
  if (mapping.properties && model) {
    if (Array.isArray(model)) {
      return model.map(function(object) {
        return _serializeObject(object, mapping);
      });
    } else {
      return _serializeObject(model, mapping);
    }
  } else if (typeof value === 'object' && value !== null) {
    var name = value.constructor.name;
    if (name === 'ObjectID') {
      return value.toString();
    } else if (name === 'Date') {
      return new Date(value).toJSON();
    }
  } else {
    return model;
  }
}