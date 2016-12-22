'use strict'

const mongoose = require('mongoose')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

// -- Only index specific field
const MovieSchema = new Schema({
  title: {
    type: String,
    required: true,
    default: '',
    es_indexed: true
  },
  genre: {
    type: String,
    required: true,
    default: '',
    enum: ['horror', 'action', 'adventure', 'other'],
    es_indexed: true
  }
})

MovieSchema.plugin(mongoosastic, {
  filter: function (self) {
    return self.genre === 'action'
  }
})

const Movie = mongoose.model('Movie', MovieSchema)

describe('Filter mode', function () {
  this.timeout(7000)

  before(function (done) {
    config.deleteIndexIfExists(['movies'], function () {
      mongoose.connect(config.mongoUrl, function () {
        const client = mongoose.connections[0].db
        client.collection('movies', function () {
          Movie.remove(done)
        })
      })
    })
  })

  after(function (done) {
    mongoose.disconnect()
    Movie.esClient.close()
    done()
  })

  it('should index horror genre', function (done) {
    config.createModelAndEnsureIndex(Movie, {
      title: 'LOTR',
      genre: 'horror'
    }, function () {
      Movie.search({
        term: {
          genre: 'horror'
        }
      }, function (err, results) {
        results.hits.total.should.eql(1)
        done()
      })
    })
  })

  it('should not index action genre', function (done) {
    config.createModelAndSave(Movie, {
      title: 'Man in Black',
      genre: 'action'
    }, function () {
      Movie.search({
        term: {
          genre: 'action'
        }
      }, function (err, results) {
        results.hits.total.should.eql(0)
        done()
      })
    })
  })

  it('should unindex filtered models', function (done) {
    config.createModelAndEnsureIndex(Movie, {
      title: 'REC',
      genre: 'horror'
    }, function (errSave, movie) {
      Movie.search({
        term: {
          title: 'rec'
        }
      }, function (err, results) {
        results.hits.total.should.eql(1)

        movie.genre = 'action'
        config.saveAndWaitIndex(movie, function () {
          setTimeout(function () {
            Movie.search({
              term: {
                title: 'rec'
              }
            }, function (errSearch2, results2) {
              results2.hits.total.should.eql(0)
              done()
            })
          }, config.INDEXING_TIMEOUT)
        })
      })
    })
  })
})
