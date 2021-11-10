import { Client } from '@elastic/elasticsearch'
import { BulkIndexOptions, BulkInstruction, BulkOptions, BulkUnIndexOptions } from 'types'

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
	
	await bulkIndex(instruction, opts.bulk as BulkOptions, opts.client)
}

export async function bulkDelete(opts: BulkUnIndexOptions): Promise<void> {
	const instruction = [{
		delete: {
			_index: opts.index,
			_id: opts.id,
		}
	}]
	
	await bulkIndex(instruction, opts.bulk as BulkOptions, opts.client)
}

export async function bulkIndex(instruction: BulkInstruction[], bulk: BulkOptions, client: Client): Promise<void> {

	bulkBuffer = bulkBuffer.concat(instruction)

	if (bulkBuffer.length >= bulk.size) {
		await flush(client)
		clearBulkTimeout()
	} else if (bulkTimeout === undefined) {
		bulkTimeout = setTimeout(async () => {
			await flush(client)
			clearBulkTimeout()
		}, bulk.delay)
	}
}

export async function flush(client: Client): Promise<void> {

	client.bulk({
		body: bulkBuffer
	})
		.then(res => {
			if (res.body.items && res.body.items.length) {
				for (let i = 0; i < res.body.items.length; i++) {
					const info = res.body.items[i]
					if (info && info.index && info.index.error) {
					// bulkErrEm.emit('error', null, info.index)
						throw Error(info.index)
					}
				}
			}
		})
		.catch(error => console.log(error))

	bulkBuffer = []
}