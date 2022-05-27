/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiResponse, Client, ClientOptions } from '@elastic/elasticsearch'
import {
  CountResponse,
  IndicesCreateRequest,
  IndicesRefreshResponse,
  MappingProperty,
  MappingTypeMapping,
  PropertyName,
  QueryDslQueryContainer,
  SearchHighlight,
  SearchHit,
  SearchHitsMetadata,
  SearchRequest,
  SearchResponse,
} from '@elastic/elasticsearch/api/types'
import { EventEmitter } from 'events'
import { Document, Model, PopulateOptions, QueryOptions } from 'mongoose'

declare interface FilterFn {
  (doc: Document): boolean;
}

declare interface TransformFn {
  (body: Record<string, unknown>, doc: Document): any;
}

declare interface RoutingFn {
  (doc: Document): any;
}

declare interface GeneratedMapping extends MappingTypeMapping {
  cast?(doc: any): any;
}

declare interface HydratedSearchResults<TDocument = unknown> extends SearchResponse<TDocument> {
  hits: HydratedSearchHits<TDocument>;
}

declare interface HydratedSearchHits<TDocument> extends SearchHitsMetadata<TDocument> {
  hydrated: Array<TDocument>;
}

declare type IndexInstruction = {
  index: {
    _index: string;
    _id: string;
  };
};

declare type DeleteInstruction = {
  delete: {
    _index: string;
    _id: string;
  };
};

declare type BulkInstruction = IndexInstruction | DeleteInstruction | Record<string, unknown>;

declare interface BulkOptions {
  batch: number;
  delay: number;
  size: number;
}

declare interface IndexMethodOptions {
  index?: string;
}

declare interface SynchronizeOptions {
  saveOnSynchronize?: boolean;
}

declare interface BulkIndexOptions {
  body: any;
  bulk?: BulkOptions;
  id: string;
  index: string;
  model: MongoosasticModel<MongoosasticDocument>;
  refresh?: boolean;
  routing?: RoutingFn;
}

declare interface BulkUnIndexOptions {
  bulk?: BulkOptions;
  id: string;
  index: string;
  model: MongoosasticModel<MongoosasticDocument>;
  routing?: RoutingFn;
  tries?: number;
}

declare interface DeleteByIdOptions {
  client: Client;
  id: string;
  index: string;
  tries: number;
}

declare type Options = {
  esClient?: Client;
  alwaysHydrate?: boolean;
  bulk?: BulkOptions;
  clientOptions?: ClientOptions;
  customSerialize?(model: Document | MongoosasticModel<Document>, ...args: any): any;
  filter?: FilterFn;
  forceIndexRefresh?: boolean;
  hydrateOptions?: QueryOptions;
  index?: string;
  indexAutomatically?: boolean;
  populate?: PopulateOptions[];
  properties?: any;
  routing?: RoutingFn;
  saveOnSynchronize?: boolean;
  transform?: TransformFn;
};

declare type EsSearchOptions = {
  aggs?: any;
  highlight?: SearchHighlight;
  hydrate?: boolean;
  hydrateOptions?: QueryOptions;
  hydrateWithESResults?: any;
  index?: string;
  min_score?: any;
  routing?: any;
  sort?: any;
  suggest?: any;
};

declare interface MongoosasticDocument<TDocument = any> extends Document<TDocument>, EventEmitter {
  _highlight?: Record<string, string[]> | undefined;
  _esResult?: SearchHit<TDocument>;

  esClient(): Client;

  esOptions(): Options;

  index(opts?: IndexMethodOptions): Promise<MongoosasticDocument | ApiResponse>;

  unIndex(): Promise<MongoosasticDocument>;
}

interface MongoosasticModel<T> extends Model<T> {
  bulkError(): EventEmitter;

  createMapping(body?: IndicesCreateRequest['body']): Promise<Record<PropertyName, MappingProperty>>;

  esClient(): Client;

  esCount(query?: QueryDslQueryContainer): Promise<ApiResponse<CountResponse>>;

  esOptions(): Options;

  esSearch(query: SearchRequest['body'], options?: EsSearchOptions): Promise<ApiResponse<HydratedSearchResults<T>>>;

  esTruncate(): Promise<void>;

  flush(): Promise<void>;

  getCleanTree(): Record<string, any>;

  getMapping(): Record<string, any>;

  refresh(): Promise<ApiResponse<IndicesRefreshResponse>>;

  search(query: QueryDslQueryContainer, options?: EsSearchOptions): Promise<ApiResponse<HydratedSearchResults<T>>>;

  synchronize(query?: any, options?: SynchronizeOptions): EventEmitter;

  bulkAdd(opts: BulkIndexOptions): Promise<void>
}

export {
  BulkIndexOptions,
  BulkInstruction,
  BulkOptions,
  BulkUnIndexOptions,
  DeleteByIdOptions,
  EsSearchOptions,
  GeneratedMapping,
  HydratedSearchResults,
  IndexMethodOptions,
  MongoosasticDocument,
  MongoosasticModel,
  Options,
  SynchronizeOptions,
}
