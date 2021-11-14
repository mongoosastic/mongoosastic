import { Client } from '@elastic/elasticsearch'
import { toInteger } from 'lodash'
import { Model } from 'mongoose'
import { MongoosasticDocument } from '../lib/types'

const esClient = new Client({ node: 'http://localhost:9200' })

const INDEXING_TIMEOUT: number = toInteger(process.env.INDEXING_TIMEOUT) || 2000
const BULK_ACTION_TIMEOUT: number = toInteger(process.env.BULK_ACTION_TIMEOUT) || 4000

function sleep(time: number): Promise<unknown> {
	return new Promise((resolve) => setTimeout(resolve, time))
}

async function deleteIndexIfExists(indexes: Array<string>): Promise<void> {
	for (const index of indexes) {
		const { body } = await esClient.indices.exists({ index: index })
		if(body) await esClient.indices.delete({ index: index })
	}
}

async function deleteDocs<T extends MongoosasticDocument>(models: Array<Model<T>>): Promise<void> {
	for (const model of models) {
		await model.deleteMany()
	}
}

async function createModelAndEnsureIndex<T extends MongoosasticDocument>(Model: Model<T>, obj: unknown): Promise<T> {
	const doc = new Model(obj)
	await doc.save()

	return new Promise((resolve) => {
		doc.on('es-indexed', async function () {
			await sleep(INDEXING_TIMEOUT)
			resolve(doc)
		})
	})
}

async function createModelAndSave<T extends MongoosasticDocument>(Model: Model<T>, obj: unknown): Promise<T> {
	const dude = new Model(obj)
	return await dude.save()
}

async function saveAndWaitIndex(doc: MongoosasticDocument): Promise<void> {
	await doc.save()

	return new Promise((resolve) => {
		doc.once('es-indexed', resolve)
		doc.once('es-filtered', resolve)
	})
}

function bookTitlesArray(): Array<string> {
	const books = [
		'American Gods',
		'Gods of the Old World',
		'American Gothic'
	]
	let idx
	for (idx = 0; idx < 50; idx++) {
		books.push('Random title ' + idx)
	}
	return books
}

export const config = {
	mongoUrl: 'mongodb://localhost/mongoosastic-test',
	mongoOpts: {
		useNewUrlParser: true,
		useFindAndModify: false,
		useUnifiedTopology: true
	},
	INDEXING_TIMEOUT,
	BULK_ACTION_TIMEOUT,
	sleep,
	deleteIndexIfExists,
	deleteDocs,
	createModelAndEnsureIndex,
	createModelAndSave,
	saveAndWaitIndex,
	bookTitlesArray,
	getClient: function(): Client {
		return esClient
	},
}

