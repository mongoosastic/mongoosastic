import { ApiResponse } from '@elastic/elasticsearch'
import { Search } from '@elastic/elasticsearch/api/requestParams'
import { QueryContainer, SearchRequest, SearchResponse } from '@elastic/elasticsearch/api/types'
import { Model } from 'mongoose'
import { EsSearchOptions, PluginDocument } from 'types'
import { getIndexName, hydrate, isString, isStringArray, reformatESTotalNumber } from './utils'


export function search(this: Model<PluginDocument>, query: QueryContainer, opts: EsSearchOptions, cb: CallableFunction): void {

	if (cb === undefined) {
		cb = opts as CallableFunction
		opts = {}
	}

	const fullQuery = {
		query: query
	}

	const bindedEsSearch = esSearch.bind(this)

	return bindedEsSearch(fullQuery, opts, cb)
}

export function esSearch(this: Model<PluginDocument>, query: SearchRequest['body'], opts: EsSearchOptions, cb: CallableFunction): void {

	if (cb === undefined) {
		cb = opts as CallableFunction
		opts = {}
	}

	const options = this.esOptions()
	const client = this.esClient()

	const { highlight, suggest, aggs, min_score, routing } = opts

	const body = { highlight, suggest, aggs, min_score, ...query }

	const esQuery: Search = {
		body: body,
		routing: routing,
		index: getIndexName(this), 
	}

	if (opts.sort) {
		if (isString(opts.sort) || isStringArray(opts.sort)) {
			esQuery.sort = opts.sort
		} else {
			body.sort = opts.sort
			esQuery.body = body
		}
	}

	Object.keys(opts).forEach(opt => {
		if (!opt.match(/(hydrate|sort|aggs|highlight|suggest)/) && opts.hasOwnProperty(opt)) {
			esQuery[opt as keyof Search] = opts[opt as keyof EsSearchOptions]
		}
	})

	client.search(esQuery, (err, res: ApiResponse<SearchResponse>) => {
		if (err) {
			return cb(err)
		}

		const resp = reformatESTotalNumber(res)
		if (options.alwaysHydrate || opts.hydrate) {
			hydrate(resp, this, opts, cb)
		} else {
			cb(null, resp)
		}
	})
}