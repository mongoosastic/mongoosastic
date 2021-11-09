import { IndexMethodOptions, PluginDocument } from 'types'
import { deleteById, getIndexName, serialize } from './utils'
import { bulkAdd, bulkDelete } from './bulking'
import Generator from './mapping'
import { ApiResponse } from '@elastic/elasticsearch'

export async function index(this: PluginDocument, inOpts: IndexMethodOptions = {}): Promise<PluginDocument | ApiResponse | void> {

	const options = this.esOptions()
	const client = this.esClient()

	const filter = options && options.filter

	// unindex filtered models
	if (filter && filter(this)) {
		return this.unIndex()
	}

	const indexName = inOpts.index ? inOpts.index : getIndexName(this)

	const generator = new Generator()
	const mapping = generator.generateMapping(this.schema)

	let body
	if (options.customSerialize) {
		body = options.customSerialize(this, mapping)
	} else {
		body = serialize(this, mapping)
	}

	if (options.transform) body = options.transform(body, this)

	const opt = {
		index: indexName,
		id: this._id.toString(),
		body: body,
		bulk: options.bulk,
		refresh: options.forceIndexRefresh,
		routing: options.routing ? options.routing(this) : undefined
	}

	if (opt.bulk) {
		await bulkAdd({ client, ...opt })
		return this
	} else {
		return client.index(opt)
	}
}

export async function unIndex(this: PluginDocument): Promise<void> {

	const options = this.esOptions()
	const client = this.esClient()

	const indexName = getIndexName(this)

	const opt = {
		client: client,
		index: indexName,
		tries: 3,
		id: this._id.toString(),
		bulk: options.bulk,
		document: this,
		routing: options.routing ? options.routing(this) : undefined
	}

	if (opt.bulk) {
		await bulkDelete(opt)
	} else {
		await deleteById(opt)
	}
}