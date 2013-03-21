var mongoose  = require('mongoose')
  , Schema    = mongoose.Schema
  , mongoosastic = require('../../lib/mongoosastic');

// -- simplest indexing... index all fields
var TweetSchema = new Schema({
    user: String
  , userId: Number
  , post_date: Date
  , message: String
});

TweetSchema.plugin(mongoosastic)

module.exports = mongoose.model('Tweet', TweetSchema);
