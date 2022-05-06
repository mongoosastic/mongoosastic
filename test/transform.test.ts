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

// -- Index with async transform function
const PodcastSchema = new Schema({name: {type: String, es_indexed: true}})

PodcastSchema.plugin(mongoosastic, {
  transform: async function (data: Record<string, unknown>) {
    data.name = await new Promise(
      resolve => setTimeout(
        () => resolve('Qwerpline'),
        50
      )
    )
    return data
  }
})

const Podcast = mongoose.model<IRepo, MongoosasticModel<IRepo>>('Podcast', PodcastSchema)

describe('Transform mode', function () {

  beforeAll(async function () {
    await config.deleteIndexIfExists(['repos', 'podcasts'])
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Repo.deleteMany()
    await Podcast.deleteMany()
  })

  afterAll(async function () {
    await Repo.deleteMany()
    await Podcast.deleteMany()
    await config.deleteIndexIfExists(['repos', 'podcasts'])
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

  it('should wait for promise if transform is async', async function () {

    await config.createModelAndEnsureIndex(Podcast, {
      name: 'The Fitzroy Diaries'
    })

    const results = await Podcast.search({
      query_string: {
        query: 'Qwerpline'
      }
    })

    expect(results?.body.hits.total).toEqual(1)
  })
})
