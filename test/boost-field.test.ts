import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

const esClient = config.getClient()

const TweetSchema = new Schema({
  user: String,
  post_date: {
    type: Date,
    es_type: 'date'
  },
  message: {
    type: String
  },
  title: {
    type: String,
    es_boost: 2.0
  }
})

TweetSchema.plugin(mongoosastic)

const BlogPost = mongoose.model<MongoosasticDocument, MongoosasticModel<MongoosasticDocument>>('BlogPost', TweetSchema)

describe('Add Boost Option Per Field', function () {

  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await BlogPost.deleteMany()
    await config.deleteIndexIfExists(['blogposts'])
  })

  afterAll(async function () {
    await BlogPost.deleteMany()
    await config.deleteIndexIfExists(['blogposts'])
    await mongoose.disconnect()
  })

  it('should create a mapping with boost field added', async function () {
    await BlogPost.createMapping()

    const mapping = await esClient.indices.getMapping({
      index: 'blogposts'
    })

    const props = mapping.body.blogposts.mappings.properties

    expect(props.title.type).toEqual('text')
    expect(props.title.boost).toEqual(2.0)
  })
})
