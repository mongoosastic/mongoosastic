import { IndexMethodOptions, PluginDocument } from 'types'
import { deleteById, getIndexName, serialize } from './utils'
import { bulkAdd, bulkDelete } from './bulking'
import Generator from './mapping'

export function index(this: PluginDocument, inOpts: IndexMethodOptions = {}, cb: CallableFunction): void {

	if (cb === undefined) {
		cb = inOpts as CallableFunction
		inOpts = {}
	}

	const options = this.esOptions()
	const client = this.esClient()

	const filter = options && options.filter

	// unindex filtered models
	if (filter && filter(this)) {
		return this.unIndex(cb)
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
		bulkAdd({ client, ...opt }, cb)
		setImmediate(() => { cb(null, this) })

	} else {
		client.index(opt).then((value) => { cb(null, value) })
	}
}

export function unIndex(this: PluginDocument, cb?: CallableFunction): void {

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
		bulkDelete(opt, cb)
	} else {
		deleteById(opt, cb)
	}
}