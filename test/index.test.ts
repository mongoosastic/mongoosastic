import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { ITweet, Tweet } from './models/tweet'
import { QueryContainer } from '@elastic/elasticsearch/api/types'
import { MongoosasticDocument, MongoosasticModel } from '../lib/types'

const esClient = config.getClient()

interface ITalk extends MongoosasticDocument {
	speaker: string,
	year: number,
	title: string,
	abstract: string,
	bio: string,
}

// -- Only index specific field
const TalkSchema = new Schema<MongoosasticDocument>({
	speaker: String,
	year: {
		type: Number,
		es_indexed: true
	},
	title: {
		type: String,
		es_indexed: true
	},
	abstract: {
		type: String,
		es_indexed: true
	},
	bio: String
})

interface IBum extends MongoosasticDocument {
	name: string
}

const BumSchema = new Schema<MongoosasticDocument>({
	name: String
})

interface IPerson extends MongoosasticDocument {
	name: string,
	phone: string,
	address: string,
	life: {
		born: number,
		died: number
	}
}

const PersonSchema = new Schema<MongoosasticDocument>({
	name: {
		type: String,
		es_indexed: true
	},
	phone: {
		type: String,
		es_indexed: true
	},
	address: String,
	life: {
		born: {
			type: Number,
			es_indexed: true
		},
		died: {
			type: Number,
			es_indexed: true
		}
	}
})

const DogSchema = new Schema<MongoosasticDocument>({
	name: { type: String, es_indexed: true }
})

TalkSchema.plugin(mongoosastic)

PersonSchema.plugin(mongoosastic, {
	index: 'people',
	type: 'dude',
	alwaysHydrate: true,
	hydrateOptions: {
		lean: true,
		sort: '-name',
		select: 'address name life'
	}
})

BumSchema.plugin(mongoosastic, {
	index: 'ms_sample',
	type: 'bum'
})

DogSchema.plugin(mongoosastic, {
	indexAutomatically: false
})

const Person = mongoose.model<IPerson, MongoosasticModel<IPerson>>('Person', PersonSchema)
const Talk = mongoose.model<ITalk, MongoosasticModel<ITalk>>('Talk', TalkSchema)
const Bum = mongoose.model<IBum, MongoosasticModel<IBum>>('bum', BumSchema)
const Dog = mongoose.model('dog', DogSchema)

// -- alright let's test this shiznit!
describe('indexing', function () {
	
	beforeAll(function () {
		mongoose.connect(config.mongoUrl, config.mongoOpts, async function () {
			await config.deleteDocs([Tweet, Person, Talk, Bum, Dog])
			await config.deleteIndexIfExists(['tweets', 'talks', 'people', 'ms_sample', 'dogs'])
		})
	})

	afterAll(async function () {
		await config.deleteDocs([Tweet, Person, Talk, Bum, Dog])
		await config.deleteIndexIfExists(['tweets', 'talks', 'people', 'ms_sample', 'dogs'])
		
		mongoose.disconnect()
		esClient.close()
	})

	describe('Creating Index', function () {
		it('should create index if none exists', async function () {
			const response = await Tweet.createMapping()

			expect(response).toBeTruthy()
			expect(response).not.toHaveProperty('error')
		})

		it('should create index with settings if none exists', async function () {
			const response = await Tweet.createMapping({
				analysis: {
					analyzer: {
						stem: {
							tokenizer: 'standard',
							filter: ['standard', 'lowercase', 'stop', 'porter_stem']
						}
					}
				}
			})

			expect(response).toBeTruthy()
			expect(response).not.toHaveProperty('error')
		})

		it('should update index if one already exists', async function () {
			const response = await Tweet.createMapping()
			expect(response).not.toHaveProperty('error')
		})

		afterAll(async function () {
			await config.deleteIndexIfExists(['tweets', 'talks', 'people'])
		})
	})

	describe('Default plugin', function () {
		beforeAll(async function() {
			await config.createModelAndEnsureIndex(Tweet, {
				user: 'jamescarr',
				userId: 1,
				message: 'I like Riak better',
				post_date: new Date()
			})
		})

		it('should use the model\'s id as ES id', async function () {
			const doc = await Tweet.findOne({ message: 'I like Riak better' })
			const esDoc = await esClient.get({
				index: 'tweets',
				id: doc?.get('_id').toString()
			})
			
			expect(esDoc.body._source.message).toEqual(doc?.get('message'))
		})

		it('should be able to execute a simple query', async function () {
			const results = await Tweet.search({
				query_string: {
					query: 'Riak'
				}
			})

			expect(results?.body.hits.total).toEqual(1)
			expect(results?.body.hits.hits[0]._source?.message).toEqual('I like Riak better')
		})

		it('should be able to execute a simple query', async function () {
			const results = await Tweet.search({
				query_string: {
					query: 'jamescarr'
				}
			})

			expect(results?.body.hits.total).toEqual(1)
			expect(results?.body.hits.hits[0]._source?.message).toEqual('I like Riak better')
		})

		it('should reindex when findOneAndUpdate', async function() {
			await Tweet.findOneAndUpdate({
				message: 'I like Riak better'
			}, {
				message: 'I like Jack better'
			}, {
				new: true
			})

			await config.sleep(config.INDEXING_TIMEOUT)

			const results = await Tweet.search({
				query_string: {
					query: 'Jack'
				}
			})

			expect(results?.body.hits.total).toEqual(1)
			expect(results?.body.hits.hits[0]._source?.message).toEqual('I like Jack better')

		})

		it('should be able to execute findOneAndUpdate if document doesn\'t exist', function (done) {
			Tweet.findOneAndUpdate({
				message: 'Not existing document'
			}, {
				message: 'I like Jack better'
			}, {
				new: true
			}, function (err, doc) {
				expect(err).toBeFalsy()
				expect(doc).toBeFalsy()
				done()
			})
		})

		it('should be able to index with insertMany', async function () {
			const tweets = [{
				message: 'insertMany 1'
			}, {
				message: 'insertMany 2'
			}]

			await Tweet.insertMany(tweets)
			await config.sleep(config.INDEXING_TIMEOUT)

			const results = await Tweet.search({
				query_string: {
					query: 'insertMany'
				}
			})

			expect(results?.body.hits.total).toEqual(2)

			const expected = tweets.map((doc) => doc.message)
			const searched = results?.body.hits.hits.map((doc) => doc._source?.message)

			expect(expected.sort()).toEqual(searched?.sort())
		})

		it('should report errors', async function () {
			await Tweet.search({
				queriez: 'jamescarr'
			} as QueryContainer)
				.then(results => expect(results).toBeFalsy())
				.catch(error => expect(error.message).toMatch(/(SearchPhaseExecutionException|parsing_exception)/))
		})
	})

	describe('Removing', function () {

		let tweet: ITweet

		beforeEach(async function() {
			tweet = new Tweet({
				user: 'jamescarr',
				message: 'Saying something I shouldnt'
			})
			await config.createModelAndEnsureIndex(Tweet, tweet)
		})

		it('should remove from index when model is removed', async function () {
			await tweet.remove()
			await config.sleep(config.INDEXING_TIMEOUT)

			const res = await Tweet.search({
				query_string: {
					query: 'shouldnt'
				}
			})

			expect(res?.body.hits.total).toEqual(0)
		})

		it('should remove only index', async function (done) {
			tweet.on('es-removed', async function () {
				await config.sleep(config.INDEXING_TIMEOUT)
				
				const res = await Tweet.search({
					query_string: {
						query: 'shouldnt'
					}
				})

				expect(res?.body.hits.total).toEqual(0)
				done()
			})

			await tweet.unIndex()
		})

		it('should queue for later removal if not in index', async function() {
			// behavior here is to try 3 times and then give up.
			const tweet = new Tweet()
			let triggerRemoved = false

			tweet.on('es-removed', function(err: unknown) {
				expect(err).toBeTruthy()
				triggerRemoved = true
			})
			
			await tweet.unIndex()
			expect(triggerRemoved).toEqual(true)
		})

		it('should remove from index when findOneAndRemove', async function() {
			tweet = new Tweet({
				user: 'jamescarr',
				message: 'findOneAndRemove'
			})

			await config.createModelAndEnsureIndex(Tweet, tweet)

			await Tweet.findByIdAndRemove(tweet._id)

			await config.sleep(config.INDEXING_TIMEOUT)

			const res = await Tweet.search({
				query_string: {
					query: 'findOneAndRemove'
				}
			})

			expect(res?.body.hits.total).toEqual(0)
		})

		it('should be able to execute findOneAndRemove if document doesn\'t exist', function (done) {
			Tweet.findOneAndRemove({
				message: 'Not existing document'
			}, {}, (err, doc) => {
				expect(err).toBeFalsy()
				expect(doc).toBeFalsy()
				done()
			})
		})
	})

	describe('Isolated Models', function () {

		beforeAll(async function (done) {
			const talk = new Talk({
				speaker: '',
				year: 2013,
				title: 'Dude',
				abstract: '',
				bio: ''
			})
			const tweet = new Tweet({
				user: 'Dude',
				message: 'Go see the big lebowski',
				post_date: new Date()
			})

			await tweet.save()
			await talk.save()

			talk.on('es-indexed', function () {
				setTimeout(done, config.INDEXING_TIMEOUT as number)
			})
		})

		it('should only find models of type Tweet', async function () {
			
			const res = await Tweet.search({
				query_string: {
					query: 'Dude'
				}
			})

			expect(res?.body.hits.total).toEqual(1)
			expect(res?.body.hits.hits[0]._source?.user).toEqual('Dude')
		})

		it('should only find models of type Talk', async function () {
			
			const res = await Talk.search({
				query_string: {
					query: 'Dude'
				}
			})

			expect(res?.body.hits.total).toEqual(1)
			expect(res?.body.hits.hits[0]._source?.title).toEqual('Dude')
		})
	})

	describe('Always hydrate', function () {
		beforeAll(async function() {
			await config.createModelAndEnsureIndex(Person, {
				name: 'James Carr',
				address: 'Exampleville, MO',
				phone: '(555)555-5555'
			})
		})

		it('when gathering search results while respecting default hydrate options', async function () {
			
			const res = await Person.search({
				query_string: {
					query: 'James'
				}
			})

			const hit = res?.body.hits.hydrated[0] as IPerson

			expect(hit.address).toEqual('Exampleville, MO')
			expect(hit.name).toEqual('James Carr')
			expect(hit).not.toHaveProperty('phone')
			expect(hit).not.toBeInstanceOf(Person)
		})
	})
	
	describe('Subset of Fields', function () {
		beforeAll(async function() {
			await config.createModelAndEnsureIndex(Talk, {
				speaker: 'James Carr',
				year: 2013,
				title: 'Node.js Rocks',
				abstract: 'I told you node.js was cool. Listen to me!',
				bio: 'One awesome dude.'
			})
		})

		it('should only return indexed fields', async function () {
			
			const res = await Talk.search({
				query_string: {
					query: 'cool'
				}
			})

			const talk = res?.body.hits.hits[0]._source

			expect(res?.body.hits.total).toEqual(1)
			expect(talk).toHaveProperty('title')
			expect(talk).toHaveProperty('year')
			expect(talk).toHaveProperty('abstract')
			expect(talk).not.toHaveProperty('speaker')
			expect(talk).not.toHaveProperty('bio')
		})

		it('should hydrate returned documents if desired', async function () {
			
			const res = await Talk.search({
				query_string: {
					query: 'cool'
				}
			}, {
				hydrate: true
			})

			const talk = res?.body.hits.hydrated[0]

			expect(res?.body.hits.total).toEqual(1)
			expect(talk).toHaveProperty('title')
			expect(talk).toHaveProperty('year')
			expect(talk).toHaveProperty('abstract')
			expect(talk).toHaveProperty('speaker')
			expect(talk).toHaveProperty('bio')
			expect(talk).toBeInstanceOf(Talk)
		})

		describe('Sub-object Fields', function () {
			beforeAll(async function() {
				await config.createModelAndEnsureIndex(Person, {
					name: 'Bob Carr',
					address: 'Exampleville, MO',
					phone: '(555)555-5555',
					life: {
						born: 1950,
						other: 2000
					}
				})
			})

			it('should only return indexed fields and have indexed sub-objects', async function () {
				
				const res = await Person.search({
					query_string: {
						query: 'Bob'
					}
				})

				const hit = res?.body.hits.hydrated[0]

				expect(hit.address).toEqual('Exampleville, MO')
				expect(hit.name).toEqual('Bob Carr')					
				expect(hit).toHaveProperty('life')
				expect(hit.life.born).toEqual(1950)
				expect(hit.life).not.toHaveProperty('died')
				expect(hit.life).not.toHaveProperty('other')
				expect(hit).not.toHaveProperty('phone')
				expect(hit).not.toBeInstanceOf(Person)
			})
		})

		it('should allow extra query options when hydrating', async function () {
			
			const res = await Talk.search({
				query_string: {
					query: 'cool'
				}
			}, {
				hydrate: true,
				hydrateOptions: {
					lean: true
				}
			})

			const talk = res?.body.hits.hydrated[0]

			expect(res?.body.hits.total).toEqual(1)
			expect(talk).toHaveProperty('title')
			expect(talk).toHaveProperty('year')
			expect(talk).toHaveProperty('abstract')
			expect(talk).toHaveProperty('speaker')
			expect(talk).toHaveProperty('bio')
			expect(talk).not.toBeInstanceOf(Talk)
		})
	})

	describe('Existing Index', function () {
		beforeAll(async function () {
			await config.deleteIndexIfExists(['ms_sample'])
			await esClient.indices.create({
				index: 'ms_sample',
				body: {
					mappings: {
						properties: {
							name: {
								type: 'text'
							}
						}
					}
				}
			})
		})

		it('should just work', async function() {
			await config.createModelAndEnsureIndex(Bum, {
				name: 'Roger Wilson'
			})

			const results = await Bum.search({
				query_string: {
					query: 'Wilson'
				}
			})

			expect(results?.body.hits.total).toEqual(1)
		})
	})

	describe('Disable automatic indexing', function () {

		it('should save but not index', async function (done) {
			const newDog = new Dog({ name: 'Sparky' })

			let whoopsIndexed = false

			await newDog.save()

			newDog.on('es-indexed', function () {
				whoopsIndexed = true
			})

			setTimeout(function () {
				expect(whoopsIndexed).toBeFalsy()
				done()
			}, config.INDEXING_TIMEOUT)
		})
	})
})
