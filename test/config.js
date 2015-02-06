var esClient  = new(require('elasticsearch').Client)
    , async = require('async');

const INDEXING_TIMEOUT = 1100;

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
};

function createModelAndEnsureIndex(model, obj, cb){
  var dude = new model(obj);
  dude.save(function(){
    dude.on('es-indexed', function(err, res){
      setTimeout(cb, INDEXING_TIMEOUT);
    });
  });
}