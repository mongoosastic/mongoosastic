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

	it('should be able to index it directly without saving', async function (done) {
		const doc = await Tweet.findOne({ message: 'I know kung-fu!' })

		if(doc) {
			doc.message = 'I know nodejitsu!'
		
			doc.index(function () {
				setTimeout(function () {
					Tweet.search({
						query_string: {
							query: 'know'
						}
					}, function (err, res) {
						const source = res?.body.hits.hits[0]._source
						expect(source?.message).toEqual('I know nodejitsu!')
						done()
					})
				}, config.INDEXING_TIMEOUT)
			})
		}
	})

	it('should be able to index to alternative index', async function (done) {
		const doc = await Tweet.findOne({ message: 'I know kung-fu!' })

		if(doc) {
			doc.message = 'I know taebo!'
		
			doc.index({
				index: 'public_tweets'
			}, function () {
				setTimeout(function () {
					Tweet.search({
						query_string: {
							query: 'know'
						}
					}, {
						index: 'public_tweets'
					}, function (err, res) {
						const source = res?.body.hits.hits[0]._source
						expect(source?.message).toEqual('I know taebo!')
						done()
					})
				}, config.INDEXING_TIMEOUT)
			})
		}
	})

})
