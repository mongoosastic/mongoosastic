'use strict'

const mongoose = require('mongoose')
const elasticsearch = require('elasticsearch')
const esClient = new elasticsearch.Client({
  deadTimeout: 0,
  keepAlive: false
})
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

let KittenSchema
let Kitten

describe('Suggesters', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      config.deleteIndexIfExists(['kittens'], function () {
        KittenSchema = new Schema({
          name: {
            type: String,
            es_type: 'completion',
            es_analyzer: 'simple',
            es_indexed: true
          },
          breed: {
            type: String
          }
        })
        KittenSchema.plugin(mongoosastic)
        Kitten = mongoose.model('Kitten', KittenSchema)
        Kitten.createMapping({}, function () {
          Kitten.remove(function () {
            const kittens = [
              new Kitten({
                name: 'Cookie',
                breed: 'Aegean'
              }),
              new Kitten({
                name: 'Chipmunk',
                breed: 'Aegean'
              }),
              new Kitten({
                name: 'Twix',
                breed: 'Persian'
              }),
              new Kitten({
                name: 'Cookies and Cream',
                breed: 'Persian'
              })
            ]
            async.forEach(kittens, config.saveAndWaitIndex, function () {
              setTimeout(done, config.INDEXING_TIMEOUT)
            })
          })
        })
      })
    })
  })

  after(function (done) {
    Kitten.esClient.close()
    mongoose.disconnect()
    esClient.close()
    done()
  })

  describe('Testing Suggest', function () {
    it('should index property name with type completion', function (done) {
      Kitten = mongoose.model('Kitten', KittenSchema)
      Kitten.createMapping(function () {
        esClient.indices.getMapping({
          index: 'kittens',
          type: 'kitten'
        }, function (err, mapping) {
          const props = mapping.kitten !== undefined /* elasticsearch 1.0 & 0.9 support */
            ? mapping.kitten.properties /* ES 0.9.11 */
            : mapping.kittens.mappings.kitten.properties /* ES 1.0.0 */
          props.name.type.should.eql('completion')
          done()
        })
      })
    })
    it('should return suggestions after hits', function (done) {
      Kitten.search({
        match_all: {}
      }, {
        suggest: {
          kittensuggest: {
            text: 'Cook',
            completion: {
              field: 'name'
            }
          }
        }
      }, function (err, res) {
        res.should.have.property('suggest')
        res.suggest.kittensuggest[0].options.length.should.eql(2)
        done()
      })
    })
  })
})
