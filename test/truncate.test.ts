import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IDummy extends MongoosasticDocument {
  text: string
}

const DummySchema = new Schema({
  text: String
})

DummySchema.plugin(mongoosastic)

const Dummy = mongoose.model<IDummy, MongoosasticModel<IDummy>>('DummyTruncate', DummySchema)

describe('Truncate', function () {
  beforeAll(async function () {

    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Dummy.deleteMany()
    await config.deleteIndexIfExists(['dummytruncates'])

    await config.createModelAndEnsureIndex(Dummy, {
      text: 'Text1'
    })

  })

  afterAll(async function () {
    await Dummy.deleteMany()
    await config.deleteIndexIfExists(['dummytruncates'])
    await mongoose.disconnect()
  })

  describe('esTruncate', function () {

    it('should be able to truncate all documents', async function () {

      await Dummy.esTruncate()
      await config.sleep(config.INDEXING_TIMEOUT)

      const results = await Dummy.search({
        query_string: {
          query: 'Text1'
        }
      })

      expect(results?.body.hits.total).toEqual(0)
    })

  })
})
