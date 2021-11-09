'use strict'

import mongoose, { Schema } from 'mongoose'
import { config } from './config'
import mongoosastic from '../lib/index'
import { ITweet, Tweet } from './models/tweet'
import { QueryContainer } from '@elastic/elasticsearch/api/types'
import { PluginDocument } from 'types'

const esClient = config.getClient()

// -- Only index specific field
const TalkSchema = new Schema({
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

const BumSchema = new Schema({
	name: String
})

interface IPerson extends PluginDocument {
	name: string,
	phone: string,
	address: string,
	life: {
		born: number,
		died: number
	}
}

const PersonSchema = new Schema({
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

const DogSchema = new Schema({
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

const Person = mongoose.model<IPerson>('Person', PersonSchema)
const Talk = mongoose.model('Talk', TalkSchema)
const Bum = mongoose.model('bum', BumSchema)
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
		it('should create index if none exists', function (done) {
			Tweet.createMapping(undefined, function (err, response) {
				expect(response).toBeTruthy()
				expect(response).not.toHaveProperty('error')
				done()
			})
		})

		it('should create index with settings if none exists', function (done) {
			Tweet.createMapping({
				analysis: {
					analyzer: {
						stem: {
							tokenizer: 'standard',
							filter: ['standard', 'lowercase', 'stop', 'porter_stem']
						}
					}
				}
			}, function (err, response) {
				expect(response).toBeTruthy()
				expect(response).not.toHaveProperty('error')
				done()
			})
		})

		it('should update index if one already exists', function (done) {
			Tweet.createMapping(undefined, function (err, response) {
				expect(response).not.toHaveProperty('error')
				done()
			})
		})

		afterAll(async function () {
			await config.deleteIndexIfExists(['tweets', 'talks', 'people'])
		})
	})

	describe('Default plugin', function () {
		beforeAll(function (done) {
			config.createModelAndEnsureIndex(Tweet, {
				user: 'jamescarr',
				userId: 1,
				message: 'I like Riak better',
				post_date: new Date()
			}, done)
		})

		it('should use the model\'s id as ES id', async function () {
			const doc = await Tweet.findOne({ message: 'I like Riak better' })
			const esDoc = await esClient.get({
				index: 'tweets',
				id: doc?.get('_id').toString()
			})
			
			expect(esDoc.body._source.message).toEqual(doc?.get('message'))
		})

		it('should be able to execute a simple query', function (done) {
			Tweet.search({
				query_string: {
					query: 'Riak'
				}
			}, function (err, results) {
				expect(results?.body.hits.total).toEqual(1)
				expect(results?.body.hits.hits[0]._source?.message).toEqual('I like Riak better')
				done()
			})
		})

		it('should be able to execute a simple query', function (done) {
			Tweet.search({
				query_string: {
					query: 'jamescarr'
				}
			}, function (err, results) {
				expect(results?.body.hits.total).toEqual(1)
				expect(results?.body.hits.hits[0]._source?.message).toEqual('I like Riak better')
				done()
			})
		})

		it('should reindex when findOneAndUpdate', async function(done) {
			await Tweet.findOneAndUpdate({
				message: 'I like Riak better'
			}, {
				message: 'I like Jack better'
			}, {
				new: true
			})

			setTimeout(function() {
				Tweet.search({
					query_string: {
						query: 'Jack'
					}
				}, function (err, results) {
					expect(results?.body.hits.total).toEqual(1)
					expect(results?.body.hits.hits[0]._source?.message).toEqual('I like Jack better')
					done()
				})
			}, config.INDEXING_TIMEOUT)

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

		it('should be able to index with insertMany', async function (done) {
			const tweets = [{
				message: 'insertMany 1'
			}, {
				message: 'insertMany 2'
			}]

			await Tweet.insertMany(tweets)

			setTimeout(function() {
				Tweet.search({
					query_string: {
						query: 'insertMany'
					}
				}, (error, results) => {
					
					expect(results?.body.hits.total).toEqual(2)

					const expected = tweets.map((doc) => doc.message)
					const searched = results?.body.hits.hits.map((doc) => doc._source?.message)

					expect(expected.sort()).toEqual(searched?.sort())
					done()
				})
			}, config.INDEXING_TIMEOUT)
		})

		it('should report errors', function (done) {
			Tweet.search({
				queriez: 'jamescarr'
			} as QueryContainer, {}, function (err, results) {
				expect(err.message).toMatch(/(SearchPhaseExecutionException|parsing_exception)/)
				expect(results).toBeFalsy()
				done()
			})
		})
	})

	describe('Removing', function () {

		let tweet: ITweet

		beforeEach(function (done) {
			tweet = new Tweet({
				user: 'jamescarr',
				message: 'Saying something I shouldnt'
			})
			config.createModelAndEnsureIndex(Tweet, tweet, done)
		})

		it('should remove from index when model is removed', async function (done) {
			await tweet.remove()

			setTimeout(function () {
				Tweet.search({
					query_string: {
						query: 'shouldnt'
					}
				}, function (err, res) {
					expect(res?.body.hits.total).toEqual(0)
					done()
				})
			}, config.INDEXING_TIMEOUT)
		})

		it('should remove only index', function (done) {
			tweet.on('es-removed', function () {
				setTimeout(function () {
					Tweet.search({
						query_string: {
							query: 'shouldnt'
						}
					}, function (err, res) {
						expect(res?.body.hits.total).toEqual(0)
						done()
					})
				}, config.INDEXING_TIMEOUT)
			})

			tweet.unIndex()
		})

		it('should queue for later removal if not in index', function (done) {
			// behavior here is to try 3 times and then give up.
			const tweet = new Tweet()
			let triggerRemoved = false

			tweet.on('es-removed', function() {
				triggerRemoved = true
			})
			tweet.unIndex(function (err: unknown) {
				expect(err).toBeTruthy()
				expect(triggerRemoved).toEqual(true)
				done()
			})
		})

		it('should remove from index when findOneAndRemove', function (done) {
			tweet = new Tweet({
				user: 'jamescarr',
				message: 'findOneAndRemove'
			})

			config.createModelAndEnsureIndex(Tweet, tweet, function () {
				Tweet.findByIdAndRemove(tweet._id, {}, () => {
					setTimeout(function () {
						Tweet.search({
							query_string: {
								query: 'findOneAndRemove'
							}
						}, {}, function (err, res) {
							expect(res?.body.hits.total).toEqual(0)
							done()
						})
					}, config.INDEXING_TIMEOUT)
				})
			})
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

		it('should only find models of type Tweet', function (done) {
			Tweet.search({
				query_string: {
					query: 'Dude'
				}
			}, function (err, res) {
				expect(res?.body.hits.total).toEqual(1)
				expect(res?.body.hits.hits[0]._source?.user).toEqual('Dude')
				done()
			})
		})

		it('should only find models of type Talk', function (done) {
			Talk.search({
				query_string: {
					query: 'Dude'
				}
			}, function (err, res) {
				expect(res?.body.hits.total).toEqual(1)
				expect(res?.body.hits.hits[0]._source.title).toEqual('Dude')
				done()
			})
		})
	})

	describe('Always hydrate', function () {
		beforeAll(function (done) {
			config.createModelAndEnsureIndex(Person, {
				name: 'James Carr',
				address: 'Exampleville, MO',
				phone: '(555)555-5555'
			}, done)
		})

		it('when gathering search results while respecting default hydrate options', function (done) {
			Person.search({
				query_string: {
					query: 'James'
				}
			}, function (err, res) {

				const hit = res?.body.hits.hydrated[0] as IPerson

				expect(hit.address).toEqual('Exampleville, MO')
				expect(hit.name).toEqual('James Carr')
				expect(hit).not.toHaveProperty('phone')
				expect(hit).not.toBeInstanceOf(Person)
				done()
			})
		})
	})
	
	describe('Subset of Fields', function () {
		beforeAll(function (done) {
			config.createModelAndEnsureIndex(Talk, {
				speaker: 'James Carr',
				year: 2013,
				title: 'Node.js Rocks',
				abstract: 'I told you node.js was cool. Listen to me!',
				bio: 'One awesome dude.'
			}, done)
		})

		it('should only return indexed fields', function (done) {
			Talk.search({
				query_string: {
					query: 'cool'
				}
			}, {}, function (err, res) {
				const talk = res?.body.hits.hits[0]._source

				expect(res?.body.hits.total).toEqual(1)
				expect(talk).toHaveProperty('title')
				expect(talk).toHaveProperty('year')
				expect(talk).toHaveProperty('abstract')
				expect(talk).not.toHaveProperty('speaker')
				expect(talk).not.toHaveProperty('bio')
				done()
			})
		})

		it('should hydrate returned documents if desired', function (done) {
			Talk.search({
				query_string: {
					query: 'cool'
				}
			}, {
				hydrate: true
			}, function (err, res) {
				const talk = res?.body.hits.hydrated[0]

				expect(res?.body.hits.total).toEqual(1)
				expect(talk).toHaveProperty('title')
				expect(talk).toHaveProperty('year')
				expect(talk).toHaveProperty('abstract')
				expect(talk).toHaveProperty('speaker')
				expect(talk).toHaveProperty('bio')
				expect(talk).toBeInstanceOf(Talk)
				done()
			})
		})

		describe('Sub-object Fields', function () {
			beforeAll(function (done) {
				config.createModelAndEnsureIndex(Person, {
					name: 'Bob Carr',
					address: 'Exampleville, MO',
					phone: '(555)555-5555',
					life: {
						born: 1950,
						other: 2000
					}
				}, done)
			})

			it('should only return indexed fields and have indexed sub-objects', function (done) {
				Person.search({
					query_string: {
						query: 'Bob'
					}
				}, function (err, res) {
					const hit = res?.body.hits.hydrated[0] as IPerson

					expect(hit.address).toEqual('Exampleville, MO')
					expect(hit.name).toEqual('Bob Carr')					
					expect(hit).toHaveProperty('life')
					expect(hit.life.born).toEqual(1950)
					expect(hit.life).not.toHaveProperty('died')
					expect(hit.life).not.toHaveProperty('other')
					expect(hit).not.toHaveProperty('phone')
					expect(hit).not.toBeInstanceOf(Person)
					done()
				})
			})
		})

		it('should allow extra query options when hydrating', function (done) {
			Talk.search({
				query_string: {
					query: 'cool'
				}
			}, {
				hydrate: true,
				hydrateOptions: {
					lean: true
				}
			}, function (err, res) {
				const talk = res?.body.hits.hydrated[0]

				expect(res?.body.hits.total).toEqual(1)
				expect(talk).toHaveProperty('title')
				expect(talk).toHaveProperty('year')
				expect(talk).toHaveProperty('abstract')
				expect(talk).toHaveProperty('speaker')
				expect(talk).toHaveProperty('bio')
				expect(talk).not.toBeInstanceOf(Talk)
				done()
			})
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

		it('should just work', function (done) {
			config.createModelAndEnsureIndex(Bum, {
				name: 'Roger Wilson'
			}, function () {
				Bum.search({
					query_string: {
						query: 'Wilson'
					}
				}, {}, function (err, results) {
					expect(results?.body.hits.total).toEqual(1)
					done()
				})
			})
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
