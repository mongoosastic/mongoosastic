import mongoose, { Schema, HydratedDocument } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel, Options } from '../lib/types'
import { config } from './config'

interface IPhone extends MongoosasticDocument {
  name: string,
  created: Date
}

// -- Only index specific field
const PhoneSchema = new Schema({
  name: {
    type: String,
    es_indexed: true
  }
})

PhoneSchema.plugin(mongoosastic, {
  transform: function (data: Record<string, unknown>, phone: HydratedDocument<IPhone>) {
    if (phone.name === 'Nokia 3310') {
      data.created = 'invalid value'
    } else {
      data.created = new Date(phone._id.generationTime * 1000)
    }
    return data
  },
  properties: {
    created: {
      type: 'date'
    }
  },
} as Options)

const Phone = mongoose.model<IPhone, MongoosasticModel<IPhone>>('Phone', PhoneSchema)

describe('Custom Properties for Mapping', function () {

  beforeEach(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Phone.deleteMany()
    await config.deleteIndexIfExists(['phones'])

    await Phone.createMapping()
  })

  afterEach(async function () {
    await Phone.deleteMany()
    await config.deleteIndexIfExists(['phones'])
    await mongoose.disconnect()
  })

  it('should index with field "created"', async function () {

    await Phone.createMapping()

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

  it('should fail index if value for field "created" is the wrong type', async function () {

    await Phone.createMapping()

    await expect(
      config.createModelAndEnsureIndex(Phone, {
        name: 'Nokia 3310'
      })
    ).rejects.toThrow('Reason: failed to parse field [created] of type [date]')
  })
})
