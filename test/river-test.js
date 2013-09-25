var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , esClient  = new(require('elastical').Client)
  , mongoosastic = require('../lib/mongoosastic');

// -- simplest indexing... index all fields
var Mentionschema = new Schema({
    user: String
  , userId: Number
  , Mention_date: Date
  , message: String
});

// // Configurations for River
// var options = {
//   useRiver: {
//     gridfs: false
//   }
// }

// Configuration Default
var options = {
  useRiver: true
}

// Add Options to plugin
Mentionschema.plugin(mongoosastic, options);

var Mention = mongoose.model('Mention', Mentionschema);

/****
*   Testing the MongoDB river plugin for Elasticsearch can be difficult to set up.
*
*   Many people trying to contribute to Mongoosastic may not care about this feature and should
*   not be forced to go through this hassle just to contribute new features or fixes
*
*   Travis will run these tests. If you wish to run them as well set the environment variable:
*     MONGOOSASTIC_RIVER=true
*/

if(process.env.MONGOOSASTIC_RIVER) {
  describe('River Index Method', function(){

    var fixture = {
        user: 'gabriel'
      , message: "I know capoeira!"
      , Mention_date: new Date()
    };

    before(function(done){

      // Connect Mongoose
      mongoose.connect(config.mongoUrl, function() {
        // Create River
        Mention.river(function() {
          // Add Record Direct on Mongo
          mongoose.connection.collections.mentions.insert(fixture, function(err, doc) {
            if (err) console.log(err);
            done();
          });
        });
      });

    });

    // Clear all party ;-)
    after(function(done){

      setTimeout(function(){

        mongoose.connection.collections.mentions.remove(function() {
          esClient.deleteRiver('mention', 'mentions', function() {
            esClient.deleteIndex('mentions',  function() {
              mongoose.disconnect();
              done();
            });
          });
        });

      }, 4100);

    });

    it('should be able to search by river directly', function(done){
      Mention.findOne({message:'I know capoeira!'}, function(err, doc){

          setTimeout(function(){
            Mention.search({query:'know'}, function(err, res){
              res.hits.hits[0]._source.message.should.eql(doc.message);
              done();
            });
          }, 3100);

      });
    });
  });
}
