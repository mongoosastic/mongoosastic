'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { PluginDocument } from 'types'

interface IText extends PluginDocument {
	title: string,
	quote: string
}

const TextSchema = new Schema({
	title: String,
	quote: String
})

TextSchema.plugin(mongoosastic)

const Text = mongoose.model<IText>('Text', TextSchema)

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

describe('Highlight search', function () {

	const responses = [
		'You don\'t see people at their best in this job, said <em>Death</em>.',
		'The <em>death</em> of the warrior or the old man or the little child, this I understand, and I take away the pain',
		'I do not understand this <em>death</em>-of-the-mind',
		'The only reason for walking into the jaws of <em>Death</em> is so\'s you can steal his gold teeth'
	]

	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['texts'])
		await Text.deleteMany()

		for (const text of texts) {
			await text.save()
		}

		await config.sleep(config.BULK_ACTION_TIMEOUT)
	})

	afterAll(async function () {
		await Text.deleteMany()
		await config.deleteIndexIfExists(['texts'])
		mongoose.disconnect()
	})

	describe('Highlight without hydrating', function () {
		it('should return highlighted text on every hit result', async function () {

			const res = await Text.search({
				match_phrase: {
					quote: 'Death'
				}
			}, {
				highlight: {
					fields: {
						quote: {}
					}
				}
			})

			expect(res?.body.hits.total).toEqual(3)
	
			res?.body.hits.hits.forEach(function (text) {
				expect(text).toHaveProperty('highlight')
				expect(text.highlight).toHaveProperty('quote')
	
				text.highlight?.quote.forEach(function (query) {
					expect(responses).toContainEqual(query)
				})
			})
		})
	})

	describe('Highlight hydrated results', function () {
		it('should return highlighted text on every resulting document', async function () {

			const res = await Text.search({
				match_phrase: {
					quote: 'Death'
				}
			}, {
				hydrate: true,
				highlight: {
					fields: {
						quote: {}
					}
				}
			})

			expect(res?.body.hits.total).toEqual(3)
	
			res?.body.hits.hydrated.forEach(function (text) {
				expect(text).toHaveProperty('_highlight')
				expect(text._highlight).toHaveProperty('quote')
	
				text._highlight?.quote.forEach(function (query) {
					expect(responses).toContainEqual(query)
				})
			})
		})
	})
})
