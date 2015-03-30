var express = require('express'),
  bodyParser = require('body-parser'),
  errorhandler = require('errorhandler'),
  mongoose = require('mongoose'),
  mongoosastic = require('../../lib/mongoosastic'),
  Schema = mongoose.Schema;

var app = module.exports = express();

// Configuration
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(bodyParser());
app.use(express.static(__dirname + '/public'));

app.use(errorhandler());

// Model
mongoose.connect('mongodb://localhost/silly-blog', function(err) {
  if (err) {
    console.error(err);
  }
  console.log('connected.... unless you see an error the line before this!');
});

var BlogPostSchema = new Schema({
  title: {type: String, es_boost: 2.0},
  content: {type: String}
});

BlogPostSchema.plugin(mongoosastic);

var BlogPost = mongoose.model('BlogPost', BlogPostSchema);

BlogPost.createMapping(function(err, mapping) {
  if (err) {
    console.log('error creating mapping (you can safely ignore this)');
    console.log(err);
  } else {
    console.log('mapping created!');
    console.log(mapping);
  }
});

// Routes

app.get('/', function(req, res) {
  res.render('index', {title: 'Mongoosastic Example'});
});

app.post('/search', function(req, res) {
  BlogPost.search({query_string: {query: req.body.q}}, function(err, results) {
    res.send(results);
  });
});

app.get('/post', function(req, res) {
  res.render('post', {title: 'New Post'});
});

app.post('/post', function(req, res) {
  var post = new BlogPost(req.body);
  post.save(function() {
    res.redirect('/');
    post.on('es-indexed', function() {
      console.log('document indexed');
    });
  });
});

app.listen(3000, function() {
  console.log('Express server listening on port %d in %s mode', 3000, app.settings.env);
});
