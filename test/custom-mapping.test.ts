import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel, Options } from '../lib/types'

interface IPhone extends MongoosasticDocument {
	name: string,
	created: Date
}

// -- Only index specific field
const PhoneSchema = new Schema<MongoosasticDocument>({
	name: {
		type: String,
		es_indexed: true
	}
})

PhoneSchema.plugin(mongoosastic, {
	transform: function (data, phone) {
		data.created = new Date(phone._id.generationTime * 1000)
		return data
	},
	customProperties: {
		created: {
			type: 'date'
		}
	},
} as Options)

const Phone = mongoose.model<IPhone, MongoosasticModel<IPhone>>('Phone', PhoneSchema)

describe('Custom Properties for Mapping', function () {

	beforeAll(async function() {
		await mongoose.connect(config.mongoUrl, config.mongoOpts)
		await Phone.deleteMany()
		await config.deleteIndexIfExists(['phones'])
	})

	afterAll(async function() {
		await Phone.deleteMany()
		await config.deleteIndexIfExists(['phones'])
		mongoose.disconnect()
	})

	it('should index with field "created"', async function() {
		
		await config.createModelAndEnsureIndex(Phone, {
			name: 'iPhone'
		})

		const results = await Phone.search({
			query_string: {
				query: 'iPhone'
			}
		}, {
			sort: 'created:asc'
		})

		const hit = results?.body.hits.hits[0]._source
	
		expect(results?.body.hits.total).toEqual(1)
		expect(hit?.created).toBeDefined()
	})
})
