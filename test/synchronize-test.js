var mongoose = require('mongoose'),
  async = require('async'),
  config = require('./config'),
  mongoosastic = require('../lib/mongoosastic'),
  Book,
  Schema = mongoose.Schema;

var BookSchema = new Schema({
  title: String
});

BookSchema.plugin(mongoosastic);

Book = mongoose.model('Book', BookSchema);

describe('Synchronize', function() {
  var books = null;

  before(function(done) {
    config.deleteIndexIfExists(['books'], function() {
      mongoose.connect(config.mongoUrl, function() {
        var client = mongoose.connections[0].db;
        client.collection('books', function(err, _books) {
          books = _books;
          Book.remove(done);
        });
      });
    });
  });

  after(function(done) {
    Book.esClient.close();
    mongoose.disconnect();
    done();
  });

  describe('existing collection', function() {

    before(function(done) {
      async.forEach(config.bookTitlesArray(), function(title, cb) {
        books.insert({
          title: title
        }, cb);
      }, done);
    });

    it('should index all existing objects', function(done) {
      var stream = Book.synchronize(),
        count = 0;

      stream.on('data', function() {
        count++;
      });

      stream.on('close', function() {
        count.should.eql(53);
        setTimeout(function() {
          Book.search({
            query_string: {
              query: 'American'
            }
          }, function(err, results) {
            results.hits.total.should.eql(2);
            done();
          });
        }, config.INDEXING_TIMEOUT);
      });
    });

  });
});
