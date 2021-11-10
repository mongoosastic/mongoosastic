'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

const DummySchema = new Schema({
	text: String
})

DummySchema.plugin(mongoosastic)

const Dummy = mongoose.model('DummyTruncate', DummySchema)

describe('Truncate', function () {
	beforeAll(async function(done) {

		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await Dummy.deleteMany()
		await config.deleteIndexIfExists(['dummytruncates'])

		config.createModelAndEnsureIndex(Dummy, {
			text: 'Text1'
		}, done)
    
	})

	afterAll(async function() {
		await Dummy.deleteMany()
		await config.deleteIndexIfExists(['dummytruncates'])
		mongoose.disconnect()
	})

	describe('esTruncate', function () {

		it('should be able to truncate all documents', async function () {
			
			await Dummy.esTruncate()
			await config.sleep(config.INDEXING_TIMEOUT)

			const results = await Dummy.search({
				query_string: {
					query: 'Text1'
				}
			})

			expect(results?.body.hits.total).toEqual(0)
		})

	})
})
