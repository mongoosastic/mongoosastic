'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

interface ITask {
	content: string
}

const TaskSchema = new Schema({
	content: String
})

TaskSchema.plugin(mongoosastic, {
	routing: function (doc: ITask) {
		return doc.content
	}
})

const Task = mongoose.model('Task', TaskSchema)

describe('Routing', function () {

	beforeAll(async function () {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['tasks'])
		await Task.deleteMany()
	})

	afterAll(async function () {
		await Task.deleteMany()
		await config.deleteIndexIfExists(['tasks'])
		mongoose.disconnect()
	})

	it('should found task if no routing',async function(done) {

		config.createModelAndEnsureIndex(Task, { content: Date.now() }, function(err: unknown, task: ITask){
			Task.search({
				query_string: {
					query: task.content
				}
			}, {}, function (err, results) {
				expect(results?.body.hits.total).toEqual(1)
				done(err)
			})
		})
	})

	it('should found task if routing with task.content', async function(done) {

		config.createModelAndEnsureIndex(Task, { content: Date.now() }, function(err: unknown, task: ITask){
			Task.search({
				query_string: {
					query: task.content
				}
			}, {
				routing: task.content
			}, function (err, results) {
				expect(results?.body.hits.total).toEqual(1)
				expect(results?.body._shards.total).toEqual(1)
				done(err)
			})
		})
	})

	it('should not found task if routing with invalid routing',async function(done) {
		
		config.createModelAndEnsureIndex(Task, { content: Date.now() }, function(err: unknown, task: ITask){
			Task.search({
				query_string: {
					query: task.content
				}
			}, {
				routing: task.content + 1
			}, function (err, results) {
				expect(results?.body._shards.total).toEqual(1)
				done(err)
			})
		})
	})

	it('should not found task after remove',async function(done) {
		const task = await Task.create({ content: Date.now() })
		
		await task.remove()

		setTimeout(() => {
			Task.search({
				query_string: {
					query: task.content
				}
			}, {}, (err, results) => {
				expect(results?.body.hits.total).toEqual(0)
				done()
			})
		}, config.INDEXING_TIMEOUT)
	})

	it('should not found task after unIndex',async function(done) {
		const task = await Task.create({ content: Date.now() })
		
		task.unIndex(function(){
			Task.search({
				query_string: {
					query: task.content
				}
			}, {}, (err, results) => {
				expect(results?.body.hits.total).toEqual(0)
				done()
			})
		})
	})

	it('should not found task after esTruncate',async function(done) {
		const task = await Task.create({ content: Date.now() })
		
		Task.esTruncate(function(){
			Task.search({
				query_string: {
					query: task.content
				}
			}, {}, (err, results) => {
				expect(results?.body.hits.total).toEqual(0)
				done()
			})
		})
	})
})
