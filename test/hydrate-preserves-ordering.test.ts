'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { PluginDocument } from 'types'

interface IRank extends PluginDocument {
	title: string,
	rank: number
}

const rankSchema = new Schema({
	title: String,
	rank: Number
})

rankSchema.plugin(mongoosastic)

const RankModel = mongoose.model<IRank>('rank', rankSchema)

const esResultTexts = [
	new RankModel({
		title: 'The colour of magic',
		rank: 2
	}),
	new RankModel({
		title: 'The Light Fantastic',
		rank: 4
	}),
	new RankModel({
		title: 'Equal Rites',
		rank: 0
	})
]

describe('Hydrate with ES data', function () {

	beforeAll(async function(done) {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await config.deleteIndexIfExists(['ranks'])
		await RankModel.deleteMany()

		for (const result of esResultTexts) {
			config.saveAndWaitIndex(result, function() {
				setTimeout(done, config.INDEXING_TIMEOUT)
			})
		}
	})

	afterAll(async function () {
		await RankModel.deleteMany()
		await config.deleteIndexIfExists(['ranks'])
		mongoose.disconnect()
	})

	describe('Preserve ordering from MongoDB on hydration', function () {
		it('should return an array of objects ordered \'desc\' by MongoDB', async function () {

			const res = await RankModel.esSearch({}, {
				hydrate: true,
				hydrateOptions: { sort: '-rank' }
			})
			
			const hits = res?.body.hits.hydrated

			expect(res?.body.hits.total).toEqual(3)

			expect(hits[0].rank).toEqual(4)
			expect(hits[1].rank).toEqual(2)
			expect(hits[2].rank).toEqual(0)
		})

		it('should return an array of objects ordered \'asc\' by MongoDB', async function () {

			const res = await RankModel.esSearch({}, {
				hydrate: true,
				hydrateOptions: { sort: 'rank' }
			})

			const hits = res?.body.hits.hydrated

			expect(res?.body.hits.total).toEqual(3)

			expect(hits[0].rank).toEqual(0)
			expect(hits[1].rank).toEqual(2)
			expect(hits[2].rank).toEqual(4)
		})
	})

	describe('Preserve ordering from ElasticSearch on hydration', function () {
		it('should return an array of objects ordered \'desc\' by ES', async function () {

			const res = await RankModel.esSearch({
				sort: [{
					rank: {
						order: 'desc'
					}
				}]
			}, {
				hydrate: true,
				hydrateOptions: { sort: undefined }
			})

			const hits = res?.body.hits.hydrated as IRank[]

			expect(res?.body.hits.total).toEqual(3)

			expect(hits[0].rank).toEqual(4)
			expect(hits[1].rank).toEqual(2)
			expect(hits[2].rank).toEqual(0)
		})

		it('should return an array of objects ordered \'asc\' by ES', async function () {

			const res = await RankModel.esSearch({
				sort: [{
					rank: {
						order: 'asc'
					}
				}]
			}, {
				hydrate: true,
				hydrateOptions: { sort: undefined }
			})

			const hits = res?.body.hits.hydrated

			expect(res?.body.hits.total).toEqual(3)

			expect(hits[0].rank).toEqual(0)
			expect(hits[1].rank).toEqual(2)
			expect(hits[2].rank).toEqual(4)

		})
	})

})
