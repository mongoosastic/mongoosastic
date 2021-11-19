import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IComment extends MongoosasticDocument {
  user: string,
  post_date: Date,
  message: string,
  title: string
}

const CommentSchema = new Schema({
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

CommentSchema.plugin(mongoosastic, {
  bulk: {
    size: 2,
    delay: 100
  }
})

const Comment = mongoose.model<IComment, MongoosasticModel<IComment>>('Comment', CommentSchema)

const comments = [
  {
    user: 'terry',
    title: 'Ilikecars'
  },
  {
    user: 'fred',
    title: 'Ihatefish'
  }
]

describe('Count', function () {
  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Comment.deleteMany()
    await config.deleteIndexIfExists(['comments'])

    await Comment.insertMany(comments)
    await config.sleep(config.BULK_ACTION_TIMEOUT)
  })

  afterAll(async function () {
    await Comment.deleteMany()
    await config.deleteIndexIfExists(['comments'])
    await mongoose.disconnect()
  })

  it('should count a type', async function () {
    const results = await Comment.esCount({
      term: {
        user: 'terry'
      }
    })

    const body = results?.body
    expect(body?.count).toEqual(1)
  })

  it('should count a type without query', async function () {
    const results = await Comment.esCount()

    const body = results?.body
    expect(body?.count).toEqual(2)
  })
})
