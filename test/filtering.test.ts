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
		}, function () {
			Movie.search({
				term: {
					genre: 'horror'
				}
			}, {}, function (err, results) {
				expect(results?.body.hits.total).toEqual(1)
				done()
			})
		})
	})

	it('should not index action genre', async function (done) {
		
		await config.createModelAndSave(Movie, {
			title: 'Man in Black',
			genre: 'action'
		})

		Movie.search({
			term: {
				genre: 'action'
			}
		}, {}, function (err, results) {
			expect(results?.body.hits.total).toEqual(0)
			done()
		})
	})

	it('should unindex filtered models', function (done) {
		config.createModelAndEnsureIndex(Movie, {
			title: 'REC',
			genre: 'horror'
		}, function (errSave: unknown, movie: IMovie) {
			Movie.search({
				term: {
					title: 'rec'
				}
			}, function (err, results) {
				expect(results?.body.hits.total).toEqual(1)

				movie.genre = 'action'
				config.saveAndWaitIndex(movie, function () {
					
					setTimeout(function () {
						Movie.search({
							term: {
								title: 'rec'
							}
						}, {}, function (err, res) {
							expect(res?.body.hits.total).toEqual(0)
							done()
						})
					}, config.INDEXING_TIMEOUT)
				})
			})
		})
	})
})
