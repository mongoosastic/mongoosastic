'use strict'

import mongoose, { Schema } from 'mongoose'
import { PluginDocument } from 'types'
import mongoosastic from '../../lib/index'

export interface ITweet extends PluginDocument {
	user: string,
	userId: number,
	post_date: Date,
	message: string,
}

// -- simplest indexing... index all fields
const TweetSchema = new Schema({
	user: String,
	userId: Number,
	post_date: Date,
	message: String
})

TweetSchema.plugin(mongoosastic, {
	index: 'tweets',
	type: 'tweet'
})

export const Tweet = mongoose.model<ITweet>('Tweet', TweetSchema)
