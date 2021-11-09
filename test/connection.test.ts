'use strict'

import mongoose, { Model, Schema, Document } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { Tweet } from './models/tweet'

const DummySchema = new Schema({
	text: String
})

function tryDummySearch (model: Model<Document>, cb: CallableFunction) {
	setTimeout(function () {
		model.search({
			simple_query_string: {
				query: 'matata'
			}
		}, {
			index: 'tweets'
		}, function (err, results) {
			if (err) {
				return cb(err)
			}

			expect(results?.body.hits.total).toEqual(1)
			cb(err)
		})
	}, config.INDEXING_TIMEOUT)
}

describe('Elasticsearch Connection', function () {

	beforeAll(async function(done) {
    
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['tweets'])
		await Tweet.deleteMany()

		config.createModelAndEnsureIndex(Tweet, {
			user: 'Yahia KERIM',
			message: 'Hakuna-matata!',
			post_date: new Date()
		}, done)
    
	})

	afterAll(async function() {
		await Tweet.deleteMany()
		await config.deleteIndexIfExists(['tweets'])
		mongoose.disconnect()
	})

	it('should be able to connect with default options', function (done) {
		DummySchema.plugin(mongoosastic)
		const Dummy2 = mongoose.model('Dummy2', DummySchema, 'dummys')

		tryDummySearch(Dummy2, done)
	})

	it('should be able to connect with explicit options', function (done) {
		DummySchema.plugin(mongoosastic, {
			clientOptions: { 
				node: 'http://localhost:9200'
			}
		})

		const Dummy3 = mongoose.model('Dummy3', DummySchema, 'dummys')

		tryDummySearch(Dummy3, done)
	})
})
