import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel, Options } from '../lib/types'
import { config } from './config'

interface IMovie extends MongoosasticDocument {
  title: string,
  genre: string,
}

// -- Only index specific field
const MovieSchema = new Schema({
  title: {
    type: String,
    required: true,
    default: '',
    es_indexed: true
  },
  genre: {
    type: String,
    required: true,
    default: '',
    enum: ['horror', 'action', 'adventure', 'other'],
    es_indexed: true
  }
})

MovieSchema.plugin(mongoosastic, {
  filter: function (self: IMovie) {
    return self.genre === 'action'
  }
} as Options)

const Movie = mongoose.model<IMovie, MongoosasticModel<IMovie>>('Movie', MovieSchema)

describe('Filter mode', function () {

  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Movie.deleteMany()
    await config.deleteIndexIfExists(['movies'])
  })

  afterAll(async function () {
    await Movie.deleteMany()
    await config.deleteIndexIfExists(['movies'])
    await mongoose.disconnect()
  })

  it('should index horror genre', async function () {
    await config.createModelAndEnsureIndex(Movie, {
      title: 'LOTR',
      genre: 'horror'
    })

    const results = await Movie.search({
      term: {
        genre: 'horror'
      }
    })

    expect(results?.body.hits.total).toEqual(1)
  })

  it('should not index action genre', async function () {

    await config.createModelAndSave(Movie, {
      title: 'Man in Black',
      genre: 'action'
    })

    const results = await Movie.search({
      term: {
        genre: 'action'
      }
    })

    expect(results?.body.hits.total).toEqual(0)
  })

  it('should unindex filtered models', async function () {
    const movie = await config.createModelAndEnsureIndex(Movie, {
      title: 'REC',
      genre: 'horror'
    })

    const results = await Movie.search({
      term: {
        title: 'rec'
      }
    })

    expect(results?.body.hits.total).toEqual(1)

    movie.genre = 'action'
    await config.saveAndWaitIndex(movie)

    await config.sleep(config.INDEXING_TIMEOUT)
    const res = await Movie.search({
      term: {
        title: 'rec'
      }
    })

    expect(res?.body.hits.total).toEqual(0)
  })
})
