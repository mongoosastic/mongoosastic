module.exports = serialize;

function serialize(model, mapping) {
  if (mapping.properties) {
    var serializedForm = {};

    for (var field in mapping.properties) {
      var val = serialize(model[field], mapping.properties[field]);
      if (val !== undefined) {
        serializedForm[field] = val;
      }
    }

    return serializedForm;

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