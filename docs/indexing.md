## Saving a document
The indexing takes place after saving in mongodb and is a deferred process.
One can check the end of the indexation by catching the es-indexed event.

```javascript
doc.save(function(err){
  if (err) throw err;
  /* Document indexation on going */
  doc.on('es-indexed', function(err, res){
    if (err) throw err;
    /* Document is indexed */
  });
});
```

## Removing a document
Removing a document, or unindexing, takes place when a document is removed by calling `.remove()` on a mongoose Document instance.
One can check the end of the unindexing by catching the es-removed event.

```javascript
doc.remove(function(err) {
  if (err) throw err;
  /* Document unindexing in the background */
  doc.on('es-removed', function(err, res) {
    if (err) throw err;
    /* Docuemnt is unindexed */
  });
});
```

Note that use of `Model.remove` does not involve mongoose documents as outlined in the [documentation](http://mongoosejs.com/docs/api.html#model_Model.remove). Therefore, the following will not unindex the document.

```javascript
MyModel.remove({ _id: doc.id }, function(err) {
  /* doc remains in Elasticsearch cluster */
});
```

## Indexing Nested Models
In order to index nested models you can refer following example.

```javascript
var Comment = new Schema({
    title: String,
    body: String,
    author: String
})


var User = new Schema({
    name: { type: String, es_indexed: true },
    email: String,
    city: String,
    comments: { type: [Comment], es_indexed: true }
})

User.plugin(mongoosastic)
```

## Elasticsearch [Nested datatype](https://www.elastic.co/guide/en/elasticsearch/reference/current/nested.html)
Since the default in Elasticsearch is to take arrays and flatten them into objects,
it can make it hard to write queries where you need to maintain the relationships
between objects in the array.
The way to change this behavior is by changing the Elasticsearch type from `object`
(the mongoosastic default) to `nested`

```javascript
var Comment = new Schema({
    title: String,
    body: String,
    author: String
})


var User = new Schema({
    name: { type: String, es_indexed: true },
    email: String,
    city: String,
    comments: {
      type:[Comment],
      es_indexed: true,
      es_type: 'nested',
      es_include_in_parent: true
    }
})

User.plugin(mongoosastic)
```

## Indexing Mongoose References
In order to index mongoose references you can refer following example.

```javascript
var Comment = new Schema({
    title: String,
    body: String,
    author: String
});


var User = new Schema({
    name: { type: String, es_indexed: true },
    email: String,
    city: String,
    comments: { 
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      es_schema: Comment,
      es_indexed:true,
      es_select: 'title body'
    }
})

User.plugin(mongoosastic, {
  populate: [
    { path: 'comments', select: 'title body' }
  ]
})
```
In the schema you'll need to provide `es_schema` field - the referenced schema.
By default every field of the referenced schema will be mapped. Use `es_select` field to pick just specific fields.

`populate` is an array of options objects you normally pass to
[Model.populate](http://mongoosejs.com/docs/api.html#model_Model.populate).

## Indexing An Existing Collection
Already have a mongodb collection that you'd like to index using this
plugin? No problem! Simply call the synchronize method on your model to
open a mongoose stream and start indexing documents individually.

```javascript
var BookSchema = new Schema({
    title: String
});
BookSchema.plugin(mongoosastic);

const Book = mongoose.model('Book', BookSchema)

const stream = Book.synchronize();
const count = 0;

stream.on('data', function(err, doc) {
  count++;
});

stream.on('close', function() {
  console.log('indexed ' + count + ' documents!');
});

stream.on('error', function(err) {
  console.log(err);
});
```

You can also synchronize a subset of documents based on a query!

```javascript
var stream = Book.synchronize({ author: 'Arthur C. Clarke' })
```

As well as specifying synchronization options

```javascript
var stream = Book.synchronize({}, { saveOnSynchronize: true })
```

Options are:

 * `saveOnSynchronize` - triggers Mongoose save (and pre-save) method when synchronizing a collection/index. Defaults to global `saveOnSynchronize` option.


## Bulk Indexing

You can also specify `bulk` options with mongoose which will utilize Elasticsearch's bulk indexing api. This will cause the `synchronize` function to use bulk indexing as well.

Mongoosastic will wait 1 second (or specified delay) until it has 1000 docs (or specified size) and then perform bulk indexing.

```javascript
BookSchema.plugin(mongoosastic, {
  bulk: {
    size: 10, // preferred number of docs to bulk index
    delay: 100 //milliseconds to wait for enough docs to meet size constraint
  }
});
```

## Filtered Indexing

You can specify a filter function to index a model to Elasticsearch based on some specific conditions.

Filtering function must return True for conditions that will ignore indexing to Elasticsearch.

```javascript
var MovieSchema = new Schema({
  title: { type: String },
  genre: { type: String, enum: ['horror', 'action', 'adventure', 'other'] }
});

MovieSchema.plugin(mongoosastic, {
  filter: function(doc) {
    return doc.genre === 'action';
  }
});
```

Instances of Movie model having 'action' as their genre will not be indexed to Elasticsearch.


## Indexing On Demand
You can do on-demand indexes using the `index` function

```javascript
const dude = await Dude.findOne({ name:'Jeffrey Lebowski' });

dude.awesome = true;
await dude.index();
```

The index method takes as arguments:

* `options` (optional) - { index: string } - the index to publish to. Defaults to the standard index that
  the model was setup with.

Note that indexing a model does not mean it will be persisted to
mongodb. Use `save()` for that.

## Unindexing on demand
You can remove a document from the Elasticsearch cluster by using the `unIndex` function.

```javascript
await doc.unIndex();
```

## Truncating an index

The static method `esTruncate` will delete all documents from the associated index. This method combined with `synchronize()` can be useful in case of integration tests for example when each test case needs a cleaned up index in Elasticsearch.

```javascript
await GarbageModel.esTruncate();
```

## Restrictions

### Auto indexing

Mongoosastic try to auto index documents in favor of mongoose's [middleware](http://mongoosejs.com/docs/middleware.html) feature.

Mongoosastic will auto index when:

* `document.save`
* `Model.findOneAndUpdate`
* `Model.insertMany`
* `document.remove`
* `Model.findOneAndRemove` 

but not include `Model.remove` & `Model.update`.

And you should have `new: true` options when `findOneAndUpdate` so that mongoosastic can get new values in post hook.

### Search immediately after es-indexed event

> Elasticsearch by default refreshes each shard every 1s, so the document will be available to search 1s after indexing it.

The event `es-indexed` means that elasticsearch received the index request, and if you want to search the document, please try after 1s. See [Document not found immediately after it is saved](https://github.com/elastic/elasticsearch-js/issues/231).