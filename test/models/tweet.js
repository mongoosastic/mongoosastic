'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema
const config = require('../config')
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
  type: 'tweet',
  esClient: config.getClient()
})

module.exports = mongoose.model('Tweet', TweetSchema)
