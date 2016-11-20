'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const TextSchema = new Schema({
  title: String,
  quote: String
})

TextSchema.plugin(mongoosastic)

const Text = mongoose.model('Text', TextSchema)

describe('Highlight search', function () {
  const responses = [
    'You don\'t see people at their best in this job, said <em>Death</em>.',
    'The <em>death</em> of the warrior or the old man or the little child, this I understand, and I take away the',
    ' pain and end the suffering. I do not understand this <em>death</em>-of-the-mind',
    'The only reason for walking into the jaws of <em>Death</em> is so\'s you can steal his gold teeth'
  ]

  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      Text.remove(function () {
        config.deleteIndexIfExists(['texts'], function () {
          // Quotes are from Terry Pratchett's Discworld books
          const texts = [
            new Text({
              title: 'The colour of magic',
              quote: 'The only reason for walking into the jaws of Death is so\'s you can steal his gold teeth'
            }),
            new Text({
              title: 'The Light Fantastic',
              quote: 'The death of the warrior or the old man or the little child, this I understand, and I take ' +
                'away the pain and end the suffering. I do not understand this death-of-the-mind'
            }),
            new Text({
              title: 'Equal Rites',
              quote: 'Time passed, which, basically, is its job'
            }),
            new Text({
              title: 'Mort',
              quote: 'You don\'t see people at their best in this job, said Death.'
            })
          ]
          async.forEach(texts, config.saveAndWaitIndex, function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    Text.remove()
    Text.esClient.close()
    mongoose.disconnect()
    done()
  })

  describe('Highlight without hydrating', function () {
    it('should return highlighted text on every hit result', function (done) {
      Text.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        highlight: {
          fields: {
            quote: {}
          }
        }
      }, function (err, res) {
        res.hits.total.should.eql(3)
        res.hits.hits.forEach(function (text) {
          text.should.have.property('highlight')
          text.highlight.should.have.property('quote')
          text.highlight.quote.forEach(function (query) {
            responses.should.containEql(query)
          })
        })

        done()
      })
    })
  })

  describe('Highlight hydrated results', function () {
    it('should return highlighted text on every resulting document', function (done) {
      Text.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true,
        highlight: {
          fields: {
            quote: {}
          }
        }
      }, function (err, res) {
        res.hits.total.should.eql(3)
        res.hits.hits.forEach(function (model) {
          model.should.have.property('_highlight')
          model._highlight.should.have.property('quote')
          model._highlight.quote.forEach(function (query) {
            responses.should.containEql(query)
          })
        })

        done()
      })
    })
  })
})
