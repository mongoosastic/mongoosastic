import events from 'events'
import { Schema } from 'mongoose'
import { Options, MongoosasticDocument, MongoosasticModel } from 'types'
import { flush } from './bulking'
import { createEsClient } from './esClient'
import { postSave, postRemove } from './hooks'
import Generator from './mapping'
import { index, unIndex } from './methods'
import { esSearch, search } from './search'
import { createMapping, esCount, esTruncate, refresh, synchronize } from './statics'

const defaultOptions = {
	indexAutomatically: true,
	saveOnSynchronize: true
}

function mongoosastic<T extends MongoosasticDocument>(schema: Schema<T, MongoosasticModel<T>>, options: Options = {}): void {

	options = { ...defaultOptions, ...options }

	const client = createEsClient(options)
	const generator = new Generator()

	schema.method('esOptions', () => { return options })
	schema.static('esOptions', () => { return options })

	schema.method('esClient', () => { return client })
	schema.static('esClient', () => { return client })

	schema.method('index', index)
	schema.method('unIndex', unIndex)

	schema.static('synchronize', synchronize)
	schema.static('esTruncate', esTruncate)

	schema.static('search', search)
	schema.static('esSearch', esSearch)

	schema.static('createMapping', createMapping)
	schema.static('getMapping', () => { return generator.generateMapping(schema) })
	schema.static('getCleanTree', () => { return generator.getCleanTree(schema) })
	
	schema.static('esCount', esCount)
	schema.static('refresh', refresh)
	schema.static('flush', flush)

	const bulkErrEm = new events.EventEmitter()
	schema.static('bulkError', () => { return bulkErrEm })

	if(options.indexAutomatically) {
		schema.post('save', postSave)
		schema.post('insertMany', (docs: MongoosasticDocument[]) => docs.forEach((doc) => postSave(doc)))

		schema.post('findOneAndUpdate', postSave)

		schema.post('remove', postRemove)
		schema.post(['findOneAndDelete', 'findOneAndRemove'], postRemove)
	}
}

export default mongoosastic