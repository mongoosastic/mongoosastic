var elasticsearch = require('elasticsearch'),
  esClient = new elasticsearch.Client({
    host: 'localhost:9200',
    deadTimeout: 0,
    keepAlive: false
  }),
  async = require('async');

const INDEXING_TIMEOUT = process.env.INDEXING_TIMEOUT || 1100;

module.exports = {
  mongoUrl: 'mongodb://localhost/es-test',
  indexingTimeout: INDEXING_TIMEOUT,
  deleteIndexIfExists: deleteIndexIfExists,
  createModelAndEnsureIndex: createModelAndEnsureIndex,
  createModelAndSave: createModelAndSave,
  saveAndWaitIndex: saveAndWaitIndex,
  bookTitlesArray: bookTitlesArray,
  getClient: function() {
    return esClient;
  },
  close: function() {
    esClient.close();
  }
};

function deleteIndexIfExists(indexes, done) {
  async.forEach(indexes, function(index, cb) {
    esClient.indices.exists({
      index: index
    }, function(err, exists) {
      if (exists) {
        esClient.indices.delete({
          index: index
        }, cb);
      } else {
        cb();
      }
    });
  }, done);
}

function createModelAndEnsureIndex(Model, obj, cb) {
  var dude = new Model(obj);
  dude.save(function() {
    dude.on('es-indexed', function(err, res) {
      setTimeout(cb, INDEXING_TIMEOUT);
    });
  });
}

function createModelAndSave(Model, obj, cb) {
  var dude = new Model(obj);
  dude.save(cb);
}

function saveAndWaitIndex(model, cb) {
  model.save(function(err) {
    if (err) cb(err);
    else model.on('es-indexed', cb);
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
