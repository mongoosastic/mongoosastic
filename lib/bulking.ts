import { Client } from '@elastic/elasticsearch'
import { BulkIndexOptions, BulkInstruction, BulkOptions, BulkUnIndexOptions } from 'types'

let bulkBuffer: BulkInstruction[] = []
let bulkTimeout: NodeJS.Timeout | undefined

function clearBulkTimeout() {
	clearTimeout(bulkTimeout as NodeJS.Timeout)
	bulkTimeout = undefined
}

export function bulkAdd(opts: BulkIndexOptions, cb?: CallableFunction): void {
	const instruction = [{
		index: {
			_index: opts.index,
			_id: opts.id,
		}
	}, opts.body]
	
	bulkIndex(instruction, opts.bulk as BulkOptions, opts.client, cb)
}

export function bulkDelete(opts: BulkUnIndexOptions, cb?: CallableFunction): void {
	const instruction = [{
		delete: {
			_index: opts.index,
			_id: opts.id,
		}
	}]
	
	bulkIndex(instruction, opts.bulk as BulkOptions, opts.client, cb)
}

export function bulkIndex(instruction: BulkInstruction[], bulk: BulkOptions, client: Client, cb?: CallableFunction): void {

	bulkBuffer = bulkBuffer.concat(instruction)

	if (bulkBuffer.length >= bulk.size) {
		flush(client, cb)
		clearBulkTimeout()
	} else if (bulkTimeout === undefined) {
		bulkTimeout = setTimeout(() => {
			flush(client, cb)
			clearBulkTimeout()
		}, bulk.delay)
	}
}

function flush(client: Client, cb?: CallableFunction): void {
	client.bulk({
		body: bulkBuffer
	}, (err, res) => {
		if (err) {
			// bulkErrEm.emit('error', err, res)
			if(cb) cb(err, null)
		}
		if (res.body.items && res.body.items.length) {
			for (let i = 0; i < res.body.items.length; i++) {
				const info = res.body.items[i]
				if (info && info.index && info.index.error) {
					// bulkErrEm.emit('error', null, info.index)
					if(cb) cb(info.index, null)
				}
			}
		}
	})
	bulkBuffer = []
}