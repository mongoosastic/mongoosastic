/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClientOptions, ApiResponse, Client } from '@elastic/elasticsearch'
import { Highlight, BulkResponse, CountResponse, RefreshResponse, SearchResponse, QueryContainer, SearchRequest, TypeMapping, Hit, PropertyName, Property, HitsMetadata } from '@elastic/elasticsearch/api/types'
import { RequestBody } from '@elastic/elasticsearch/lib/Transport'
import { EventEmitter } from 'events'
import { Schema } from 'mongoose'
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
    routing?: RoutingFn,
    client: Client
}

declare interface BulkUnIndexOptions {
    index: string,
    id: string,
    bulk?: BulkOptions,
    document?: PluginDocument,
    tries?: number,
    routing?: RoutingFn,
    client: Client
}

declare interface DeleteByIdOptions {
    index: string,
    id: string,
    document: PluginDocument,
    tries: number,
    client: Client
}

declare interface HydratedSearchResults<TDocument = unknown> extends SearchResponse<TDocument> {
    hits: HydratedSearchHits<TDocument>
}

declare interface HydratedSearchHits<TDocument> extends HitsMetadata<TDocument> {
    hydrated: Array<TDocument>
}

declare class PluginDocument<TDocument = any> extends Document<TDocument> {

    _highlight?: Record<string, string[]> | undefined
    _esResult?: Hit<TDocument>
    
    index(opts?: IndexMethodOptions): Promise<PluginDocument | ApiResponse>
    unIndex(): Promise<PluginDocument>
    
    emit(event: string, ...args: any): void
    esOptions(): Options
    esClient(): Client
    on(event: string, cb?: CallableFunction): void
    once(event: string, cb?: CallableFunction): void
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
    customSerialize?(model: Document | Model<Document>, ...args: any): any;
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

declare module 'mongoosastic' {
    const Mongoosastic: (schema: Schema, Options?: Partial<Options>) => void
    export = Mongoosastic;
}

declare module 'mongoose' {

    export interface Model<T extends Document> {
        // search(query: QueryContainer): Promise<ApiResponse<SearchResponse, unknown> | ApiResponse<HydratedSearchResults>>;
        search(query: QueryContainer, options?: EsSearchOptions): Promise<ApiResponse<HydratedSearchResults<T>>>;

        // esSearch(query: SearchRequest['body']): Promise<ApiResponse<SearchResponse, unknown> | ApiResponse<HydratedSearchResults>>;
        esSearch(query: SearchRequest['body'], options?: EsSearchOptions): Promise<ApiResponse<HydratedSearchResults<T>>>;

        synchronize(query?: any, options?: any): EventEmitter;
        
        esOptions(): Options
        esClient(): Client

        createMapping(body?: RequestBody): Promise<Record<PropertyName, Property>>
        esTruncate(): Promise<void>

        // esCount(): void
        esCount(query?: QueryContainer): Promise<ApiResponse<CountResponse>>

        refresh(): Promise<ApiResponse<SearchResponse, unknown>>
    }
}

export {
	Options,
	PluginDocument,
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