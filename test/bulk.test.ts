import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IBook extends MongoosasticDocument {
  title: string
}

const BookSchema = new Schema({
  title: String
})

BookSchema.plugin(mongoosastic, {
  bulk: {
    size: 100,
    delay: 1000
  }
})

const Book = mongoose.model<IBook, MongoosasticModel<IBook>>('Book', BookSchema)

describe('Bulk mode', function () {

  beforeAll(async function () {
    await config.deleteIndexIfExists(['books'])
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Book.deleteMany()

    for (const title of config.bookTitlesArray()) {
      await new Book({ title: title }).save()
    }

    const book = await Book.findOne({ title: 'American Gods' })
    if (book) {
      await book.remove()
    }
  })

  afterAll(async function () {
    await config.deleteIndexIfExists(['books'])
    await Book.deleteMany()
    await mongoose.disconnect()
  })

  it('should index all objects and support deletions too', async function () {
    // This timeout is important, as Elasticsearch is "near-realtime" and the index/deletion takes time that
    // needs to be taken into account in these tests
    await config.sleep(config.BULK_ACTION_TIMEOUT)

    const results = await Book.search({
      match_all: {}
    })

    expect(results).toHaveProperty('body')
    expect(results?.body).toHaveProperty('hits')
    expect(results?.body.hits).toHaveProperty('total', 52)
  })
})
