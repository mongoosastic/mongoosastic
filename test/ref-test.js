var mongoose = require('mongoose'),
  ObjectId = mongoose.Types.ObjectId,
  should = require('should'),
  async = require('async'),
  elasticsearch = require('elasticsearch'),
  esClient = new elasticsearch.Client(),
  config = require('./config'),
  Schema = mongoose.Schema,
  PostComment, Post,
  mongoosastic = require('../lib/mongoosastic');

var UserSchema = new Schema({
  name: {type: String}
});

var PostCommentSchema = new Schema({
  author: {type: Schema.Types.ObjectId, ref: 'User'},
  text: {type: String}
});

var PostSchema = new Schema({
  body: {type: String, es_indexed: true},
  author: {type: Schema.Types.ObjectId, ref: 'User', es_schema: UserSchema, es_indexed: true},
  comments: [{type: Schema.Types.ObjectId, ref: 'PostComment', es_schema: PostComment, es_indexed: true}]
});

PostSchema.plugin(mongoosastic, {
  populate: [
    {path: 'author'},
    {path: 'comments', select: 'text'}
  ]
});

User = mongoose.model('User', UserSchema);
Post = mongoose.model('Post', PostSchema);
PostComment = mongoose.model('PostComment', PostCommentSchema);

describe('references', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      async.forEach([Post, User, PostComment], function(model, cb) {
        model.remove(cb)
      }, function() {
        config.deleteIndexIfExists(['posts', 'users'], done);
      });
    });
  });

  after(function(done) {
    mongoose.disconnect();
    Post.esClient.close();
    esClient.close();
    config.deleteIndexIfExists(['posts', 'users'], done);
  });

  describe('indexing', function() {
    var user

    before(function(done) {
      user = new User({
        name: 'jake'
      });
      user.save(done);
    });

    it('should keep populated field of source doc unchanged', function(done) {
      config.createModelAndEnsureIndex(Post, {
        body: 'A very short post',
        author: user._id
      }, function(err, post) {
        if (err) return done(err)
        post.author.should.be.instanceof(ObjectId)
        done()
      });
    })

    it('should index selected fields from referenced schema', function(done) {
      Post.findOne({}, function(err, post) {
        esClient.get({
          index: 'posts',
          type: 'post',
          id: post._id.toString()
        }, function(_err, res) {
          res._source.author.name.should.eql('jake');
          done();
        });
      });
    });

    it('should be able to execute a simple query', function(done) {
      Post.search({
        query_string: {
          query: 'jake'
        }
      }, function(err, results) {
        results.hits.total.should.eql(1);
        results.hits.hits[0]._source.body.should.eql('A very short post');
        done();
      });
    });

    describe('arrays of references', function() {
      before(function(done) {
        async.parallel({
          user: function(cb) { User.findOne({}, cb) },
          post: function(cb) { Post.findOne({}, cb) },
        }, function(err, models) {
          if (err) return done(err);
          var comments = [
            new PostComment({author: models.user._id, text: 'good post'}),
            new PostComment({author: models.user._id, text: 'really'})
          ];
          async.forEach(comments, function(comment, cb) {
            comment.save(cb)
          }, function(err, result) {
            if (err) return done(err);
            models.post.comments.push(comments[0]._id);
            models.post.comments.push(comments[1]._id);
            config.saveAndWaitIndex(models.post, done);
          });
        });
      });

      it('should correctly index arrays', function(done) {
        Post.findOne({}, function(err, post) {
          esClient.get({
            index: 'posts',
            type: 'post',
            id: post._id.toString()
          }, function(_err, res) {
            res._source.comments[0].text.should.eql('good post');
            res._source.comments[1].text.should.eql('really');
            done();
          });
        });
      });

      it('should respect populate options', function(done) {
        Post.findOne({}, function(err, post) {
          esClient.get({
            index: 'posts',
            type: 'post',
            id: post._id.toString()
          }, function(_err, res) {
            res._source.comments[0].text.should.eql('good post');
            should.not.exist(res._source.comments[0].author);
            done();
          });
        });
      });
    });

  });
});
