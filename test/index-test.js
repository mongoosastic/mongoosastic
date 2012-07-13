var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , esClient  = new(require('elastical').Client)
  , mongoosastic = require('../lib/mongoosastic')
  , Tweet = require('./models/tweet');

// -- Only index specific field
var TalkSchema = new Schema({
    speaker: String
  , title: {type:String, es_indexed:true}
  , abstract: {type:String, es_indexed:true}
  , bio: String
});
TalkSchema.plugin(mongoosastic)

var Talk = mongoose.model("Talk", TalkSchema);

var PersonSchema = new Schema({
    name: {type:String, es_indexed:true}
  , phone: {type:String, es_indexed:true}
  , address: String
});
PersonSchema.plugin(mongoosastic, {
  index:'people'
, type: 'dude'
, hydrate: true
});

var Person = mongoose.model("Person", PersonSchema);

// -- alright let's test this shiznit!
describe('indexing', function(){
  before(function(done){
    mongoose.connect(config.mongoUrl, function(){
      Tweet.remove(function(){
        config.deleteIndexIfExists(['tweets', 'talks', 'people', 'public_tweets'], done)
      });
    });
  });

  after(function(done){
    Tweet.remove(function(){
      mongoose.disconnect();
      done();
    });
  });

  describe('Creating Index', function(){
    it('should create index if none exists', function(done){
      Tweet.createMapping(function(err, response){
        response.should.not.have.property('error');
        done();
      });
    });
    it('should update index if one already exists', function(done){
      Tweet.createMapping(function(err, response){
        response.should.not.have.property('error');
        done();
      });
    });

    after(function(done){
      config.deleteIndexIfExists(['tweets', 'talks', 'people'], done)
    });
  });

  describe('Default plugin', function(){
    before(function(done){
      config.createModelAndEnsureIndex(Tweet, {
          user: 'jamescarr'
        , message: "I like Riak better"
        , post_date: new Date()
      }, done);
    });
    it("should use the model's id as ES id", function(done){
      Tweet.findOne({message:"I like Riak better"}, function(err, doc){
        esClient.get('tweets', doc._id.toString(), function(err, res){
          res.message.should.eql(doc.message);
          done()
        });
      });
    });

    it('should be able to execute a simple query', function(done){
      Tweet.search({query:'Riak'}, function(err, results) {
        results.hits.total.should.eql(1)
        results.hits.hits[0]._source.message.should.eql('I like Riak better')
        done();
      });
    });
    it('should be able to execute a simple query', function(done){
      Tweet.search({query:'jamescarr'}, function(err, results) {
        results.hits.total.should.eql(1)
        results.hits.hits[0]._source.message.should.eql('I like Riak better')
        done()
      });
    });
    it('should report errors', function(done){
      Tweet.search({queriez:'jamescarr'}, function(err, results) {
        err.message.should.match(/SearchPhaseExecutionException/);
        should.not.exist(results)
        done()
      });
    });
  });
  describe('Removing', function(){
    var tweet = new Tweet({
      user:'jamescarr'
    , message: 'Saying something I shouldnt'
    });
    before(function(done){
      config.createModelAndEnsureIndex(Tweet, tweet, done);
    });
    it('should remove from index when model is removed', function(done){
      tweet.remove(function(){
          setTimeout(function(){
            Tweet.search({query:'shouldnt'}, function(err, res){
              res.hits.total.should.eql(0);
              done();
            });
          }, 1100);
      });
    });
    it('should queue for later removal if not in index', function(done){
      // behavior here is to try 3 times and then give up.
      var tweet = new Tweet({
        user:'jamescarr'
      , message: 'ABBA'
      });

      tweet.save(function(){
        tweet.remove();
      });
      tweet.on('es-removed', done);
    });

  });
  describe('Isolated Models', function(){
    before(function(done){
      var talk = new Talk({
          speaker: ''
        , title: "Dude"
        , abstract: ""
        , bio: ''
      });
      var tweet = new Tweet({
          user: 'Dude'
        , message: "Go see the big lebowski"
        , post_date: new Date()
      });
      tweet.save(function(){
        talk.save(function(){
          talk.on('es-indexed', function(err, res){
            setTimeout(done, 1000);
          });
        });
      });
    });   

    it('should only find models of type Tweet', function(done){
      Tweet.search({query:'Dude'}, function(err, res){
        res.hits.total.should.eql(1);
        res.hits.hits[0]._source.user.should.eql('Dude');
        done();
      });
    });
    it('should only find models of type Talk', function(done){
      Talk.search({query:'Dude'}, function(err, res){
        res.hits.total.should.eql(1);
        res.hits.hits[0]._source.title.should.eql('Dude');
        done();
      });
    });
  });

  describe('Always hydrate', function(){
    before(function(done){
      config.createModelAndEnsureIndex(Person, {
          name: 'James Carr'
        , address: "Exampleville, MO"
        , phone: '(555)555-5555'
      }, done);
    });

    it('when gathering search results', function(done){
      Person.search({query:'James'}, function(err, res) {
        res.hits[0].address.should.eql('Exampleville, MO');
        done();
      });
    });
  });
  describe('Subset of Fields', function(){
    before(function(done){
      config.createModelAndEnsureIndex(Talk,{
          speaker: 'James Carr'
        , title: "Node.js Rocks"
        , abstract: "I told you node.js was cool. Listen to me!"
        , bio: 'One awesome dude.'
      }, done);
    });

    it('should only return indexed fields', function(done){
      Talk.search({query:'cool'}, function(err, res) {
        res.hits.total.should.eql(1);

        var talk = res.hits.hits[0]._source;
        talk.should.have.property('title');
        talk.should.have.property('abstract');
        talk.should.not.have.property('speaker');
        talk.should.not.have.property('bio');
        done();
      });
    });

    it('should hydrate returned documents if desired', function(done){
      Talk.search({query:'cool'}, {hydrate:true}, function(err, res) {
        res.total.should.eql(1)

        var talk = res.hits[0]
        talk.should.have.property('title')
        talk.should.have.property('abstract')
        talk.should.have.property('speaker')
        talk.should.have.property('bio')
        done();
      });
    });
  });

  describe('Existing Index', function(){
    before(function(done){
      config.deleteIndexIfExists(['ms_sample'], function(){
        esClient.createIndex('ms_sample', {mappings:{
          bum:{
            properties: {
              name: {type:'string'}
            }
          }
        }}, done);
      });
    });

    it('should just work', function(done){
      var BumSchema = new Schema({
        name: String
      });
      BumSchema.plugin(mongoosastic, {
          index: 'ms_sample'
        , type: 'bum'
      });
      var Bum = mongoose.model('bum', BumSchema);
      config.createModelAndEnsureIndex(Bum, {name:'Roger Wilson'}, function(){
        Bum.search({query:'Wilson'}, function(err, results){
          results.hits.total.should.eql(1);
          done();
        });
      });
    });
  });

});


