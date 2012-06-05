var esClient  = new(require('elastical').Client)

module.exports = function elasticSearchPlugin(schema, options){
  schema.post('save', function(){
    var model = this
      , serializedForm = this.toJSON();

    serializedForm._mongoId = this._id.toString()
    delete serializedForm._id

    esClient.index(options.index, options.type, serializedForm, function(err, res){
      model.emit('es-indexed', err, res);
    })
  });

  schema.statics.search = function(query, cb){
    esClient.search(query, function(err, results, res){
      results.hits = results.hits.map(function(hit){
        return hit._source;
      });
      cb(null, results)
    });    
  }
}
