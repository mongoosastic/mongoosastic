import mongoose, { Schema } from 'mongoose'
import { MongoosasticDocument, MongoosasticModel } from '../../lib/types'
import mongoosastic from '../../lib/index'

export interface ITweet extends MongoosasticDocument {
	user: string,
	userId: number,
	post_date: Date,
	message: string,
}

// -- simplest indexing... index all fields
const TweetSchema = new Schema<MongoosasticDocument>({
	user: String,
	userId: Number,
	post_date: Date,
	message: String
})

TweetSchema.plugin(mongoosastic, {
	index: 'tweets',
	type: 'tweet'
})

export const Tweet = mongoose.model<ITweet, MongoosasticModel<ITweet>>('Tweet', TweetSchema)
