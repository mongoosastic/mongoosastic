import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IBook extends MongoosasticDocument {
  title: string,
}

const BookSchema = new Schema({
  title: {
    type: String,
    required: true
  }
})

BookSchema.plugin(mongoosastic)

const Book = mongoose.model<IBook, MongoosasticModel<IBook>>('Book', BookSchema)

describe('bulkAdd', () => {

  let books

  beforeAll(function () {
    jest.setTimeout(10000)
  })

  afterAll(async function () {
    await Book.deleteMany()
    await config.deleteIndexIfExists(['books'])
    await mongoose.disconnect()
  })

  describe('an existing collection', () => {

    beforeAll(async function () {
      await config.deleteIndexIfExists(['books'])
      await mongoose.connect(config.mongoUrl, config.mongoOpts)
      const client = mongoose.connections[0].db
      books = client.collection('books')

      await Book.deleteMany()

      for (const title of config.bookTitlesArray()) {
        await books.insertOne({
          title: title
        })
      }
    })

    it('should index all existing objects', async () => {
      for await (const book of Book.find().cursor()) {

        const obj = { title: book.title }
        await Book.bulkAdd({
          body: obj,
          bulk: {
            size: 1000,
            batch: 1000,
            delay: 100,
          },
          id: book._id.toString(),
          index: 'books',
          model: Book,
        })
      }

      await config.sleep(config.BULK_ACTION_TIMEOUT)


      const results = await Book.search({
        query_string: {
          query: 'American'
        }
      })
      expect(results?.body.hits.total).toEqual(2)
    })
  })
})
