'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

const BookSchema = new Schema({
	title: {
		type: String,
		required: true
	}
})

BookSchema.plugin(mongoosastic)

let saveCounter = 0
BookSchema.pre('save', function (next) {
	// Count save
	++saveCounter
	next()
})

const Book = mongoose.model('Book', BookSchema)

describe('Synchronize', () => {
	
	let books

	beforeAll(function() {
		jest.setTimeout(10000)
	})

	afterAll(async function() {
		await Book.deleteMany()
		await config.deleteIndexIfExists(['books'])
		mongoose.disconnect()
	})

	describe('an existing collection with invalid field values', () => {

		beforeAll(async function() {
			await config.deleteIndexIfExists(['books'])
			await mongoose.connect(config.mongoUrl, config.mongoOpts)
			const client = mongoose.connections[0].db
			books = client.collection('books')
			
			await Book.deleteMany()

			for (const title of config.bookTitlesArray()) {
				await books.insertOne({
					title: title
				})
			}

			await books.insertOne({})
		})

		it('should index all but one document', done => {
			saveCounter = 0
			const stream = Book.synchronize()
			let count = 0
			let errorCount = 0
			stream.on('data', () => {
				count++
			})
			stream.on('error', () => {
				errorCount += 1
			})
			stream.on('close', async () => {

				expect(count).toEqual(53)
				expect(saveCounter).toEqual(count)
				expect(errorCount).toEqual(1)

				await config.sleep(config.BULK_ACTION_TIMEOUT)

				const results = await Book.search({
					query_string: {
						query: 'American'
					}
				})

				expect(results?.body.hits.total).toEqual(2)
				done()
			})
		})
	})

	describe('an existing collection', () => {

		beforeAll(async function() {
			await config.deleteIndexIfExists(['books'])
			await mongoose.connect(config.mongoUrl, config.mongoOpts)
			const client = mongoose.connections[0].db
			books = client.collection('books')
			
			await Book.deleteMany()

			for (const title of config.bookTitlesArray()) {
				await books.insertOne({
					title: title
				})
			}
		})

		it('should index all existing objects', done => {
			saveCounter = 0
			let count = 0
			const stream = Book.synchronize()

			stream.on('data', () => {
				count++
			})

			stream.on('close', async () => {
				expect(count).toEqual(53)
				expect(saveCounter).toEqual(count)

				await config.sleep(config.BULK_ACTION_TIMEOUT)

				const results = await Book.search({
					query_string: {
						query: 'American'
					}
				})

				expect(results?.body.hits.total).toEqual(2)
				done()
			})
		})

		it('should index all existing objects without saving them in MongoDB', done => {
			saveCounter = 0
			const stream = Book.synchronize({}, { saveOnSynchronize: false })
			let count = 0

			stream.on('data', (err, doc) => {
				if (doc._id) count++
			})

			stream.on('close', async () => {
				expect(count).toEqual(53)
				expect(saveCounter).toEqual(0)

				await config.sleep(config.BULK_ACTION_TIMEOUT)

				const results = await Book.search({
					query_string: {
						query: 'American'
					}
				})

				expect(results?.body.hits.total).toEqual(2)
				done()
			})
		})
	})
})
