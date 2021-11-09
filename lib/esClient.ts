import { Client } from '@elastic/elasticsearch'
import { Options } from 'types'

export function createEsClient(options: Options): Client {
	
	if(options.clientOptions) return new Client(options.clientOptions)
	else return new Client({ node: 'http://localhost:9200' })
}