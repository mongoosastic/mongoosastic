var esClient  = new(require('elasticsearch').Client)
  , async = require('async');

const INDEXING_TIMEOUT = 110;

module.exports = {
    mongoUrl: 'mongodb://localhost/es-test'
  , indexingTimeout: INDEXING_TIMEOUT
  , deleteIndexIfExists: function(indexes, done){
      async.forEach(indexes, function(index, cb){
        esClient.indices.exists({
          index: index
        }, function(err, exists){
          if(exists){
            esClient.indices.delete({
              index: index
            }, cb);
          }else{
            cb();
          }
        });
      }, done);
    }
  , createModelAndEnsureIndex: createModelAndEnsureIndex
  , saveAndWaitIndex: saveAndWaitIndex
  , bookTitlesArray: bookTitlesArray
};

function createModelAndEnsureIndex(model, obj, cb){
  var dude = new model(obj);
  dude.save(function(){
    dude.on('es-indexed', function(){
      model.esClient.indices.refresh().then(cb.bind(this, null));
    });
  });
}

function saveAndWaitIndex(model, cb){
  model.save(function(err) {
    if (err) return cb(err);

    model.on('es-indexed', cb );
  });
}

function bookTitlesArray() {
  var books = [
    'American Gods',
    'Gods of the Old World',
    'American Gothic'
  ];
  for (var i = 0; i < 50; i++) {
    books.push('ABABABA' + i);
  }
  return books;
}
