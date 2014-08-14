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

  } else if (typeof model === 'object' && model !== null) {
    var name = model.constructor.name;
    if (name === 'ObjectID') {
      return model.toString();
    } else if (name === 'Date') {
      return new Date(model).toJSON();
    }
    return model;
  } else {
    return model;
  }
}