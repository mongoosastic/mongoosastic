'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { Options, PluginDocument } from 'types'

interface IMovie extends PluginDocument {
	title: string,
	genre: string,
}

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
	filter: function(self: IMovie) {
		return self.genre === 'action'
	}
} as Options)

const Movie = mongoose.model('Movie', MovieSchema)

describe('Filter mode', function () {
	
	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await Movie.deleteMany()
		await config.deleteIndexIfExists(['movies'])
	})

	afterAll(async function() {
		await Movie.deleteMany()
		await config.deleteIndexIfExists(['movies'])
		mongoose.disconnect()
	})

	it('should index horror genre', function (done) {
		config.createModelAndEnsureIndex(Movie, {
			title: 'LOTR',
			genre: 'horror'
		}, async function () {

			const results = await Movie.search({
				term: {
					genre: 'horror'
				}
			})

			expect(results?.body.hits.total).toEqual(1)
			done()
		})
	})

	it('should not index action genre', async function (done) {
		
		await config.createModelAndSave(Movie, {
			title: 'Man in Black',
			genre: 'action'
		})

		const results = await Movie.search({
			term: {
				genre: 'action'
			}
		})

		expect(results?.body.hits.total).toEqual(0)
		done()
	})

	it('should unindex filtered models', function (done) {
		config.createModelAndEnsureIndex(Movie, {
			title: 'REC',
			genre: 'horror'
		}, async function (errSave: unknown, movie: IMovie) {

			const results = await Movie.search({
				term: {
					title: 'rec'
				}
			})

			expect(results?.body.hits.total).toEqual(1)

			movie.genre = 'action'
			config.saveAndWaitIndex(movie, async function () {
				
				await config.sleep(config.INDEXING_TIMEOUT)
				const res = await Movie.search({
					term: {
						title: 'rec'
					}
				})

				expect(res?.body.hits.total).toEqual(0)
				done()
			})
		})
	})
})