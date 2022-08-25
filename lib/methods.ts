import { ApiResponse } from '@elastic/elasticsearch'
import { bulkAdd, bulkDelete } from './bulking'
import Generator from './mapping'
import { IndexMethodOptions, MongoosasticDocument, MongoosasticModel } from './types'
import { deleteById, getIndexName, serialize } from './utils'

export async function index(
  this: MongoosasticDocument,
  inOpts: IndexMethodOptions = {}
): Promise<MongoosasticDocument | ApiResponse> {
  const options = this.esOptions()
  const client = this.esClient()

  const filter = options && options.filter

  // unIndex filtered models
  if (filter && filter(this)) {
    return this.unIndex()
  }

  const indexName = inOpts.index ? inOpts.index : getIndexName(this)

  const generator = new Generator()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const mapping = generator.generateMapping(this.schema)

  let body
  if (options.customSerialize) {
    body = options.customSerialize(this, mapping)
  } else {
    body = serialize(this, mapping)
  }

  if (options.transform) {
    body = await options.transform(body, this)
  }

  const opt = {
    index: indexName,
    id: this._id.toString(),
    body: body,
    bulk: options.bulk,
    refresh: options.forceIndexRefresh,
    routing: options.routing ? options.routing(this) : undefined,
  }

  const model = this.constructor as MongoosasticModel<MongoosasticDocument>

  if (opt.bulk) {
    await bulkAdd({ model, ...opt })
    return this
  } else {
    return client.index(opt)
  }
}

export async function unIndex(this: MongoosasticDocument): Promise<MongoosasticDocument> {
  const options = this.esOptions()
  const client = this.esClient()

  const indexName = getIndexName(this)

  const opt = {
    client: client,
    index: indexName,
    tries: 3,
    id: this._id.toString(),
    bulk: options.bulk,
    model: this.constructor as MongoosasticModel<MongoosasticDocument>,
    routing: options.routing ? options.routing(this) : undefined,
  }

  if (opt.bulk) {
    await bulkDelete(opt)
  } else {
    await deleteById(this, opt)
  }

  return this
}
