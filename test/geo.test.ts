import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

const esClient = config.getClient()

interface IGeo extends MongoosasticDocument {
  myId: number,
  frame: {
    coordinates: Array<unknown>,
    type: string,
    geo_shape: string
  }
}

const GeoSchema = new Schema({
  myId: Number,
  frame: {
    coordinates: [],
    type: {
      type: String
    },
    geo_shape: {
      type: String,
      es_type: 'geo_shape',
      // Should comment the next three options to work with ES v8.X
      es_tree: 'quadtree',
      es_precision: '1km',
      es_distance_error_pct: '0.001'
    }
  }
})

GeoSchema.plugin(mongoosastic)
const GeoModel = mongoose.model<IGeo, MongoosasticModel<IGeo>>('geodoc', GeoSchema)

const points = [
  new GeoModel({
    myId: 1,
    frame: {
      type: 'envelope',
      coordinates: [[1, 4], [3, 2]]
    }
  }),
  new GeoModel({
    myId: 2,
    frame: {
      type: 'envelope',
      coordinates: [[2, 3], [4, 0]]
    }
  })
]

describe('GeoTest', function () {

  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await GeoModel.deleteMany()
    await config.deleteIndexIfExists(['geodocs'])

    await GeoModel.createMapping()
  })

  afterAll(async function () {
    await GeoModel.deleteMany()
    await config.deleteIndexIfExists(['geodocs'])
    await mongoose.disconnect()
  })

  it('should create a mapping where frame has the type geo_shape', async function () {
    const mapping = await esClient.indices.getMapping({
      index: 'geodocs'
    })

    expect(mapping.body.geodocs.mappings.properties.frame.type).toEqual('geo_shape')
  })

  it('should be able to create and store geo coordinates', async function () {

    for (const point of points) {
      await point.save()
    }
    await config.sleep(config.INDEXING_TIMEOUT)

    const res = await GeoModel.find({})

    expect(res.length).toEqual(2)

    expect(res[0].frame.type).toEqual('envelope')

    expect(res[0].frame.coordinates[0]).toEqual([1, 4])
    expect(res[0].frame.coordinates[1]).toEqual([3, 2])
  })

  it('should be able to find geo coordinates in the indexes', async function () {

    const res = await GeoModel.search({
      match_all: {}
    }, {
      sort: 'myId:asc'
    })

    const frame = res?.body.hits.hits[0]._source?.frame

    expect(res?.body.hits.total).toEqual(2)

    expect(frame?.type).toEqual('envelope')
    expect(frame?.coordinates).toEqual([[1, 4], [3, 2]])
  })

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: callback type
  it('should be able to resync geo coordinates from the database', async function (done) {

    await config.deleteIndexIfExists(['geodocs'])

    await GeoModel.createMapping()

    const stream = GeoModel.synchronize()
    let count = 0

    stream.on('data', function () {
      count++
    })

    stream.on('close', async function () {

      expect(count).toEqual(2)

      await config.sleep(config.INDEXING_TIMEOUT)

      const res = await GeoModel.search({
        match_all: {}
      }, {
        sort: 'myId:asc'
      })

      const frame = res?.body.hits.hits[0]._source?.frame

      expect(res?.body.hits.total).toEqual(2)

      expect(frame?.type).toEqual('envelope')
      expect(frame?.coordinates).toEqual([[1, 4], [3, 2]])

      done()
    })
  })

  it('should be able to search points inside frames', async function () {
    const geoQuery = {
      bool: {
        must: {
          match_all: {}
        },
        filter: {
          geo_shape: {
            frame: {
              shape: {
                type: 'point',
                coordinates: [3, 1]
              }
            }
          }
        }
      }
    }

    await config.sleep(config.INDEXING_TIMEOUT)

    const res1 = await GeoModel.search(geoQuery)
    expect(res1?.body.hits.total).toEqual(1)
    expect(res1?.body.hits.hits[0]._source?.myId).toEqual(2)

    geoQuery.bool.filter.geo_shape.frame.shape.coordinates = [1.5, 2.5]

    const res2 = await GeoModel.search(geoQuery)
    expect(res2?.body.hits.total).toEqual(1)
    expect(res2?.body.hits.hits[0]._source?.myId).toEqual(1)

    geoQuery.bool.filter.geo_shape.frame.shape.coordinates = [3, 2]

    const res3 = await GeoModel.search(geoQuery)
    expect(res3?.body.hits.total).toEqual(2)

    geoQuery.bool.filter.geo_shape.frame.shape.coordinates = [0, 3]

    const res4 = await GeoModel.search(geoQuery)
    expect(res4?.body.hits.total).toEqual(0)
  })

})
