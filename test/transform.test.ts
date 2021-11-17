import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IRepo extends MongoosasticDocument {
  name: string,
  settingLicense: string,
  detectedLicense: string,
}

// -- Only index specific field
const RepoSchema = new Schema({
  name: {
    type: String,
    es_indexed: true
  },
  settingLicense: {
    type: String
  },
  detectedLicense: {
    type: String
  }
})

RepoSchema.plugin(mongoosastic, {
  transform: function (data: Record<string, unknown>, repo: IRepo) {
    data.license = repo.settingLicense || repo.detectedLicense
    return data
  }
})

const Repo = mongoose.model<IRepo, MongoosasticModel<IRepo>>('Repo', RepoSchema)

describe('Transform mode', function () {

  beforeAll(async function () {
    await config.deleteIndexIfExists(['repos'])
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Repo.deleteMany()
  })

  afterAll(async function () {
    await Repo.deleteMany()
    await config.deleteIndexIfExists(['repos'])
    await mongoose.disconnect()
  })

  it('should index with field "fullTitle"', async function () {

    await config.createModelAndEnsureIndex(Repo, {
      name: 'LOTR',
      settingLicense: '',
      detectedLicense: 'Apache'
    })

    const results = await Repo.search({
      query_string: {
        query: 'Apache'
      }
    })

    expect(results?.body.hits.total).toEqual(1)
  })
})
