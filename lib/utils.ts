import { ApiResponse } from '@elastic/elasticsearch'
import { MappingProperty, PropertyName, SearchResponse, SearchTotalHits } from '@elastic/elasticsearch/api/types'
import { isEmpty } from 'lodash'
import {
  DeleteByIdOptions,
  EsSearchOptions,
  GeneratedMapping,
  HydratedSearchResults,
  MongoosasticDocument,
  MongoosasticModel,
} from './types'

export function isString(subject: unknown): boolean {
  return typeof subject === 'string'
}

export function isStringArray(arr: Array<unknown>): boolean {
  return arr.filter && arr.length === arr.filter((item: unknown) => typeof item === 'string').length
}

export function getIndexName(doc: MongoosasticDocument | MongoosasticModel<MongoosasticDocument>): string {
  const options = doc.esOptions()
  const indexName = options && options.index
  if (!indexName) {
    return doc.collection.name
  } else {
    return indexName
  }
}

export function filterMappingFromMixed(props: Record<PropertyName, MappingProperty>): Record<PropertyName, MappingProperty> {
  const filteredMapping: Record<PropertyName, MappingProperty> = {}
  Object.keys(props).map((key) => {
    const field = props[key]
    if (field.type !== 'mixed') {
      filteredMapping[key] = field
      if (field.properties) {
        filteredMapping[key].properties = filterMappingFromMixed(field.properties)
        if (isEmpty(filteredMapping[key].properties)) {
          delete filteredMapping[key].properties
        }
      }
    }
  })
  return filteredMapping
}

export function serialize<T extends MongoosasticDocument>(model: T, mapping: GeneratedMapping): T | T[] | string {
  let name

  function _serializeObject(object: MongoosasticDocument, mappingData: GeneratedMapping) {
    const serialized: Record<string, unknown> = {}
    let field
    let val
    for (field in mappingData.properties) {
      if (mappingData.properties?.hasOwnProperty(field)) {
        val = serialize.call(object, object[field as keyof MongoosasticDocument], mappingData.properties[field])
        if (val !== undefined) {
          serialized[field] = val
        }
      }
    }
    return serialized as T
  }

  if (mapping.properties && model) {
    if (Array.isArray(model)) {
      return model.map((object) => _serializeObject(object, mapping))
    }

    return _serializeObject(model, mapping)
  }

  const outModel = mapping.cast ? mapping.cast(model) : model
  if (typeof outModel === 'object' && outModel !== null) {
    name = outModel.constructor.name
    if (name === 'ObjectId') {
      return outModel.toString()
    }

    if (name === 'Date') {
      return new Date(outModel).toJSON()
    }
  }

  return outModel
}

export async function deleteById(document: MongoosasticDocument, opt: DeleteByIdOptions): Promise<void> {
  await opt.client
    .delete(
      {
        index: opt.index,
        id: opt.id,
      },
      {}
    )
    .then((res) => document.emit('es-removed', null, res))
    .catch((error) => document.emit('es-removed', error, null))
}

export function reformatESTotalNumber<T = unknown>(
  res: ApiResponse<SearchResponse<T>>
): ApiResponse<SearchResponse<T>> {
  Object.assign(res.body.hits, {
    total: (res.body.hits.total as SearchTotalHits).value,
    extTotal: res.body.hits.total,
  })
  return res
}

export async function hydrate(
  res: ApiResponse<SearchResponse>,
  model: MongoosasticModel<MongoosasticDocument>,
  opts: EsSearchOptions
): Promise<ApiResponse<HydratedSearchResults>> {
  const options = model.esOptions()

  const clonedRes = res as ApiResponse<HydratedSearchResults>
  const results = clonedRes.body.hits

  const resultsMap: Record<string, number> = {}

  const ids = results.hits.map((result, idx) => {
    resultsMap[result._id] = idx
    return result._id
  })

  const query = model.find({
    _id: {
      $in: ids,
    },
  })
  const hydrateOptions = opts.hydrateOptions
    ? opts.hydrateOptions
    : options.hydrateOptions
      ? options.hydrateOptions
      : {}

  // Build Mongoose query based on hydrate options
  // Example: {lean: true, sort: '-name', select: 'address name'}
  query.setOptions(hydrateOptions)

  const docs = await query.exec()

  let hits
  const docsMap: Record<string, MongoosasticDocument> = {}

  if (!docs || docs.length === 0) {
    results.hits = []
    results.hydrated = []
    clonedRes.body.hits = results
    return clonedRes
  }

  if (hydrateOptions && hydrateOptions.sort) {
    // Hydrate sort has precedence over ES result order
    hits = docs
  } else {
    // Preserve ES result ordering
    docs.forEach((doc) => {
      docsMap[doc._id] = doc
    })
    hits = results.hits.map((result) => docsMap[result._id])
  }

  if (opts.highlight || opts.hydrateWithESResults) {
    hits.forEach((doc) => {
      const idx = resultsMap[doc._id]
      if (opts.highlight) {
        doc._highlight = results.hits[idx].highlight
      }
      if (opts.hydrateWithESResults) {
        // Add to doc ES raw result (with, e.g., _score value)
        doc._esResult = results.hits[idx]
        if (!opts.hydrateWithESResults.source) {
          // Remove heavy load
          delete doc._esResult._source
        }
      }
    })
  }

  results.hits = []
  results.hydrated = hits
  clonedRes.body.hits = results

  return clonedRes
}
