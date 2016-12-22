'use strict'

const mongoose = require('mongoose')
const Generator = require('../lib/mapping-generator')
const generator = new Generator()
const serialize = require('../lib/serialize')
const Schema = mongoose.Schema

const BowlingBall = mongoose.model('BowlingBall', new Schema())
const PersonSchema22 = new Schema({
  name: {
    first: String,
    last: String
  },
  dob: Date,
  bowlingBall: {
    type: Schema.ObjectId,
    ref: 'BowlingBall'
  },
  games: [{
    score: Number,
    date: Date
  }],
  somethingToCast: {
    type: String,
    es_cast: function (element) {
      return element + ' has been cast'
    }
  }
})

const Person = mongoose.model('Person22', PersonSchema22)

let mapping

// Serialize method requires a schema mapping
generator.generateMapping(PersonSchema22, function (err, tmp) {
  if (err) {
    // do nothing
  }
  mapping = tmp
})

describe('serialize', function () {
  const dude = new Person({
    name: {
      first: 'Jeffrey',
      last: 'Lebowski'
    },
    dob: new Date(Date.parse('05/17/1962')),
    bowlingBall: new BowlingBall(),
    games: [{
      score: 80,
      date: new Date(Date.parse('05/17/1962'))
    }, {
      score: 80,
      date: new Date(Date.parse('06/17/1962'))
    }],
    somethingToCast: 'Something'
  })

  // another person with missing parts to test robustness
  const millionnaire = new Person({
    name: {
      first: 'Jeffrey',
      last: 'Lebowski'
    }
  })

  it('should serialize a document with missing bits', function () {
    const serialized = serialize(millionnaire, mapping)
    serialized.should.have.property('games', [])
  })

  describe('with no indexed fields', function () {
    const serialized = serialize(dude, mapping)
    it('should serialize model fields', function () {
      serialized.name.first.should.eql('Jeffrey')
      serialized.name.last.should.eql('Lebowski')
    })

    it('should serialize object ids as strings', function () {
      serialized.bowlingBall.should.eql(dude.bowlingBall)
      serialized.bowlingBall.should.be.type('object')
    })

    it('should serialize dates in ISO 8601 format', function () {
      serialized.dob.should.eql(dude.dob.toJSON())
    })

    it('should serialize nested arrays', function () {
      serialized.games.should.have.lengthOf(2)
      serialized.games[0].should.have.property('score', 80)
    })

    it('should cast and serialize field', function () {
      serialized.somethingToCast.should.eql('Something has been cast')
    })
  })

  describe('indexed fields', function () {

  })
})
