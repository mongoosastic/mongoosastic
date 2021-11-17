import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

const esClient = config.getClient()

interface IKitten extends MongoosasticDocument {
  name: string,
  breed: string
}

const KittenSchema = new Schema({
  name: {
    type: String,
    es_type: 'completion',
    es_analyzer: 'simple',
    es_indexed: true
  },
  breed: {
    type: String
  }
})

KittenSchema.plugin(mongoosastic)

const Kitten = mongoose.model<IKitten, MongoosasticModel<IKitten>>('Kitten', KittenSchema)

const kittens = [
  new Kitten({
    name: 'Cookie',
    breed: 'Aegean'
  }),
  new Kitten({
    name: 'Chipmunk',
    breed: 'Aegean'
  }),
  new Kitten({
    name: 'Twix',
    breed: 'Persian'
  }),
  new Kitten({
    name: 'Cookies and Cream',
    breed: 'Persian'
  })
]

describe('Suggesters', function () {

  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await config.deleteIndexIfExists(['kittens'])
    await Kitten.deleteMany()

    await Kitten.createMapping()
  })

  afterAll(async function () {
    await Kitten.deleteMany()
    await config.deleteIndexIfExists(['kittens'])
    await mongoose.disconnect()
  })

  describe('Testing Suggest', function () {

    it('should index property name with type completion', async function () {
      const mapping = await esClient.indices.getMapping({
        index: 'kittens'
      })

      const props = mapping.body.kittens.mappings.properties
      expect(props.name.type).toEqual('completion')
    })

    it('should return suggestions after hits', async function () {

      await Kitten.insertMany(kittens)
      await config.sleep(config.BULK_ACTION_TIMEOUT)

      const res = await Kitten.search({
        match_all: {}
      }, {
        suggest: {
          kittensuggest: {
            text: 'Cook',
            completion: {
              field: 'name'
            }
          }
        }
      })

      const body = res?.body
      expect(body).toHaveProperty('suggest')
      expect(body?.suggest?.kittensuggest[0].options.length).toEqual(2)
    })
  })
})
