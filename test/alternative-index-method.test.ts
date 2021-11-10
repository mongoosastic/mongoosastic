'use strict'

import mongoose from 'mongoose'
import { config } from './config'
import { Tweet } from './models/tweet'

describe('Index Method', function () {

	beforeAll(async function (done) {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['tweets', 'public_tweets'])

		await Tweet.deleteMany()

		config.createModelAndEnsureIndex(Tweet, {
			user: 'jamescarr',
			message: 'I know kung-fu!',
			post_date: new Date()
		}, done)

	})

	afterAll(async function() {
		await Tweet.deleteMany()
		await config.deleteIndexIfExists(['tweets', 'public_tweets'])
		mongoose.disconnect()
	})

	it('should be able to index it directly without saving', async function() {
		const doc = await Tweet.findOne({ message: 'I know kung-fu!' })

		if(doc) {
			doc.message = 'I know nodejitsu!'
		
			await doc.index()
			await config.sleep(config.INDEXING_TIMEOUT)

			const res = await Tweet.search({
				query_string: {
					query: 'know'
				}
			})

			const source = res?.body.hits.hits[0]._source
			expect(source?.message).toEqual('I know nodejitsu!')
		}
	})

	it('should be able to index to alternative index', async function () {
		const doc = await Tweet.findOne({ message: 'I know kung-fu!' })

		if(doc) {
			doc.message = 'I know taebo!'
		
			await doc.index({
				index: 'public_tweets'
			})

			await config.sleep(config.INDEXING_TIMEOUT)

			const res = await Tweet.search({
				query_string: {
					query: 'know'
				}
			}, {
				index: 'public_tweets'
			})

			const source = res?.body.hits.hits[0]._source
			expect(source?.message).toEqual('I know taebo!')
		}
	})

})