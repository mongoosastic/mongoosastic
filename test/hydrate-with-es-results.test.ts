import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IText extends MongoosasticDocument {
  title: string,
  quote: string
}

const textSchema = new Schema({
  title: String,
  quote: String
})

textSchema.plugin(mongoosastic)

const Text = mongoose.model<IText, MongoosasticModel<IText>>('text', textSchema)

const texts = [
  new Text({
    title: 'The colour of magic',
    quote: 'The only reason for walking into the jaws of Death is so\'s you can steal his gold teeth'
  }),
  new Text({
    title: 'The Light Fantastic',
    quote: 'The death of the warrior or the old man or the little child, this I understand, and I take ' +
      'away the pain and end the suffering. I do not understand this death-of-the-mind'
  }),
  new Text({
    title: 'Equal Rites',
    quote: 'Time passed, which, basically, is its job'
  }),
  new Text({
    title: 'Mort',
    quote: 'You don\'t see people at their best in this job, said Death.'
  })
]

describe('Hydrate with ES data', function () {

  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await config.deleteIndexIfExists(['texts'])
    await Text.deleteMany()

    for (const text of texts) {
      await config.saveAndWaitIndex(text)
    }
    await config.sleep(config.BULK_ACTION_TIMEOUT)
  })

  afterAll(async function () {
    await Text.deleteMany()
    await config.deleteIndexIfExists(['texts'])
    await mongoose.disconnect()
  })

  describe('Hydrate without adding ES data', function () {
    it('should return simple objects', async function () {

      const res = await Text.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true
      })

      expect(res?.body.hits.total).toEqual(3)

      res?.body.hits.hits.forEach(function (text) {
        expect(text).not.toHaveProperty('_esResult')
      })
    })

    it('should return an empty response if not exist', async function () {

      const res = await Text.search({
        match_phrase: {
          quote: 'A non existing quote!'
        }
      }, {
        hydrate: true
      })

      expect(res?.body.hits.total).toEqual(0)
      expect(res?.body.hits.hydrated).toEqual([])
    })
  })

  describe('Hydrate and add ES data', function () {
    it('should return object enhanced with _esResult', async function () {

      const res = await Text.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true,
        hydrateWithESResults: true,
        highlight: {
          fields: {
            quote: {}
          }
        }
      })

      expect(res?.body.hits.total).toEqual(3)

      res?.body.hits.hydrated.forEach(function (text) {
        expect(text).toHaveProperty('_esResult')

        expect(text._esResult).toHaveProperty('_index')
        expect(text._esResult?._index).toEqual('texts')

        expect(text._esResult).toHaveProperty('_id')
        // Should comment the next line to work with ES v8.X
        expect(text._esResult).toHaveProperty('_type')
        expect(text._esResult).toHaveProperty('_score')
        expect(text._esResult).toHaveProperty('highlight')

        expect(text._esResult).not.toHaveProperty('_source')
      })
    })

    it('should remove _source object', async function () {

      const res = await Text.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true,
        hydrateWithESResults: { source: true },
        highlight: {
          fields: {
            quote: {}
          }
        }
      })

      expect(res?.body.hits.total).toEqual(3)

      res?.body.hits.hydrated.forEach(function (text) {
        expect(text).toHaveProperty('_esResult')

        expect(text._esResult).toHaveProperty('_index')
        expect(text._esResult?._index).toEqual('texts')

        expect(text._esResult).toHaveProperty('_id')
        // Should comment the next line to work with ES v8.X
        expect(text._esResult).toHaveProperty('_type')
        expect(text._esResult).toHaveProperty('_score')
        expect(text._esResult).toHaveProperty('highlight')

        expect(text._esResult).toHaveProperty('_source')
        expect(text._esResult?._source).toHaveProperty('title')
      })
    })
  })
})
