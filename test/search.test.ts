import { AggregationsAggregate, SearchHit } from '@elastic/elasticsearch/api/types'
import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface IBond extends MongoosasticDocument {
  name: string,
  type: string,
  price: number
}

const BondSchema = new Schema({
  name: String,
  type: {
    type: String,
    default: 'Other Bond'
  },
  price: Number
})

BondSchema.plugin(mongoosastic)

const Bond = mongoose.model<IBond, MongoosasticModel<IBond>>('Bond', BondSchema)

const bonds = [
  new Bond({
    name: 'Bail',
    type: 'A',
    price: 10000
  }),
  new Bond({
    name: 'Commercial',
    type: 'B',
    price: 15000
  }),
  new Bond({
    name: 'Construction',
    type: 'B',
    price: 20000
  }),
  new Bond({
    name: 'Legal',
    type: 'C',
    price: 30000
  })
]

describe('Query DSL', function () {

  beforeAll(async function () {
    await config.deleteIndexIfExists(['bonds'])
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await Bond.deleteMany()

    for (const bond of bonds) {
      await config.saveAndWaitIndex(bond)
    }
    await config.sleep(config.INDEXING_TIMEOUT)
  })

  afterAll(async function () {
    await Bond.deleteMany()
    await config.deleteIndexIfExists(['bonds'])
    await mongoose.disconnect()
  })

  describe('range', function () {
    it('should be able to find within range', async function () {
      const res = await Bond.search({
        range: {
          price: {
            gte: 20000,
            lte: 30000
          }
        }
      })

      expect(res?.body.hits.total).toEqual(2)

      res?.body.hits.hits.forEach(function (bond) {
        expect(['Legal', 'Construction']).toContainEqual(bond._source?.name)
      })
    })
  })

  describe('Sort', function () {
    const getNames = function (res: SearchHit<IBond>) {
      return res._source?.name
    }
    const expectedDesc = ['Legal', 'Construction', 'Commercial', 'Bail']
    const expectedAsc = expectedDesc.concat([]).reverse() // clone and reverse

    describe('Simple sort', function () {
      it('should be able to return all data, sorted by name ascending', async function () {
        const res = await Bond.search({
          match_all: {}
        }, {
          sort: 'name.keyword:asc'
        })

        expect(res?.body.hits.total).toEqual(4)
        expect(expectedAsc).toEqual(res?.body.hits.hits.map(getNames))
      })

      it('should be able to return all data, sorted by name descending', async function () {
        const res = await Bond.search({
          match_all: {}
        }, {
          sort: ['name.keyword:desc']
        })

        expect(res?.body.hits.total).toEqual(4)
        expect(expectedDesc).toEqual(res?.body.hits.hits.map(getNames))
      })
    })

    describe('Complex sort', function () {
      it('should be able to return all data, sorted by name ascending', async function () {
        const res = await Bond.search({
          match_all: {}
        }, {
          sort: {
            'name.keyword': {
              order: 'asc'
            }
          }
        })

        expect(res?.body.hits.total).toEqual(4)
        expect(expectedAsc).toEqual(res?.body.hits.hits.map(getNames))
      })

      it('should be able to return all data, sorted by name descending', async function () {
        const res = await Bond.search({
          match_all: {}
        }, {
          sort: {
            'name.keyword': {
              order: 'desc'
            },
            'type.keyword': {
              order: 'asc'
            }
          }
        })

        expect(res?.body.hits.total).toEqual(4)
        expect(expectedDesc).toEqual(res?.body.hits.hits.map(getNames))
      })
    })
  })

  describe('Aggregations', function () {
    describe('Simple aggregation', function () {
      it('should be able to group by term', async function () {
        const res = await Bond.search({
          match_all: {}
        }, {
          aggs: {
            names: {
              terms: {
                field: 'name.keyword'
              }
            }
          }
        })

        expect(res?.body.aggregations?.names['buckets' as keyof AggregationsAggregate]).toEqual([
          {
            doc_count: 1,
            key: 'Bail'
          },
          {
            doc_count: 1,
            key: 'Commercial'
          },
          {
            doc_count: 1,
            key: 'Construction'
          },
          {
            doc_count: 1,
            key: 'Legal'
          }
        ])
      })
    })
  })

  describe('Fuzzy search', function () {
    it('should do a fuzzy query', async function () {
      const getNames = function (res: SearchHit<IBond>) {
        return res._source?.name
      }

      const res = await Bond.esSearch({
        query: {
          match: {
            name: {
              query: 'comersial',
              fuzziness: 2
            }
          }
        }
      })

      expect(res?.body.hits.total).toEqual(1)
      expect(['Commercial']).toEqual(res?.body.hits.hits.map(getNames))
    })
  })
})
