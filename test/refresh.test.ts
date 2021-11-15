import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IRefresh extends MongoosasticDocument {
  title: string
}

const RefreshSchema = new Schema<MongoosasticDocument>({
  title: String
})

RefreshSchema.plugin(mongoosastic)

const Refresh = mongoose.model<IRefresh, MongoosasticModel<IRefresh>>('Refresh', RefreshSchema)

describe('Refresh', function () {

  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Refresh.deleteMany()
    await config.deleteIndexIfExists(['refreshes'])

    await Refresh.createMapping()
  })

  afterAll(async function () {
    await Refresh.deleteMany()
    await config.deleteIndexIfExists(['refreshes'])
    await mongoose.disconnect()
  })

  it('should be able to search for the element after refresh', async function () {

    const refresh = new Refresh({ title: `${Date.now()}` })

    await config.saveAndWaitIndex(refresh)

    await Refresh.refresh()
    await config.sleep(config.INDEXING_TIMEOUT)

    const res = await Refresh.search({
      match_all: {}
    })

    expect(res?.body.hits.total).toEqual(1)
  })
})
