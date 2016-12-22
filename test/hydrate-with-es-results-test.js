'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const esResultTextSchema = new Schema({
  title: String,
  quote: String
})

esResultTextSchema.plugin(mongoosastic)

const EsResultText = mongoose.model('esResultText', esResultTextSchema)

describe('Hydrate with ES data', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      EsResultText.remove(function () {
        config.deleteIndexIfExists(['esresulttexts'], function () {
          // Quotes are from Terry Pratchett's Discworld books
          const esResultTexts = [
            new EsResultText({
              title: 'The colour of magic',
              quote: 'The only reason for walking into the jaws of Death is so\'s you can steal his gold teeth'
            }),
            new EsResultText({
              title: 'The Light Fantastic',
              quote: 'The death of the warrior or the old man or the little child, this I understand, and I take ' +
              'away the pain and end the suffering. I do not understand this death-of-the-mind'
            }),
            new EsResultText({
              title: 'Equal Rites',
              quote: 'Time passed, which, basically, is its job'
            }),
            new EsResultText({
              title: 'Mort',
              quote: 'You don\'t see people at their best in this job, said Death.'
            })
          ]
          async.forEach(esResultTexts, config.saveAndWaitIndex, function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    EsResultText.remove()
    EsResultText.esClient.close()
    mongoose.disconnect()
    done()
  })

  describe('Hydrate without adding ES data', function () {
    it('should return simple objects', function (done) {
      EsResultText.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true
      }, function (err, res) {
        if (err) done(err)

        res.hits.total.should.eql(3)
        res.hits.hits.forEach(function (text) {
          text.should.not.have.property('_esResult')
        })

        done()
      })
    })
  })

  describe('Hydrate and add ES data', function () {
    it('should return object enhanced with _esResult', function (done) {
      EsResultText.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true,
        hydrateWithESResults: true,
        highlight: {
          fields: {
            quote: {}
          }
        }
      }, function (err, res) {
        if (err) done(err)

        res.hits.total.should.eql(3)
        res.hits.hits.forEach(function (model) {
          model.should.have.property('_esResult')
          model._esResult.should.have.property('_index')
          model._esResult._index.should.eql('esresulttexts')
          model._esResult.should.have.property('_type')
          model._esResult._type.should.eql('esresulttext')
          model._esResult.should.have.property('_id')
          model._esResult.should.have.property('_score')
          model._esResult.should.have.property('highlight')

          model._esResult.should.not.have.property('_source')
        })

        done()
      })
    })

    it('should remove _source object', function (done) {
      EsResultText.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true,
        hydrateWithESResults: {source: true},
        highlight: {
          fields: {
            quote: {}
          }
        }
      }, function (err, res) {
        if (err) done(err)
        res.hits.total.should.eql(3)
        res.hits.hits.forEach(function (model) {
          model.should.have.property('_esResult')
          model._esResult.should.have.property('_index')
          model._esResult._index.should.eql('esresulttexts')
          model._esResult.should.have.property('_type')
          model._esResult._type.should.eql('esresulttext')
          model._esResult.should.have.property('_id')
          model._esResult.should.have.property('_score')
          model._esResult.should.have.property('highlight')

          model._esResult.should.have.property('_source')
          model._esResult._source.should.have.property('title')
          model._esResult._source.should.have.property('title')
        })

        done()
      })
    })
  })
})
