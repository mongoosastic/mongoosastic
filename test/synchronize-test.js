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
      async.forEach(bookTitles()
          , function(title, cb){
        books.insert({title:title}, cb);
      }, done);
    });
    it('should index all existing objects', function(done){
      var stream = Book.synchronize()
        , count = 0;

      stream.on('data', function(err, doc){
        count++;
      });

      stream.on('close', function(){
        count.should.eql(53);
        setTimeout(function(){
          Book.search({query:'American'}, function(err, results){
            results.hits.total.should.eql(2);
            done();
          });
        }, 1100);
      });
    });
  });
});
function bookTitles(){
  var books = [
    'American Gods',
    'Gods of the Old World',
    'American Gothic'
  ];
  for(var i = 0; i < 50; i++){
    books.push('ABABABA'+i);
  }
  return books;
}
