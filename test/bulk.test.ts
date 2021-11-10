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

	beforeAll(async function () {
		await config.deleteIndexIfExists(['books'])
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await Book.deleteMany()
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

	it('should index all objects and support deletions too', async function () {
		// This timeout is important, as Elasticsearch is "near-realtime" and the index/deletion takes time that
		// needs to be taken into account in these tests
		await config.sleep(config.BULK_ACTION_TIMEOUT)

		const results = await Book.search({
			match_all: {}
		})

		expect(results).toHaveProperty('body')
		expect(results?.body).toHaveProperty('hits')
		expect(results?.body.hits).toHaveProperty('total', 52)
	})
})
