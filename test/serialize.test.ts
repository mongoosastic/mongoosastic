'use strict'

import mongoose, { Schema } from 'mongoose'
import { PluginDocument } from 'types'
import Generator from '../lib/mapping'
const generator = new Generator()
import { serialize } from '../lib/utils'

interface IPerson extends PluginDocument {
	name: {
		first: string,
		last: string
	},
	dob: Date,
	bowlingBall: {
		type: Schema.Types.ObjectId,
		ref: 'BowlingBall'
	},
	games: [{
		score: number,
		date: Date
	}],
	somethingToCast: {
		type: string,
		es_cast: CallableFunction
	}
}

const BowlingBall = mongoose.model('BowlingBall', new Schema())
const PersonSchema = new Schema({
	name: {
		first: String,
		last: String
	},
	dob: Date,
	bowlingBall: {
		type: Schema.Types.ObjectId,
		ref: 'BowlingBall'
	},
	games: [{
		score: Number,
		date: Date
	}],
	somethingToCast: {
		type: String,
		es_cast: function (element: string) {
			return element + ' has been cast'
		}
	}
})

const Person = mongoose.model<IPerson>('Person', PersonSchema)

const mapping = generator.generateMapping(PersonSchema)

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
		const serialized = serialize(millionnaire, mapping) as IPerson
		expect(serialized).toHaveProperty('games')
		expect(serialized.games).toHaveLength(0)
	})

	describe('with no indexed fields', function () {
		const serialized = serialize(dude, mapping) as IPerson
		it('should serialize model fields', function () {
			expect(serialized.name.first).toEqual('Jeffrey')
			expect(serialized.name.last).toEqual('Lebowski')
		})

		it('should serialize object ids as strings', function () {
			expect(serialized.bowlingBall).toEqual(dude.bowlingBall)
			expect(typeof serialized.bowlingBall).toBe('object')
		})

		it('should serialize dates in ISO 8601 format', function () {
			expect(serialized.dob).toEqual(dude.dob.toJSON())
		})

		it('should serialize nested arrays', function () {
			expect(serialized.games).toHaveLength(2)
			expect(serialized.games[0]).toHaveProperty('score', 80)
		})

		it('should cast and serialize field', function () {
			expect(serialized.somethingToCast).toEqual('Something has been cast')
		})
	})
})
