/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClientOptions, ApiResponse, Client } from '@elastic/elasticsearch'
import { Highlight, CountResponse, RefreshResponse, SearchResponse, QueryContainer, SearchRequest, TypeMapping, Hit, PropertyName, Property, HitsMetadata } from '@elastic/elasticsearch/api/types'
import { RequestBody } from '@elastic/elasticsearch/lib/Transport'
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

declare interface GeneratedMapping extends TypeMapping {
    cast?(doc: any): any
}

declare interface HydratedSearchResults<TDocument = unknown> extends SearchResponse<TDocument> {
    hits: HydratedSearchHits<TDocument>
}

declare interface HydratedSearchHits<TDocument> extends HitsMetadata<TDocument> {
    hydrated: Array<TDocument>
}

declare type IndexInstruction = {
    index: {
        _index: string,
        _id: string,
    }
}

declare type DeleteInstruction = {
    delete: {
        _index: string,
        _id: string,
    }
}

declare type BulkInstruction = IndexInstruction | DeleteInstruction | Record<string, unknown>

declare interface BulkOptions {
    delay: number,
    size: number,
    batch: number,
}

declare interface IndexMethodOptions {
    index?: string,
}

declare interface SynchronizeOptions {
    saveOnSynchronize?: boolean
}

declare interface BulkIndexOptions {
    index: string,
    id: string,
    body: any,
    bulk?: BulkOptions,
    refresh?: boolean,
    model: MongoosasticModel<MongoosasticDocument>,
    routing?: RoutingFn,
}

declare interface BulkUnIndexOptions {
    index: string,
    id: string,
    bulk?: BulkOptions,
    model: MongoosasticModel<MongoosasticDocument>,
    tries?: number,
    routing?: RoutingFn,
}

declare interface DeleteByIdOptions {
    index: string,
    id: string,
    tries: number,
    client: Client
}

declare type Options = {
    clientOptions?: ClientOptions,
    index?: string,
    populate?: PopulateOptions[],
    bulk?: BulkOptions,
    filter?: FilterFn,
    routing?: RoutingFn,
    alwaysHydrate?: boolean,
    hydrateOptions?: QueryOptions,
    transform?: TransformFn,
    indexAutomatically?: boolean,
    forceIndexRefresh?: boolean,
    properties?: any,
    customSerialize?(model: Document | MongoosasticModel<Document>, ...args: any): any;
    saveOnSynchronize?: boolean
}

declare type EsSearchOptions = {
    index?: string,
    highlight?: Highlight,
    suggest?: any,
    aggs?: any,
    min_score?: any,
    routing?: any,
    sort?: any,
    hydrate?: boolean,
    hydrateOptions?: QueryOptions,
    hydrateWithESResults?: any
}

declare interface MongoosasticDocument<TDocument = any> extends Document<TDocument>, EventEmitter {

    _highlight?: Record<string, string[]> | undefined
    _esResult?: Hit<TDocument>
    
    index(opts?: IndexMethodOptions): Promise<MongoosasticDocument | ApiResponse>
    unIndex(): Promise<MongoosasticDocument>
    
    esOptions(): Options
    esClient(): Client
}

interface MongoosasticModel<T> extends Model<T> {

    search(query: QueryContainer, options?: EsSearchOptions): Promise<ApiResponse<HydratedSearchResults<T>>>;

    esSearch(query: SearchRequest['body'], options?: EsSearchOptions): Promise<ApiResponse<HydratedSearchResults<T>>>;

    synchronize(query?: any, options?: SynchronizeOptions): EventEmitter;
    esTruncate(): Promise<void>
    
    esOptions(): Options
    esClient(): Client
    bulkError(): EventEmitter

    createMapping(body?: RequestBody): Promise<Record<PropertyName, Property>>
    getMapping(): Record<string, any>
    getCleanTree(): Record<string, any>

    esCount(query?: QueryContainer): Promise<ApiResponse<CountResponse>>
    refresh(): Promise<ApiResponse<RefreshResponse>>
    flush(): Promise<void>
}

export {
	Options,
	MongoosasticModel,
	MongoosasticDocument,
	EsSearchOptions,
	BulkIndexOptions,
	BulkUnIndexOptions,
	IndexMethodOptions,
	BulkOptions,
	SynchronizeOptions,
	DeleteByIdOptions,
	GeneratedMapping,
	HydratedSearchResults,
	BulkInstruction
}