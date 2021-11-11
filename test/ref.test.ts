'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

const esClient = config.getClient()

const UserSchema = new Schema({
	name: { type: String }
})
const User = mongoose.model('User', UserSchema)

const PostCommentSchema = new Schema({
	author: { type: Schema.Types.ObjectId, ref: 'User' },
	text: { type: String }
})
const PostComment = mongoose.model('PostComment', PostCommentSchema)

const PostSchema = new Schema({
	body: { type: String, es_indexed: true },
	author: { type: Schema.Types.ObjectId, ref: 'User', es_schema: UserSchema, es_indexed: true },
	comments: [{ type: Schema.Types.ObjectId, ref: 'PostComment', es_schema: PostCommentSchema, es_indexed: true }]
})

PostSchema.plugin(mongoosastic, {
	populate: [
		{ path: 'author' },
		{ path: 'comments', select: 'text' }
	]
})

const Post = mongoose.model('Post', PostSchema)

describe('references', function () {

	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['posts', 'users', 'postcomments'])

		for (const model of [Post, User, PostComment]) {
			await model.deleteMany()
		}
	})

	afterAll(async function () {
		for (const model of [Post, User, PostComment]) {
			await model.deleteMany()
		}
		await config.deleteIndexIfExists(['posts', 'users', 'postcomments'])
		mongoose.disconnect()
	})

	describe('indexing', function () {
		beforeAll(async function() {

			const user = new User({
				name: 'jake'
			})

			const savedUser = await user.save()

			const comments = [
				new PostComment({ author: savedUser._id, text: 'good post' }),
				new PostComment({ author: savedUser._id, text: 'really' })
			]

			for (const comment of comments) {
				await comment.save()
			}

			await config.createModelAndEnsureIndex(Post, {
				body: 'A very short post',
				author: savedUser._id,
				comments: [comments[0]._id, comments[1]._id]
			})
		})

		it('should index selected fields from referenced schema',async function() {
			
			const post = await Post.findOne({})
			
			const res = await esClient.get({
				index: 'posts',
				id: post._id.toString()
			})

			expect(res.body._source.author.name).toEqual('jake')
		})

		it('should be able to execute a simple query', async function () {
			
			const results = await Post.search({
				query_string: {
					query: 'jake'
				}
			})

			expect(results?.body.hits.total).toEqual(1)
			expect(results?.body.hits.hits[0]._source.body).toEqual('A very short post')
		})

		
		describe('arrays of references', function () {

			it('should correctly index arrays',async function () {

				const post = await Post.findOne({})

				const res = await esClient.get({
					index: 'posts',
					id: post._id.toString()
				})

				const comments = res.body._source.comments

				expect(comments[0].text).toEqual('good post')
				expect(comments[1].text).toEqual('really')
			})

			it('should respect populate options',async function () {

				const post = await Post.findOne({})

				const res = await esClient.get({
					index: 'posts',
					id: post._id.toString()
				})

				const comments = res.body._source.comments

				expect(comments[0].text).toEqual('good post')
				expect(comments[1].author).toBeUndefined()
			})
		})
	})
})
