var mongoose = require('mongoose'),
  elasticsearch = require('elasticsearch'),
  esClient = new elasticsearch.Client({
    deadTimeout: 0,
    keepAlive: false
  }),
  async = require('async'),
  config = require('./config'),
  Schema = mongoose.Schema,
  mongoosastic = require('../lib/mongoosastic');


var SongSchema;
var Song;

describe('_all Field Option', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      config.deleteIndexIfExists(['songs'], function() {
        SongSchema = new Schema({
          title: {type: String, es_index: 'not_analyzed'},
          artist: {type: String, es_index: 'not_analyzed'},
          genre: {type: String, es_index: 'not_analyzed', es_index: "no", es_include_in_all: false}
        });
        SongSchema.plugin(mongoosastic);
        Song = mongoose.model('Song', SongSchema);
        Song.createMapping({
          "_all":{
            "enabled": true
          }
        }, function() {
          Song.remove(function() {
            var songs = [
              new Song({
                title: 'Smells like Teen Spirit',
                artist: 'Nirvana',
                genre: 'Grunge'
              }),
              new Song({
                title: 'Californication',
                artist: 'Red Hot Chilli Peppers',
                genre: 'Alternative Rock'
              }),
              new Song({
                title: 'Dani California',
                artist: 'Red Hot Chilli Peppers',
                genre: 'Alternative Rock'
              }),
              new Song({
                title: 'Hotel California',
                artist: 'The Eagles',
                genre: 'Rock'
              })
            ];
            async.forEach(songs, config.saveAndWaitIndex, function() {
              setTimeout(done, config.INDEXING_TIMEOUT);
            });
          });
        });
      });
    });
  });

  after(function(done) {
    Song.esClient.close();
    mongoose.disconnect();
    esClient.close();
    done();
  });

  it('should map _all field', function(done) {
    Song.createMapping(function(){
      esClient.indices.getMapping({
        index: 'songs',
        type: 'song'
      }, function(err, mapping){
      	var field = mapping.song !== undefined ? /* elasticsearch 1.0 & 0.9 support */
      	  mapping.song : /* ES 0.9.11 */
      	  mapping.songs.mappings.song; /* ES 1.0.0 */
      	field._all.enabled.should.eql(true);
      	done();
      });
    });
  });

});

