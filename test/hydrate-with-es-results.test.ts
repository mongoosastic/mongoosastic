'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { PluginDocument } from 'types'

interface IText extends PluginDocument {
	title: string,
	quote: string
}

const textSchema = new Schema({
	title: String,
	quote: String
})

textSchema.plugin(mongoosastic)

const Text = mongoose.model<IText>('text', textSchema)

const texts = [
	new Text({
		title: 'The colour of magic',
		quote: 'The only reason for walking into the jaws of Death is so\'s you can steal his gold teeth'
	}),
	new Text({
		title: 'The Light Fantastic',
		quote: 'The death of the warrior or the old man or the little child, this I understand, and I take ' +
'away the pain and end the suffering. I do not understand this death-of-the-mind'
	}),
	new Text({
		title: 'Equal Rites',
		quote: 'Time passed, which, basically, is its job'
	}),
	new Text({
		title: 'Mort',
		quote: 'You don\'t see people at their best in this job, said Death.'
	})
]

describe('Hydrate with ES data', function () {

	beforeAll(async function(done) {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['texts'])
		await Text.deleteMany()

		for (const text of texts) {
			config.saveAndWaitIndex(text, function() {
				setTimeout(done, config.INDEXING_TIMEOUT)
			})
		}
	})

	afterAll(async function () {
		await Text.deleteMany()
		await config.deleteIndexIfExists(['texts'])
		mongoose.disconnect()
	})

	describe('Hydrate without adding ES data', function () {
		it('should return simple objects', async function () {

			const res = await Text.search({
				match_phrase: {
					quote: 'Death'
				}
			}, {
				hydrate: true
			})

			expect(res?.body.hits.total).toEqual(3)

			res?.body.hits.hits.forEach(function (text) {
				expect(text).not.toHaveProperty('_esResult')
			})
		})
	})

	describe('Hydrate and add ES data', function () {
		it('should return object enhanced with _esResult', async function () {
			
			const res = await Text.search({
				match_phrase: {
					quote: 'Death'
				}
			}, {
				hydrate: true,
				hydrateWithESResults: true,
				highlight: {
					fields: {
						quote: {}
					}
				}
			})

			expect(res?.body.hits.total).toEqual(3)

			res?.body.hits.hydrated.forEach(function (text) {
				expect(text).toHaveProperty('_esResult')

				expect(text._esResult).toHaveProperty('_index')
				expect(text._esResult?._index).toEqual('texts')

				expect(text._esResult).toHaveProperty('_id')
				expect(text._esResult).toHaveProperty('_type')
				expect(text._esResult).toHaveProperty('_score')
				expect(text._esResult).toHaveProperty('highlight')

				expect(text._esResult).not.toHaveProperty('_source')
			})
		})

		it('should remove _source object', async function () {
			
			const res = await Text.search({
				match_phrase: {
					quote: 'Death'
				}
			}, {
				hydrate: true,
				hydrateWithESResults: { source: true },
				highlight: {
					fields: {
						quote: {}
					}
				}
			})

			expect(res?.body.hits.total).toEqual(3)

			res?.body.hits.hydrated.forEach(function (text) {
				expect(text).toHaveProperty('_esResult')

				expect(text._esResult).toHaveProperty('_index')
				expect(text._esResult?._index).toEqual('texts')

				expect(text._esResult).toHaveProperty('_id')
				expect(text._esResult).toHaveProperty('_type')
				expect(text._esResult).toHaveProperty('_score')
				expect(text._esResult).toHaveProperty('highlight')

				expect(text._esResult).toHaveProperty('_source')
				expect(text._esResult?._source).toHaveProperty('title')
			})
		})
	})
})
