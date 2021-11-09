import { Context, QueryContainer, SearchResponse } from '@elastic/elasticsearch/api/types'
import { callbackFn } from '@elastic/elasticsearch/lib/Helpers'
import events from 'events'
import { FilterQuery, Model } from 'mongoose'
import { PluginDocument, SynchronizeOptions } from 'types'
import { postSave } from './hooks'
import { filterMappingFromMixed, getIndexName, reformatESTotalNumber } from './utils'
import { bulkDelete } from './bulking'
import Generator from './mapping'
import { ApiResponse, RequestBody } from '@elastic/elasticsearch/lib/Transport'
import { Search } from '@elastic/elasticsearch/api/requestParams'

export function createMapping(this: Model<PluginDocument>, body: RequestBody, cb: CallableFunction): void {

	if (arguments.length < 2) {
		cb = body as CallableFunction
		body = {}
	}

	const options = this.esOptions()
	const client = this.esClient()
	
	const indexName = getIndexName(this)
	
	const generator = new Generator()
	const completeMapping = generator.generateMapping(this.schema)

	const filtered = filterMappingFromMixed(completeMapping.properties)
	completeMapping.properties = filtered

	const properties = options.properties
	if (properties) {
		Object.keys(properties).map(key => {
			completeMapping.properties[key] = properties[key]
		})
	}

	client.indices.exists({
		index: indexName
	}, (err, exists) => {
		if (err) {
			return cb(err)
		}

		if (exists.body) {
			return client.indices.putMapping({
				index: indexName,
				body: completeMapping
			}, (err) => {
				cb(err, completeMapping)
			})
		}

		return client.indices.create({
			index: indexName,
			body: body
		}, indexErr => {
			if (indexErr) {
				return cb(indexErr)
			}

			client.indices.putMapping({
				index: indexName,
				body: completeMapping
			}, (err) => {
				cb(err, completeMapping)
			})
		})
	})
}

export function synchronize(this: Model<PluginDocument>, query: FilterQuery<PluginDocument> = {}, inOpts: SynchronizeOptions = {}): events {

	const options = this.esOptions()

	const em = new events.EventEmitter()
	let counter = 0

	// Set indexing to be bulk when synchronizing to make synchronizing faster
	// Set default values when not present
	const bulkOptions = options.bulk
	options.bulk = {
		delay: (options.bulk && options.bulk.delay) || 1000,
		size: (options.bulk && options.bulk.size) || 1000,
		batch: (options.bulk && options.bulk.batch) || 50
	}

	const saveOnSynchronize = inOpts.saveOnSynchronize !== undefined ? inOpts.saveOnSynchronize : options.saveOnSynchronize

	const stream = this.find(query).batchSize(options.bulk.batch).cursor()

	stream.on('data', doc => {
		stream.pause()
		counter++

		function onIndex (indexErr: unknown, inDoc: PluginDocument) {
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

		if(saveOnSynchronize){
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

	stream.on('error', err => {
		em.emit('error', err)
	})

	return em
}

export function esTruncate(this: Model<PluginDocument>, cb?: CallableFunction): void {

	const options = this.esOptions()
	const client = this.esClient()

	const indexName = getIndexName(this)

	const esQuery: Search = {
		index: indexName,
		body: {
			query: {
				match_all: {}
			}
		}
	}

	// Set indexing to be bulk when synchronizing to make synchronizing faster
	// Set default values when not present
	const bulkOptions = options.bulk
	options.bulk = {
		delay: (options.bulk && options.bulk.delay) || 1000,
		size: (options.bulk && options.bulk.size) || 1000,
		batch: (options.bulk && options.bulk.batch) || 50
	}

	client.search(esQuery, (err, res: ApiResponse<SearchResponse<PluginDocument>>) => {
		if (err) {
			if(cb) return cb(err)
		}
		res = reformatESTotalNumber(res)
		if (res.body.hits.total) {
			res.body.hits.hits.forEach((doc) => {
				
				const opts = {
					index: indexName,
					id: doc._id,
					bulk: options.bulk,
					routing: undefined,
					client: client
				}
				
				if (options.routing && doc._source != null) {
					doc._source._id = doc._id
					opts.routing = options.routing(doc._source)
				}

				bulkDelete(opts)
			})
		}
		options.bulk = bulkOptions
		if(cb) return cb()
	})
}

export function refresh(this: Model<PluginDocument>, cb: callbackFn<Response, Context>): void {
	this.esClient().indices.refresh({
		index: getIndexName(this)
	}, cb)
}

export function esCount(this: Model<PluginDocument>, query: QueryContainer, cb: callbackFn<Response, Context>): void {

	if (cb === undefined) {
		cb = query as callbackFn<Response, Context>
		query = {
			match_all: {}
		}
	}

	const esQuery = {
		body: {
			query: query
		},
		index: getIndexName(this)
	}

	this.esClient().count(esQuery, cb)
}