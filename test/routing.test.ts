import mongoose, { Schema } from 'mongoose'
import mongoosastic from '../lib/index'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'
import { config } from './config'

interface ITask extends MongoosasticDocument {
  content: string
}

const TaskSchema = new Schema({
  content: String
})

TaskSchema.plugin(mongoosastic, {
  routing: function (doc: ITask) {
    return doc.content
  }
})

const Task = mongoose.model<ITask, MongoosasticModel<ITask>>('Task', TaskSchema)

describe('Routing', function () {

  beforeAll(async function () {
    await mongoose.connect(config.mongoUrl, config.mongoOpts)
    await config.deleteIndexIfExists(['tasks'])
    await Task.deleteMany()
  })

  afterAll(async function () {
    await Task.deleteMany()
    await config.deleteIndexIfExists(['tasks'])
    await mongoose.disconnect()
  })

  it('should found task if no routing', async function () {

    const task = await config.createModelAndEnsureIndex(Task, { content: Date.now() })

    const results = await Task.search({
      query_string: {
        query: task.content
      }
    })

    expect(results?.body.hits.total).toEqual(1)
  })

  it('should found task if routing with task.content', async function () {

    const task = await config.createModelAndEnsureIndex(Task, { content: Date.now() })

    const results = await Task.search({
      query_string: {
        query: task.content
      }
    }, {
      routing: task.content
    })

    expect(results?.body.hits.total).toEqual(1)
    expect(results?.body._shards.total).toEqual(1)
  })

  it('should not found task if routing with invalid routing', async function () {

    const task = await config.createModelAndEnsureIndex(Task, { content: Date.now() })

    const results = await Task.search({
      query_string: {
        query: task.content
      }
    }, {
      routing: task.content + 1
    })

    expect(results?.body._shards.total).toEqual(1)
  })

  it('should not found task after remove', async function () {
    const task = await Task.create({ content: Date.now() })

    await task.remove()
    await config.sleep(config.INDEXING_TIMEOUT)

    const results = await Task.search({
      query_string: {
        query: task.content
      }
    })

    expect(results?.body.hits.total).toEqual(0)
  })

  it('should not found task after unIndex', async function () {
    const task = await Task.create({ content: Date.now() })

    await task.unIndex()

    const results = await Task.search({
      query_string: {
        query: task.content
      }
    })

    expect(results?.body.hits.total).toEqual(0)
  })

  it('should not found task after esTruncate', async function () {
    const task = await Task.create({ content: Date.now() })

    await Task.esTruncate()

    const results = await Task.search({
      query_string: {
        query: task.content
      }
    })

    expect(results?.body.hits.total).toEqual(0)
  })
})
