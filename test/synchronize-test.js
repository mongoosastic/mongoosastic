var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , esClient  = new(require('elastical').Client)
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , async     = require('async')
  , mongoosastic = require('../lib/mongoosastic');

var BookSchema = new Schema({
  title: String
});
BookSchema.plugin(mongoosastic);

var Book = mongoose.model('Book', BookSchema);

describe('Synchronize', function(){
  var books = null;

  before(function(done){
    config.deleteIndexIfExists(['books'], function(){
      mongoose.connect(config.mongoUrl, function(){
        var client = mongoose.connections[0].db;
        client.collection('books', function(err, _books){
          books = _books;
          Book.remove(done);
        });
      });
    });
  });
  describe('existing collection', function(){
    before(function(done){
      async.forEach([
          'American Gods',
          'Gods of the Old World',
          'American Gothic'], function(title, cb){
        books.insert({title:title}, cb);
      }, done);
    });
    it('should index all existing objects and return a count', function(done){
      Book.synchronize(function(err, count){
        count.should.eql(3);
        setTimeout(function(){
          Book.search({query:'American'}, function(err, results){
            results.total.should.eql(2);
            done();
          });
        }, 2100);
      });
    });
  });
});
