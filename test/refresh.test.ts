'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'

const RefreshSchema = new Schema({
	title: String
})

RefreshSchema.plugin(mongoosastic)

const Refresh = mongoose.model('Refresh', RefreshSchema)

describe('Refresh', function () {
  
	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await Refresh.deleteMany()
		await config.deleteIndexIfExists(['refreshes'])
	})

	afterAll(async function() {
		await Refresh.deleteMany()
		await config.deleteIndexIfExists(['refreshes'])
		mongoose.disconnect()
	})

	it('should be able to search for the element after refresh', function(done) {

		Refresh.createMapping(function(){
			const refresh = new Refresh({ title: `${Date.now()}` })

			config.saveAndWaitIndex(refresh, function(){
				
				Refresh.refresh(function(){
					setTimeout(function () {
						Refresh.search({
							match_all: {}
						}, {}, function (err, res) {
							expect(res?.body.hits.total).toEqual(1)
							done()
						})
					}, config.INDEXING_TIMEOUT)
				})
			})
		})

	})
})
