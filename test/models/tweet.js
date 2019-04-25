'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema
const mongoosastic = require('../../lib/mongoosastic')

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

module.exports = mongoose.model('Tweet', TweetSchema)
