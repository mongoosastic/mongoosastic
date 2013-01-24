var fs = require('fs');

module.exports = serialize;

function serialize(model, indexedFields) {
  var serializedForm = {}
    , indexedFields = indexedFields?indexedFields:[];

  if(indexedFields.length > 0){
    indexedFields.forEach(function(field){
      serializedForm[field] = model.get(field);
    });
  }else{
    serializedForm = model.toJSON();
  }
  delete serializedForm._id;
  delete serializedForm.id;
  return convertTypesAsNeeded(serializedForm);
}

function convertTypesAsNeeded(serializedForm) {
  Object.keys(serializedForm).forEach(function(field) {
    var value = serializedForm[field];
    if (typeof value === 'object' && value !== null) {
      var name = value.constructor.name;
      if (name === 'ObjectID') {
        serializedForm[field] = value.toString();
      } else if (name === 'Date') {
        serializedForm[field] = new Date(value).toJSON();
      }
    }
  })
  return serializedForm;
}
