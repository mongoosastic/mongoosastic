var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , esClient  = new(require('elastical').Client)
  , mongoosastic = require('../lib/mongoosastic')
  , Tweet = require('./models/tweet');

describe('Index Method', function(){
  before(function(done){
    mongoose.connect(config.mongoUrl, function(){
      config.deleteIndexIfExists(['tweets', 'public_tweets'], function(){
        config.createModelAndEnsureIndex(Tweet, {
            user: 'jamescarr'
          , message: "I know kung-fu!"
          , post_date: new Date()
        }, done);
      });
    });
  });

  after(function(done){
    Tweet.remove(function(){
      mongoose.disconnect();
      done();
    });
  });
  it('should be able to index it directly without saving', function(done){
    Tweet.findOne({message:'I know kung-fu!'}, function(err, doc){
      doc.message = 'I know nodejitsu!';
      doc.index(function(){
        setTimeout(function(){
          Tweet.search({query:'know'}, function(err, res){
            res.hits.hits[0]._source.message.should.eql('I know nodejitsu!');
            done();
          });
        }, 1100);
      });
    });
  });
  it('should be able to index to alternative index', function(done){
    Tweet.findOne({message:'I know kung-fu!'}, function(err, doc){
      doc.message = 'I know taebo!';
      doc.index('public_tweets', function(){
        setTimeout(function(){
          esClient.search({index: 'public_tweets', query:'know'}, function(err, results, res){
            res.hits.hits[0]._source.message.should.eql('I know taebo!');
            done();
          });
        }, 1100);
      });
    });
  });
  it('should be able to index to alternative index and type', function(done){
    Tweet.findOne({message:'I know kung-fu!'}, function(err, doc){
      doc.message = 'I know taebo!';
      doc.index('public_tweets', 'utterings', function(){
        setTimeout(function(){
          esClient.search({index: 'public_tweets', type: 'utterings', query:'know'}, function(err, results, res){
            res.hits.hits[0]._source.message.should.eql('I know taebo!');
            done();
          });
        }, 1100);
      });
    });
  });
});
