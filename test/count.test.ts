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
	beforeAll(async function(done) {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await Comment.deleteMany()
		await config.deleteIndexIfExists(['comments'])

		for (const comment of comments) {
			await comment.save()
		}

		setTimeout(done, config.INDEXING_TIMEOUT)
	})

	afterAll(async function() {
		await Comment.deleteMany()
		await config.deleteIndexIfExists(['comments'])
		mongoose.disconnect()
	})

	it('should count a type', function (done) {
		setTimeout(() => {
			Comment.esCount({
				term: {
					user: 'terry'
				}
			}, function (err, results) {
				const body = results?.body
				expect(body?.count).toEqual(1)
				done(err)
			})
		}, config.INDEXING_TIMEOUT)
	})

	it('should count a type without query', function (done) {
		setTimeout(() => {
			Comment.esCount(function (err, results) {
				const body = results?.body
				expect(body?.count).toEqual(2)
				done(err)
			})
		}, config.INDEXING_TIMEOUT)
	})
})
