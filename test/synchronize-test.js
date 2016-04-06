'use strict';

const mongoose = require('mongoose');
const async = require('async');
const config = require('./config');
const mongoosastic = require('../lib/mongoosastic');

let Book;
const Schema = mongoose.Schema;

const BookSchema = new Schema({
  title: String
});

BookSchema.plugin(mongoosastic);

Book = mongoose.model('Book', BookSchema);

describe('Synchronize', () => {
  var books = null;

  before(done => {
    config.deleteIndexIfExists(['books'], () => {
      mongoose.connect(config.mongoUrl, () => {
        const client = mongoose.connections[0].db;
        client.collection('books', (err, _books) => {
          books = _books;
          Book.remove(done);
        });
      });
    });
  });

  after(done => {
    Book.esClient.close();
    mongoose.disconnect();
    done();
  });

  describe('an existing collection', () => {

    before(done => {
      async.forEach(config.bookTitlesArray(), (title, cb) => {
        books.insert({
          title: title
        }, cb);
      }, done);
    });

    it('should index all existing objects', done => {
      var stream = Book.synchronize(),
        count = 0;

      stream.on('data', (err, doc) => {
        if (doc._id) count++;
      });

      stream.on('close', () => {
        count.should.eql(53);
        setTimeout(() => {
          Book.search({
            query_string: {
              query: 'American'
            }
          }, (err, results) => {
            results.hits.total.should.eql(2);
            done();
          });
        }, config.INDEXING_TIMEOUT);
      });
    });

  });
});
