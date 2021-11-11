import { Model } from 'mongoose'
import { BulkIndexOptions, BulkInstruction, BulkOptions, BulkUnIndexOptions, MongoosasticDocument } from 'types'

let bulkBuffer: BulkInstruction[] = []
let bulkTimeout: NodeJS.Timeout | undefined

function clearBulkTimeout() {
	clearTimeout(bulkTimeout as NodeJS.Timeout)
	bulkTimeout = undefined
}

export async function bulkAdd(opts: BulkIndexOptions): Promise<void> {
	const instruction = [{
		index: {
			_index: opts.index,
			_id: opts.id,
		}
	}, opts.body]
	
	await bulkIndex(opts.model, instruction, opts.bulk as BulkOptions)
}

export async function bulkDelete(opts: BulkUnIndexOptions): Promise<void> {
	const instruction = [{
		delete: {
			_index: opts.index,
			_id: opts.id,
		}
	}]
	
	await bulkIndex(opts.model, instruction, opts.bulk as BulkOptions)
}

export async function bulkIndex(model: Model<MongoosasticDocument>, instruction: BulkInstruction[], bulk: BulkOptions): Promise<void> {

	bulkBuffer = bulkBuffer.concat(instruction)

	if (bulkBuffer.length >= bulk.size) {
		await model.flush()
		clearBulkTimeout()
	} else if (bulkTimeout === undefined) {
		bulkTimeout = setTimeout(async () => {
			await model.flush()
			clearBulkTimeout()
		}, bulk.delay)
	}
}

export async function flush(this: Model<MongoosasticDocument>): Promise<void> {

	this.esClient().bulk({
		body: bulkBuffer
	})
		.then(res => {
			if (res.body.items && res.body.items.length) {
				for (let i = 0; i < res.body.items.length; i++) {
					const info = res.body.items[i]
					if (info && info.index && info.index.error) {
						this.bulkError().emit('error', null, info.index)
					}
				}
			}
		})
		.catch(error => this.bulkError().emit('error', error, null))

	bulkBuffer = []
}