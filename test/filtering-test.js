var mongoose = require('mongoose'),
  config = require('./config'),
  Schema = mongoose.Schema,
  mongoosastic = require('../lib/mongoosastic');

// -- Only index specific field
var MovieSchema = new Schema({
  title: {type: String, required: true, default: '', es_indexed: true},
  genre: {type: String, required:true, default: '', enum: ['horror', 'action', 'adventure', 'other'], es_indexed: true}
});

MovieSchema.plugin(mongoosastic, {
  filter: function(self) {
    return self.genre === 'action';
  }
});

var Movie = mongoose.model('Movie', MovieSchema);

describe('Filter mode', function() {
  var movies = null;
  this.timeout(5000);

  before(function(done) {
    config.deleteIndexIfExists(['movies'], function() {
      mongoose.connect(config.mongoUrl, function() {
        var client = mongoose.connections[0].db;
        client.collection('movies', function(err, _movies) {
          movies = _movies;
          Movie.remove(done);
        });
      });
    });
  });

  after(function(done) {
    mongoose.disconnect();
    Movie.esClient.close();
    done();
  });

  it('should index horror genre', function(done) {
    config.createModelAndEnsureIndex(Movie, {title: 'LOTR', genre: 'horror'}, function() {
      Movie.search({term: {genre: 'horror'}}, function(err, results) {
        results.hits.total.should.eql(1);
        done();
      });
    });
  });

  it('should not index action genre', function(done) {
    config.createModelAndSave(Movie, {title: 'Man in Black', genre: 'action'}, function() {
      Movie.search({term: {genre: 'action'}}, function(err, results) {
        results.hits.total.should.eql(0);
        done();
      });
    });
  });
});
