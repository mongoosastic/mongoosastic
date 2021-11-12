'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { Tweet } from './models/tweet'
import { MongoosasticDocument, MongoosasticModel } from 'types'

interface IDummy extends MongoosasticDocument {
	text: string
}

const DummySchema = new Schema<IDummy>({
	text: String
})

async function tryDummySearch<T extends MongoosasticDocument>(model: MongoosasticModel<T>) {
	await config.sleep(config.INDEXING_TIMEOUT)

	const results = await model.search({
		simple_query_string: {
			query: 'matata'
		}
	}, {
		index: 'tweets'
	})

	expect(results?.body.hits.total).toEqual(1)
}

describe('Elasticsearch Connection', function () {

	beforeAll(async function() {
    
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['tweets'])
		await Tweet.deleteMany()

		await config.createModelAndEnsureIndex(Tweet, {
			user: 'Yahia KERIM',
			message: 'Hakuna-matata!',
			post_date: new Date()
		})
	})

	afterAll(async function() {
		await Tweet.deleteMany()
		await config.deleteIndexIfExists(['tweets'])
		mongoose.disconnect()
	})

	it('should be able to connect with default options', async function() {
		DummySchema.plugin(mongoosastic)
		const Dummy2 = mongoose.model<IDummy, MongoosasticModel<IDummy>>('Dummy2', DummySchema, 'dummys')

		await tryDummySearch(Dummy2)
	})

	it('should be able to connect with explicit options', async function() {
		DummySchema.plugin(mongoosastic, {
			clientOptions: { 
				node: 'http://localhost:9200'
			}
		})

		const Dummy3 = mongoose.model<IDummy, MongoosasticModel<IDummy>>('Dummy3', DummySchema, 'dummys')

		await tryDummySearch(Dummy3)
	})
})
