module.exports = function serialize(model, mapping) {
  var name, outModel;

  function _serializeObject(object, mappingData) {
    var serialized = {},
      field, val;
    for (field in mappingData.properties) {
      if (mappingData.properties.hasOwnProperty(field)) {
        val = serialize.call(object, object[field], mappingData.properties[field]);
        if (val !== undefined) {
          serialized[field] = val;
        }
      }
    }
    return serialized;
  }

  if (mapping.properties && model) {

    if (Array.isArray(model)) {
      return model.map(object => _serializeObject(object, mapping));
    }

    return _serializeObject(model, mapping);

  }

  if (mapping.cast && typeof mapping.cast !== 'function') {
    throw new Error('es_cast must be a function');
  }

  outModel = mapping.cast ? mapping.cast.call(this, model) : model;
  if (typeof outModel === 'object' && outModel !== null) {
    name = outModel.constructor.name;
    if (name === 'ObjectID') {
      return outModel.toString();
    }

    if (name === 'Date') {
      return new Date(outModel).toJSON();
    }

  }

  return outModel;

};
