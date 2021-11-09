'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { QueryContainer } from '@elastic/elasticsearch/api/types'

const GeoBoundingBoxSchema = new Schema({
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
const GeoBoundingBoxModel = mongoose.model('geoboundingdoc', GeoBoundingBoxSchema)

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

	beforeAll(async function(done) {
		jest.setTimeout(10000)
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await GeoBoundingBoxModel.deleteMany()
		await config.deleteIndexIfExists(['geoboundingdocs'])

		GeoBoundingBoxModel.createMapping(done)
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

		const res = await GeoBoundingBoxModel.find({})

		expect(res.length).toEqual(3)

	})

	it('should be able to find geo coordinates in the indexes', function (done) {
		setTimeout(function () {
			// ES request
			GeoBoundingBoxModel.search({
				match_all: {}
			}, {}, function (err, res) {
				expect(res?.body.hits.total).toEqual(3)
				done()
			})
		}, config.INDEXING_TIMEOUT)
	})

	it('should be able to resync geo coordinates from the database',async function (done) {
		
		await config.deleteIndexIfExists(['geoboundingdocs'])

		GeoBoundingBoxModel.createMapping(function () {
			const stream = GeoBoundingBoxModel.synchronize()
			let count = 0

			stream.on('data', function () {
				count++
			})

			stream.on('close', function () {

				expect(count).toEqual(3)

				setTimeout(function () {
					GeoBoundingBoxModel.search({
						match_all: {}
					}, function (err, res) {
						expect(res?.body.hits.total).toEqual(3)
						done()
					})
				}, config.INDEXING_TIMEOUT)
			})
		})

	})

	it('should be able to search bounding box', function (done) {
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

		setTimeout(function () {
			GeoBoundingBoxModel.search(geoQuery as QueryContainer, function (err, res) {
				expect(res?.body.hits.total).toEqual(2)
				done()
			})
		}, config.INDEXING_TIMEOUT)
	})
})
