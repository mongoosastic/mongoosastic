import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'
import { Tweet } from './models/tweet'

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
    await config.deleteIndexIfExists(['books', 'tweets'])
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Book.deleteMany()
    await Tweet.deleteMany()

    for (const title of config.bookTitlesArray()) {
      await new Book({ title: title }).save()
    }

    const book = await Book.findOne({ title: 'American Gods' })
    if (book) {
      await book.remove()
    }
  })

  afterAll(async function () {
    await config.deleteIndexIfExists(['books', 'tweets'])
    await Book.deleteMany()
    await Tweet.deleteMany()
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

  it('should be able to catch the error if exists', async function () {

    const errorMessage = 'Some bulk error!'

    const esClient = Book.esClient()
    esClient.bulk = jest.fn().mockRejectedValueOnce(new Error(errorMessage))

    const bulkError = Book.bulkError()

    bulkError.on('error', (error: Error) => {
      expect(error.message).toEqual(errorMessage)
    })

    await Book.flush()
  })

  it('should be able to catch the error if one of the indexes thrown an error', async function () {

    const errorMessage = 'Some bulk error!'

    const esClient = Tweet.esClient()
    esClient.bulk = jest.fn().mockResolvedValueOnce({
      body: {
        items: [
          {
            index: {
              error: errorMessage
            }
          }
        ]
      }
    })

    const bulkError = Tweet.bulkError()

    bulkError.on('error', (error: Error, index: unknown) => {
      expect(index).toBeTruthy()
    })

    await Tweet.flush()
  })
})
