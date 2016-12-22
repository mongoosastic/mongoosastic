'use strict'

const mongoose = require('mongoose')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const FoodSchema = new Schema({
  name: {
    type: String
  }
})
FoodSchema.virtual('type').get(() => { return 'dinner' })
FoodSchema.set('toObject', { getters: true, virtuals: true, versionKey: false })

FoodSchema.plugin(mongoosastic, {
  customSerialize (model) {
    const data = model.toObject()
    delete data.id
    delete data._id
    return data
  }
})

const Food = mongoose.model('Food', FoodSchema)

describe('Custom Serialize', function () {
  this.timeout(5000)

  before(function (done) {
    config.deleteIndexIfExists(['foods'], function () {
      mongoose.connect(config.mongoUrl, function () {
        const client = mongoose.connections[0].db
        client.collection('foods', function () {
          Food.remove(done)
        })
      })
    })
  })

  after(function (done) {
    mongoose.disconnect()
    Food.esClient.close()
    done()
  })

  it('should index all fields returned from the customSerialize function', function (done) {
    config.createModelAndEnsureIndex(Food, { name: 'pizza' }, (error) => {
      Food.search({ query_string: { query: 'pizza' } }, (searchError, results) => {
        if (searchError) return done(error)
        results.hits.hits[0]._source.name.should.eql('pizza')
        results.hits.hits[0]._source.type.should.eql('dinner')
        done()
      })
    })
  })
})
