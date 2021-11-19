import { ApiResponse } from '@elastic/elasticsearch'
import { Search } from '@elastic/elasticsearch/api/requestParams'
import { QueryDslQueryContainer, SearchRequest, SearchResponse } from '@elastic/elasticsearch/api/types'
import { EsSearchOptions, HydratedSearchResults, MongoosasticDocument, MongoosasticModel } from './types'
import { getIndexName, hydrate, isString, isStringArray, reformatESTotalNumber } from './utils'

export async function search(
  this: MongoosasticModel<MongoosasticDocument>,
  query: QueryDslQueryContainer,
  opts: EsSearchOptions = {}
): Promise<ApiResponse<SearchResponse, unknown> | ApiResponse<HydratedSearchResults>> {
  const fullQuery = {
    query: query,
  }

  const bindedEsSearch = esSearch.bind(this)

  return bindedEsSearch(fullQuery, opts)
}

export async function esSearch(
  this: MongoosasticModel<MongoosasticDocument>,
  query: SearchRequest['body'],
  opts: EsSearchOptions = {}
): Promise<ApiResponse<SearchResponse, unknown> | ApiResponse<HydratedSearchResults>> {
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

  Object.keys(opts).forEach((opt) => {
    if (!opt.match(/(hydrate|sort|aggs|highlight|suggest)/) && opts.hasOwnProperty(opt)) {
      esQuery[opt as keyof Search] = opts[opt as keyof EsSearchOptions]
    }
  })

  const res: ApiResponse<SearchResponse> = await client.search(esQuery)

  const resp = reformatESTotalNumber(res)
  if (options.alwaysHydrate || opts.hydrate) {
    return hydrate(resp, this, opts)
  } else {
    return resp
  }
}
