'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { Aggregate, Hit } from '@elastic/elasticsearch/api/types'
import { PluginDocument } from 'types'

interface IBond extends PluginDocument {
	name: string,
	type: string,
	price: number
}

const BondSchema = new Schema({
	name: String,
	type: {
		type: String,
		default: 'Other Bond'
	},
	price: Number
})

BondSchema.plugin(mongoosastic)

const Bond = mongoose.model<IBond>('Bond', BondSchema)

const bonds = [
	new Bond({
		name: 'Bail',
		type: 'A',
		price: 10000
	}),
	new Bond({
		name: 'Commercial',
		type: 'B',
		price: 15000
	}),
	new Bond({
		name: 'Construction',
		type: 'B',
		price: 20000
	}),
	new Bond({
		name: 'Legal',
		type: 'C',
		price: 30000
	})
]

describe('Query DSL', function () {

	beforeAll(async function(done) {
		await config.deleteIndexIfExists(['bonds'])
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
    
		await Bond.deleteMany()

		for (const bond of bonds) {
			config.saveAndWaitIndex(bond, function() {
				setTimeout(done, config.INDEXING_TIMEOUT)
			})
		}
	})

	afterAll(async function() {
		await Bond.deleteMany()
		await config.deleteIndexIfExists(['bonds'])
		mongoose.disconnect()
	})

	describe('range', function () {
		it('should be able to find within range', function (done) {
			Bond.search({
				range: {
					price: {
						from: 20000,
						to: 30000
					}
				}
			}, function (err, res) {
				expect(res?.body.hits.total).toEqual(2)

				res?.body.hits.hits.forEach(function (bond) {
					expect(['Legal', 'Construction']).toContainEqual(bond._source?.name)
				})

				done()
			})
		})
	})

	describe('Sort', function () {
		const getNames = function (res: Hit<IBond>) {
			return res._source?.name
		}
		const expectedDesc = ['Legal', 'Construction', 'Commercial', 'Bail']
		const expectedAsc = expectedDesc.concat([]).reverse() // clone and reverse

		describe('Simple sort', function () {
			it('should be able to return all data, sorted by name ascending', function (done) {
				Bond.search({
					match_all: {}
				}, {
					sort: 'name.keyword:asc'
				}, function (err, res) {
					expect(res?.body.hits.total).toEqual(4)
					expect(expectedAsc).toEqual(res?.body.hits.hits.map(getNames))
					done()
				})
			})

			it('should be able to return all data, sorted by name descending', function (done) {
				Bond.search({
					match_all: {}
				}, {
					sort: ['name.keyword:desc']
				}, function (err, res) {
					expect(res?.body.hits.total).toEqual(4)
					expect(expectedDesc).toEqual(res?.body.hits.hits.map(getNames))
					done()
				})
			})
		})

		describe('Complex sort', function () {
			it('should be able to return all data, sorted by name ascending', function (done) {
				Bond.search({
					match_all: {}
				}, {
					sort: {
						'name.keyword': {
							order: 'asc'
						}
					}
				}, function (err, res) {
					expect(res?.body.hits.total).toEqual(4)
					expect(expectedAsc).toEqual(res?.body.hits.hits.map(getNames))
					done()
				})
			})

			it('should be able to return all data, sorted by name descending', function (done) {
				Bond.search({
					match_all: {}
				}, {
					sort: {
						'name.keyword': {
							order: 'desc'
						},
						'type.keyword': {
							order: 'asc'
						}
					}
				}, function (err, res) {
					expect(res?.body.hits.total).toEqual(4)
					expect(expectedDesc).toEqual(res?.body.hits.hits.map(getNames))
					done()
				})
			})
		})
	})

	describe('Aggregations', function () {
		describe('Simple aggregation', function () {
			it('should be able to group by term', function (done) {
				Bond.search({
					match_all: {}
				}, {
					aggs: {
						names: {
							terms: {
								field: 'name.keyword'
							}
						}
					}
				}, function (err, res) {
					expect(res?.body.aggregations?.names['buckets' as keyof Aggregate]).toEqual([
						{
							doc_count: 1,
							key: 'Bail'
						},
						{
							doc_count: 1,
							key: 'Commercial'
						},
						{
							doc_count: 1,
							key: 'Construction'
						},
						{
							doc_count: 1,
							key: 'Legal'
						}
					])

					done()
				})
			})
		})
	})

	describe('Fuzzy search', function () {
		it('should do a fuzzy query', function (done) {
			const getNames = function (res: Hit<IBond>) {
				return res._source?.name
			}

			Bond.esSearch({
				query: {
					match: {
						name: {
							query: 'comersial',
							fuzziness: 2
						}
					}
				}
			}, function (err, res) {
				expect(res?.body.hits.total).toEqual(1)
				expect(['Commercial']).toEqual(res?.body.hits.hits.map(getNames))
				done()
			})
		})
	})
})
