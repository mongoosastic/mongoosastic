'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

const esClient = config.getClient()

const GeoSchema = new Schema({
	myId: Number,
	frame: {
		coordinates: [],
		type: {
			type: String
		},
		geo_shape: {
			type: String,
			es_type: 'geo_shape',
			es_tree: 'quadtree',
			es_precision: '1km',
			es_distance_error_pct: '0.001'
		}
	}
})

GeoSchema.plugin(mongoosastic)
const GeoModel = mongoose.model('geodoc', GeoSchema)

const points = [
	new GeoModel({
		myId: 1,
		frame: {
			type: 'envelope',
			coordinates: [[1, 4], [3, 2]]
		}
	}),
	new GeoModel({
		myId: 2,
		frame: {
			type: 'envelope',
			coordinates: [[2, 3], [4, 0]]
		}
	})
]

describe('GeoTest', function () {

	beforeAll(async function(done) {
		jest.setTimeout(10000)
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await GeoModel.deleteMany()
		await config.deleteIndexIfExists(['geodocs'])

		GeoModel.createMapping(done)
	})

	afterAll(async function() {
		await GeoModel.deleteMany()
		await config.deleteIndexIfExists(['geodocs'])
		mongoose.disconnect()
	})

	it('should create a mapping where frame has the type geo_shape', function (done) {
		esClient.indices.getMapping({
			index: 'geodocs'
		}, function (err, mapping) {
			expect(mapping.body.geodocs.mappings.properties.frame.type).toEqual('geo_shape')
			done()
		})
	})

	it('should be able to create and store geo coordinates',async function() {

		for (const point of points) {
			await point.save()
		}

		const res = await GeoModel.find({})

		expect(res.length).toEqual(2)

		expect(res[0].frame.type).toEqual('envelope')

		expect(res[0].frame.coordinates[0]).toEqual([1, 4])
		expect(res[0].frame.coordinates[1]).toEqual([3, 2])
	})

	it('should be able to find geo coordinates in the indexes', function (done) {
		setTimeout(function () {
			// ES request
			GeoModel.search({
				match_all: {}
			}, {
				sort: 'myId:asc'
			}, function (err, res) {
				if (err) throw err

				const frame = res?.body.hits.hits[0]._source.frame

				expect(res?.body.hits.total).toEqual(2)

				expect(frame.type).toEqual('envelope')	
				expect(frame.coordinates).toEqual([[1, 4], [3, 2]])

				done()
			})
		}, config.INDEXING_TIMEOUT)
	})

	it('should be able to resync geo coordinates from the database',async function (done) {
		await config.deleteIndexIfExists(['geodocs'])

		GeoModel.createMapping(function () {
			const stream = GeoModel.synchronize()
			let count = 0

			stream.on('data', function () {
				count++
			})

			stream.on('close', function () {

				expect(count).toEqual(2)

				setTimeout(function () {
					GeoModel.search({
						match_all: {}
					}, {
						sort: 'myId:asc'
					}, function (err, res) {

						const frame = res?.body.hits.hits[0]._source.frame

						expect(res?.body.hits.total).toEqual(2)

						expect(frame.type).toEqual('envelope')	
						expect(frame.coordinates).toEqual([[1, 4], [3, 2]])

						done()
					})
				}, config.INDEXING_TIMEOUT)
			})
		})
	})

	it('should be able to search points inside frames', function (done) {
		const geoQuery = {
			bool: {
				must: {
					match_all: {}
				},
				filter: {
					geo_shape: {
						frame: {
							shape: {
								type: 'point',
								coordinates: [3, 1]
							}
						}
					}
				}
			}
		}

		setTimeout(function () {
			GeoModel.search(geoQuery, {}, function (err1, res1) {

				expect(res1?.body.hits.total).toEqual(1)
				expect(res1?.body.hits.hits[0]._source.myId).toEqual(2)

				geoQuery.bool.filter.geo_shape.frame.shape.coordinates = [1.5, 2.5]

				GeoModel.search(geoQuery, {}, function (err2, res2) {

					expect(res2?.body.hits.total).toEqual(1)
					expect(res2?.body.hits.hits[0]._source.myId).toEqual(1)

					geoQuery.bool.filter.geo_shape.frame.shape.coordinates = [3, 2]

					GeoModel.search(geoQuery, {}, function (err3, res3) {
						
						expect(res3?.body.hits.total).toEqual(2)

						geoQuery.bool.filter.geo_shape.frame.shape.coordinates = [0, 3]

						GeoModel.search(geoQuery, {}, function (err4, res4) {

							expect(res4?.body.hits.total).toEqual(0)
							done()
						})
					})
				})
			})
		}, config.INDEXING_TIMEOUT)
	})

})
