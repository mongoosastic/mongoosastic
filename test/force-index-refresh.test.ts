'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from 'types'

const indexName = 'es-test'

interface IDummy extends MongoosasticDocument {
    text: string;
}

const DummySchema = new Schema<IDummy>({
	text: String
})
const DummySchemaRefresh = new Schema<IDummy>({
	text: String
})
DummySchema.plugin(mongoosastic, {
	index: indexName,
})
DummySchemaRefresh.plugin(mongoosastic, {
	index: indexName,
	forceIndexRefresh: true
})

const Dummy = mongoose.model<IDummy, MongoosasticModel<IDummy>>('Dummy', DummySchema)
const DummyRefresh = mongoose.model<IDummy, MongoosasticModel<IDummy>>('DummyRefresh', DummySchemaRefresh)

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

	it('should always suceed: refresh the index immediately on insert', async function() {
		const d = new DummyRefresh({ text: 'Text1' })
		const refresh = true

		await doInsertOperation(DummyRefresh, d, indexName, refresh)
	})

	it('should fail randomly: refresh the index every 1s on insert', async function() {
		const d = new Dummy({ text: 'Text1' })
		const refresh = false

		await doInsertOperation(Dummy, d, indexName, refresh)
	})

	it('should always suceed: refresh the index immediately on update', async function() {
		const d = new DummyRefresh({ text: 'Text1' })
		const refresh = true

		await doUpdateOperation(DummyRefresh, d, 'this is the new text', indexName, refresh)
	})

	it('should fail randomly: refresh the index every 1s on update', async function() {
		const d = new Dummy({ text: 'Text1' })
		const refresh = false

		await doUpdateOperation(Dummy, d, 'this is the new text', indexName, refresh)
	})
})

async function doInsertOperation (Model: MongoosasticModel<IDummy>, object: MongoosasticDocument, indexName: string, refresh: boolean) {
	// save object
	const savedObject = await object.save()

	await new Promise((resolve) => {
		savedObject.on('es-indexed', resolve)
	})

	// look for the object just saved
	const results = await Model.search({
		term: { _id: savedObject._id }
	})

	if (refresh) {
		expect(results?.body.hits.total).toEqual(1)
	} else {
		expect(results?.body.hits.total).toEqual(0)
	}
}

async function doUpdateOperation (Model: MongoosasticModel<IDummy>, object: MongoosasticDocument, newText: string, indexName: string, refresh: boolean) {
	// save object
	const savedObject = await object.save()

	const updatedObject = await Model.findOneAndUpdate({ _id: savedObject._id }, { text: newText }, { new: true })

	await new Promise((resolve) => {
		updatedObject?.on('es-indexed', resolve)
	})

	const results = await Model.search({
		term: { _id: savedObject._id }
	})

	if (refresh) {
		const hit = results?.body.hits.hits[0]._source
		expect(results?.body.hits.total).toEqual(1)
		expect(hit?.text).toEqual(newText)
	} else {
		expect(results?.body.hits.total).toEqual(0)
	}
}
