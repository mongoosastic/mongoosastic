'use strict'

import mongoose, { Model, Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { PluginDocument } from 'types'

const indexName = 'es-test'

interface IDummy extends PluginDocument {
    text: string;
}

const DummySchema = new Schema({
	text: String
})
const DummySchemaRefresh = new Schema({
	text: String
})
DummySchema.plugin(mongoosastic, {
	index: indexName,
})
DummySchemaRefresh.plugin(mongoosastic, {
	index: indexName,
	forceIndexRefresh: true
})

const Dummy = mongoose.model<IDummy>('Dummy', DummySchema)
const DummyRefresh = mongoose.model<IDummy>('DummyRefresh', DummySchemaRefresh)

describe('forceIndexRefresh connection option', function () {

	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['indexName'])
		for (const model of [Dummy, DummyRefresh]) {
			await model.deleteMany()
		}
	})

	afterAll(async function() {
		for (const model of [Dummy, DummyRefresh]) {
			await model.deleteMany()
		}
		
		await config.deleteIndexIfExists([indexName])
		mongoose.disconnect()
	})

	it('should always suceed: refresh the index immediately on insert', function (done) {
		const d = new DummyRefresh({ text: 'Text1' })
		const refresh = true

		doInsertOperation(DummyRefresh, d, indexName, refresh, done)
	})

	it('should fail randomly: refresh the index every 1s on insert', function (done) {
		const d = new Dummy({ text: 'Text1' })
		const refresh = false

		doInsertOperation(Dummy, d, indexName, refresh, done)
	})

	it('should always suceed: refresh the index immediately on update', function (done) {
		const d = new DummyRefresh({ text: 'Text1' })
		const refresh = true

		doUpdateOperation(DummyRefresh, d, 'this is the new text', indexName, refresh, done)
	})

	it('should fail randomly: refresh the index every 1s on update', function (done) {
		const d = new Dummy({ text: 'Text1' })
		const refresh = false

		doUpdateOperation(Dummy, d, 'this is the new text', indexName, refresh, done)
	})
})

async function doInsertOperation (Model: Model<IDummy>, object: PluginDocument, indexName: string, refresh: boolean, callback: CallableFunction) {
	// save object
	const savedObject = await object.save()

	savedObject.on('es-indexed', function () {
		// look for the object just saved
		Model.search({
			term: { _id: savedObject._id }
		}, function (err, results) {
			if (refresh) {
				expect(results?.body.hits.total).toEqual(1)
			} else {
				expect(results?.body.hits.total).toEqual(0)
			}
			callback()
		})
	})
}

async function doUpdateOperation (Model: Model<IDummy>, object: PluginDocument, newText: string, indexName: string, refresh: boolean, callback: CallableFunction) {
	// save object
	const savedObject = await object.save()

	const updatedObject = await Model.findOneAndUpdate({ _id: savedObject._id }, { text: newText }, { new: true })

	updatedObject?.on('es-indexed', function () {
		// look for the object just saved
		Model.search({
			term: { _id: savedObject._id }
		}, function (err, results) {
			if (refresh) {
				const hit = results?.body.hits.hits[0]._source
				expect(results?.body.hits.total).toEqual(1)
				expect(hit?.text).toEqual(newText)
			} else {
				expect(results?.body.hits.total).toEqual(0)
			}
			callback()
		})
	})
}
