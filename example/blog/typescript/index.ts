import express from 'express'
import errorhandler from 'errorhandler'
import mongoose, { Document, Schema } from 'mongoose'
import mongoosastic, { MongoosasticModel, MongoosasticDocument } from '../../..'

const app = module.exports = express()

// Configuration
app.set('views', __dirname + '/../views')
app.set('view engine', 'jade')

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(__dirname + '/../public'))

app.use(errorhandler())

// Model
mongoose.connect('mongodb://localhost/silly-blog', function(err) {
  if (err) {
    console.error(err)
  }
  console.log('connected.... unless you see an error the line before this!')
})

interface IBlog extends Document, MongoosasticDocument {
  title: string,
  content: string
}

const BlogPostSchema = new Schema({
  title: {type: String, es_boost: 2.0},
  content: {type: String}
})

BlogPostSchema.plugin(mongoosastic)

const BlogPost = mongoose.model<IBlog, MongoosasticModel<IBlog>>('BlogPost', BlogPostSchema)


BlogPost.createMapping().then(mapping => {
  console.log('mapping created!')
  console.log(mapping)
}).catch(err => {
  console.log('error creating mapping (you can safely ignore this)')
  console.log(err)
})


// Routes
app.get('/', function(req, res) {
  res.render('index', { title: 'Mongoosastic Example' })
})

app.post('/search', async function(req, res) {
  const results = await BlogPost.search({
    query_string: {
      query: req.body.q,
    }
  })
  res.send(results)
})

app.get('/post', function(req, res) {
  res.render('post', { title: 'New Post' })
})

app.post('/post', function(req, res) {
  const post = new BlogPost(req.body)
  post.save(function() {
    res.redirect('/')
    post.on('es-indexed', function() {
      console.log('document indexed')
    })
  })
})

app.listen(3000, function() {
  console.log('Express server listening on port %d in %s mode', 3000, app.settings.env)
})
