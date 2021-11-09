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

		it('should be able to truncate all documents', function (done) {
			
			Dummy.esTruncate(function () {
				setTimeout(function() {
					Dummy.search({
						query_string: {
							query: 'Text1'
						}
					}, {}, function (err, results) {
						expect(results?.body.hits.total).toEqual(0)
						done(err)
					})
				}, config.BULK_ACTION_TIMEOUT)
			
			})
		})

	})
})
