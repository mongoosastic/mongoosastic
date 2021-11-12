'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { QueryContainer } from '@elastic/elasticsearch/api/types'
import { MongoosasticDocument, MongoosasticModel } from 'types'

const GeoBoundingBoxSchema = new Schema<MongoosasticDocument>({
	text: {
		type: String,
		es_indexed: true
	},
	geo_with_lat_lon: {
		geo_point: {
			type: String,
			es_type: 'geo_point',
			es_indexed: true
		},
		lat: { type: Number },
		lon: { type: Number }
	}
})

GeoBoundingBoxSchema.plugin(mongoosastic)
const GeoBoundingBoxModel = mongoose.model<MongoosasticDocument, MongoosasticModel<MongoosasticDocument>>('geoboundingdoc', GeoBoundingBoxSchema)

const points = [
	new GeoBoundingBoxModel({
		text: '1',
		geo_with_lat_lon: {
			lat: 41.12,
			lon: -71.34
		}
	}),
	new GeoBoundingBoxModel({
		text: '2',
		geo_with_lat_lon: {
			lat: 40.12,
			lon: -71.34
		}
	}),
	new GeoBoundingBoxModel({
		text: '3',
		geo_with_lat_lon: {
			lat: 41,
			lon: -73
		}
	})
]

describe('Geo Bounding Box Test', function () {

	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await GeoBoundingBoxModel.deleteMany()
		await config.deleteIndexIfExists(['geoboundingdocs'])

		await GeoBoundingBoxModel.createMapping()
	})

	afterAll(async function() {
		await GeoBoundingBoxModel.deleteMany()
		await config.deleteIndexIfExists(['geoboundingdocs'])
		mongoose.disconnect()
	})

	it('should be able to create and store geo coordinates',async function() {

		for (const point of points) {
			await point.save()
		}
		await config.sleep(config.INDEXING_TIMEOUT)

		const res = await GeoBoundingBoxModel.find({})
		expect(res.length).toEqual(3)

	})

	it('should be able to find geo coordinates in the indexes', async function () {
		// ES request
		const res = await GeoBoundingBoxModel.search({
			match_all: {}
		})

		expect(res?.body.hits.total).toEqual(3)
	})

	it('should be able to resync geo coordinates from the database',async function (done) {
		
		await config.deleteIndexIfExists(['geoboundingdocs'])

		await GeoBoundingBoxModel.createMapping()

		const stream = GeoBoundingBoxModel.synchronize()
		let count = 0

		stream.on('data', function () {
			count++
		})

		stream.on('close', async function () {

			expect(count).toEqual(3)

			await config.sleep(config.INDEXING_TIMEOUT)

			const res = await GeoBoundingBoxModel.search({
				match_all: {}
			})

			expect(res?.body.hits.total).toEqual(3)
			done()
		})

	})

	it('should be able to search bounding box', async function () {
		const geoQuery = {
			bool: {
				must: {
					match_all: {}
				},
				filter: {
					geo_bounding_box: {
						geo_with_lat_lon: {
							top_left: {
								lat: 42,
								lon: -72
							},
							bottom_right: {
								lat: 40,
								lon: -74
							}
						}
					}
				}
			}
		}

		await config.sleep(config.INDEXING_TIMEOUT)
		const res = await GeoBoundingBoxModel.search(geoQuery as QueryContainer)

		expect(res?.body.hits.total).toEqual(2)
	})
})
