var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , mongoosastic = require('../lib/mongoosastic')
  , esClient  = new(require('elastical').Client)

var TweetSchema = new Schema({
    user: String
  , post_date: Date
  , message: String
});


TweetSchema.plugin(mongoosastic, {
    index:'tweets'
  , type: 'tweet'
})
var Tweet = mongoose.model('Tweet', TweetSchema);



describe('indexing', function(){
  before(function(done){
    mongoose.connect(config.mongoUrl, function(){
      Tweet.remove(function(){
        deleteIndexIfExists('tweets', done)
      });
    });
  });

  after(function(done){
    Tweet.remove(function(){
      mongoose.disconnect();
      done();
    });
  });

  describe('Default plugin', function(){
    before(function(done){
      var tweet = new Tweet({
          user: 'jamescarr'
        , message: "I like Riak better"
        , post_date: new Date()
      });
      tweet.save(function(){
        tweet.on('es-indexed', function(err, res){
          setTimeout(done, 1100)
        });
      });
    });
    it('should be able to execute a simple query', function(done){
      Tweet.search({query:'Riak'}, function(err, results) {
        results.total.should.eql(1)
        results.hits[0].message.should.eql('I like Riak better')
        done()
      });
    });
    it('should be able to execute a simple query', function(done){
      Tweet.search({query:'jamescarr'}, function(err, results) {
        results.total.should.eql(1)
        results.hits[0].message.should.eql('I like Riak better')
        done()
      });
    });
    it('should report errors', function(done){
      Tweet.search({queriez:'jamescarr'}, function(err, results) {
        results.total.should.eql(1)
        results.hits[0].message.should.eql('I like Riak better')
        done()
      });
    });
  });
});


function deleteIndexIfExists(index, cb){
  esClient.indexExists(index, function(err, exists){
    if(exists){
      esClient.deleteIndex(index, cb);
    }else{
      cb()
    }
  });
}
