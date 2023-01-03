import { IndicesCreateRequest, MappingProperty, PropertyName, QueryDslQueryContainer } from '@elastic/elasticsearch/api/types'
import { ApiResponse } from '@elastic/elasticsearch/lib/Transport'
import { EventEmitter } from 'events'
import { FilterQuery } from 'mongoose'
import { postSave } from './hooks'
import Generator from './mapping'
import { MongoosasticDocument, MongoosasticModel, SynchronizeOptions } from './types'
import { filterMappingFromMixed, getIndexName } from './utils'

export async function createMapping(
  this: MongoosasticModel<MongoosasticDocument>,
  body: IndicesCreateRequest['body']
): Promise<Record<PropertyName, MappingProperty>> {
  const options = this.esOptions()
  const client = this.esClient()

  const indexName = getIndexName(this)

  const generator = new Generator()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const completeMapping = generator.generateMapping(this.schema, true)

  completeMapping.properties = filterMappingFromMixed(completeMapping.properties)

  const properties = options.properties
  if (properties) {
    Object.keys(properties).map((key) => {
      completeMapping.properties[key] = properties[key]
    })
  }

  const exists = await client.indices.exists({
    index: indexName,
  })

  if (exists.body) {
    await client.indices.putMapping({
      index: indexName,
      body: completeMapping,
    })
    return completeMapping
  }

  await client.indices.create({
    index: indexName,
    body: {
      mappings: completeMapping,
      ...body
    },
  })
  return completeMapping
}

export function synchronize(
  this: MongoosasticModel<MongoosasticDocument>,
  query: FilterQuery<MongoosasticDocument> = {},
  inOpts: SynchronizeOptions = {}
): EventEmitter {
  const options = this.esOptions()

  const em = new EventEmitter()
  let counter = 0

  // Set indexing to be bulk when synchronizing to make synchronizing faster
  // Set default values when not present
  const bulkOptions = options.bulk
  options.bulk = {
    delay: (options.bulk && options.bulk.delay) || 1000,
    size: (options.bulk && options.bulk.size) || 1000,
    batch: (options.bulk && options.bulk.batch) || 50,
  }

  const saveOnSynchronize =
    inOpts.saveOnSynchronize !== undefined ? inOpts.saveOnSynchronize : options.saveOnSynchronize

  const stream = this.find(query).batchSize(options.bulk.batch).cursor()

  stream.on('data', (doc) => {
    stream.pause()
    counter++

    function onIndex(indexErr: unknown, inDoc: MongoosasticDocument) {
      counter--
      if (indexErr) {
        em.emit('error', indexErr)
      } else {
        em.emit('data', null, inDoc)
      }
      stream.resume()
    }

    doc.on('es-indexed', onIndex)
    doc.on('es-filtered', onIndex)

    if (saveOnSynchronize) {
      doc.save((err: unknown) => {
        if (err) {
          counter--
          em.emit('error', err)
          return stream.resume()
        }
      })
    } else {
      postSave(doc)
    }
  })

  stream.on('close', () => {
    const closeInterval = setInterval(() => {
      if (counter === 0) {
        clearInterval(closeInterval)
        em.emit('close')
        options.bulk = bulkOptions
      }
    }, 1000)
  })

  stream.on('error', (err) => {
    em.emit('error', err)
  })

  return em
}

export async function esTruncate(this: MongoosasticModel<MongoosasticDocument>): Promise<void> {

  const client = this.esClient()

  const indexName = getIndexName(this)

  const settings = await client.indices.getSettings({
    index: indexName
  })

  const body = settings.body[indexName]
  
  delete body.settings.index.creation_date
  delete body.settings.index.provided_name
  delete body.settings.index.uuid
  delete body.settings.index.version

  await client.indices.delete({
    index: indexName
  })

  await this.createMapping(body)
}

export async function refresh(this: MongoosasticModel<MongoosasticDocument>): Promise<ApiResponse> {
  return this.esClient().indices.refresh({
    index: getIndexName(this),
  })
}

export async function esCount(
  this: MongoosasticModel<MongoosasticDocument>,
  query: QueryDslQueryContainer
): Promise<ApiResponse> {
  if (query === undefined) {
    query = {
      match_all: {},
    }
  }

  const esQuery = {
    body: {
      query: query,
    },
    index: getIndexName(this),
  }

  return this.esClient().count(esQuery)
}
