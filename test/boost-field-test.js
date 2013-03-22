var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , esClient  = new(require('elastical').Client)
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , mongoosastic = require('../lib/mongoosastic');


var TweetSchema = new Schema({
    user: String
  , post_date: {type:Date, es_type:'date'}
  , message: {type:String}
  , title: {type:String, es_boost:2.0}
});

TweetSchema.plugin(mongoosastic);
var BlogPost = mongoose.model('BlogPost', TweetSchema);

describe('Add Boost Option Per Field', function(){
  before(function(done){
    mongoose.connect(config.mongoUrl, function(){
      BlogPost.remove(function(){
        config.deleteIndexIfExists(['blogposts'], done)
      });
    });
  });

  it('should create a mapping with boost field added', function(done){
    BlogPost.createMapping(function(err, mapping){
      esClient.getMapping('blogposts', 'blogpost', function(err, mapping){
        var props = mapping.blogpost.properties;
        props.title.type.should.eql('string');
        props.title.boost.should.eql(2.0);
        done();
      });
    });
  });
});
