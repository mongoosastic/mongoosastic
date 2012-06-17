var esClient  = new(require('elastical').Client)
  , async = require('async');

module.exports = {
    mongoUrl: 'mongodb://localhost/es-test'
  , deleteIndexIfExists: function(indexes, done){
      async.forEach(indexes, function(index, cb){
        esClient.indexExists(index, function(err, exists){
          if(exists){
            esClient.deleteIndex(index, cb);
          }else{
            cb();
          }
        });
      }, done);
    }
};
