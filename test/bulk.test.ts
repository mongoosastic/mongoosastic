'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

const BookSchema = new Schema({
	title: String
})

BookSchema.plugin(mongoosastic, {
	bulk: {
		size: 100,
		delay: 1000
	}
})

const Book = mongoose.model('Book', BookSchema)

describe('Bulk mode', function () {

	beforeAll(async function (done) {
		await config.deleteIndexIfExists(['books'])
		mongoose.connect(config.mongoUrl, config.mongoOpts, function () {
			const client = mongoose.connections[0].db
			client.collection('books', function () {
				Book.deleteMany(done)
			})
		})
	})

	beforeAll(async function () {
		for (const title of config.bookTitlesArray()) {
			await new Book({ title: title }).save()
		}
	})

	beforeAll(async function () {
		const book = await Book.findOne({ title: 'American Gods' })
		await book?.remove()
	})

	afterAll(async function () {
		await config.deleteIndexIfExists(['books'])
		await Book.deleteMany()
		mongoose.disconnect()
	})

	it('should index all objects and support deletions too', function (done) {
		// This timeout is important, as Elasticsearch is "near-realtime" and the index/deletion takes time that
		// needs to be taken into account in these tests
		setTimeout(function () {
			Book.search({
				match_all: {}
			}, function (err, results) {
				expect(results).toHaveProperty('body')
				expect(results?.body).toHaveProperty('hits')
				expect(results?.body.hits).toHaveProperty('total', 52)
				done()
			})
		}, config.BULK_ACTION_TIMEOUT)
	})
})
