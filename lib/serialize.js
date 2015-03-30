module.exports = serialize;

function _serializeObject(object, mapping) {
  var serialized = {};
  for (var field in mapping.properties) {
    var val = serialize.call(object, object[field], mapping.properties[field]);
    if (val !== undefined) {
      serialized[field] = val;
    }
  }

  return serialized;
}

function serialize(model, mapping) {
  var name;

  if (mapping.properties && model) {

    if (Array.isArray(model)) {
      return model.map(function(object) {
        return _serializeObject(object, mapping);
      });
    }

    return _serializeObject(model, mapping);

  }

  if (mapping.cast && typeof mapping.cast !== 'function') {
    throw new Error('es_cast must be a function');
  }

  model = mapping.cast ? mapping.cast.call(this, model) : model;
  if (typeof model === 'object' && model !== null) {
    name = model.constructor.name;
    if (name === 'ObjectID') {
      return model.toString();
    }

    if (name === 'Date') {
      return new Date(model).toJSON();
    }

  }

  return model;

}
