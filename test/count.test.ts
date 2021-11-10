'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

const CommentSchema = new Schema({
	user: String,
	post_date: {
		type: Date,
		es_type: 'date'
	},
	message: {
		type: String
	},
	title: {
		type: String,
		es_boost: 2.0
	}
})

CommentSchema.plugin(mongoosastic, {
	bulk: {
		size: 2,
		delay: 100
	}
})

const Comment = mongoose.model('Comment', CommentSchema)

const comments = [
	new Comment({
		user: 'terry',
		title: 'Ilikecars'
	}),
	new Comment({
		user: 'fred',
		title: 'Ihatefish'
	})
]

describe('Count', function () {
	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await Comment.deleteMany()
		await config.deleteIndexIfExists(['comments'])

		for (const comment of comments) {
			await comment.save()
		}

		await config.sleep(config.INDEXING_TIMEOUT)
	})

	afterAll(async function() {
		await Comment.deleteMany()
		await config.deleteIndexIfExists(['comments'])
		mongoose.disconnect()
	})

	it('should count a type', async function() {

		await config.sleep(config.INDEXING_TIMEOUT)
		
		const results = await Comment.esCount({
			term: {
				user: 'terry'
			}
		})

		const body = results?.body
		expect(body?.count).toEqual(1)
	})

	it('should count a type without query', async function() {

		await config.sleep(config.INDEXING_TIMEOUT)

		const results = await Comment.esCount()

		const body = results?.body
		expect(body?.count).toEqual(2)
	})
})
