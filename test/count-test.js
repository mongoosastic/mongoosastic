var mongoose = require('mongoose'),
  async = require('async'),
  config = require('./config'),
  Schema = mongoose.Schema,
  Comment,
  mongoosastic = require('../lib/mongoosastic');

var CommentSchema = new Schema({
  user: String,
  post_date: {
    type: Date,
    es_type: 'date'
  },
  message: {
    type: String
  },
  title: {
    type: String,
    es_boost: 2.0
  }
});


CommentSchema.plugin(mongoosastic, {
  bulk: {
    size: 2,
    delay: 100
  }
});

Comment = mongoose.model('Comment', CommentSchema);

describe('Count', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      Comment.remove(function() {
        config.deleteIndexIfExists(['comments'], function() {
          var comments = [
            new Comment({
              user: 'terry',
              title: 'Ilikecars'
            }),
            new Comment({
              user: 'fred',
              title: 'Ihatefish'
            })
          ];
          async.forEach(comments, function(item, cb) {
            item.save(cb);
          }, function() {
            setTimeout(done, config.INDEXING_TIMEOUT);
          });
        });
      });
    });
  });

  after(function() {
    mongoose.disconnect();
    Comment.esClient.close();
  });

  it('should count a type', function(done) {
    Comment.esCount({
      term: {
        user: 'terry'
      }
    }, function(err, results) {
      results.count.should.eql(1);
      done(err);
    });
  });
});
