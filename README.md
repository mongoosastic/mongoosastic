# Mongoosastic
[![Build Status](https://secure.travis-ci.org/mongoosastic/mongoosastic.png?branch=master)](http://travis-ci.org/mongoosastic/mongoosastic)
[![NPM version](https://img.shields.io/npm/v/mongoosastic.svg)](https://www.npmjs.com/package/mongoosastic)
[![Coverage Status](https://coveralls.io/repos/mongoosastic/mongoosastic/badge.svg?branch=master&service=github)](https://coveralls.io/github/mongoosastic/mongoosastic?branch=master)
[![Downloads](https://img.shields.io/npm/dm/mongoosastic.svg)](https://www.npmjs.com/package/mongoosastic)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mongoosastic/mongoosastic?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

[![NPM](https://nodei.co/npm/mongoosastic.png)](https://nodei.co/npm/mongoosastic/)

Mongoosastic is a [mongoose](http://mongoosejs.com/) plugin that can automatically index your models into [elasticsearch](http://www.elasticsearch.org/).

- [Installation](#installation)
- [Setup](#setup)
- [Indexing](#indexing)
  - [Saving a document](#saving-a-document)
  - [Indexing nested models](#indexing-nested-models)
  - [Indexing mongoose references](#indexing-mongoose-references)
  - [Indexing an existing collection](#indexing-an-existing-collection)
  - [Bulk indexing](#bulk-indexing)
  - [Filtered indexing](#filtered-indexing)
  - [Indexing on demand](#indexing-on-demand)
  - [Truncating an index](#truncating-an-index)
- [Mapping](#mapping)
  - [Geo mapping](#geo-mapping)
    - [Indexing a geo point](#indexing-a-geo-point)
    - [Indexing a geo shape](#indexing-a-geo-shape)
  - [Creating mappings on-demand](#creating-mappings-on-demand)
- [Queries](#queries)
  - [Hydration](#hydration)

## Installation

The latest version of this package will be as close as possible to the latest `elasticsearch` and `mongoose` packages. 

```bash
npm install -S mongoosastic
```

## Setup

### Model.plugin(mongoosastic, options)

Options are:

* `index` - the index in Elasticsearch to use. Defaults to the pluralization of the model name.
* `type`  - the type this model represents in Elasticsearch. Defaults to the model name.
* `esClient` - an existing Elasticsearch `Client` instance.
* `hosts` - an array hosts Elasticsearch is running on.
* `host` - the host Elasticsearch is running on
* `port` - the port Elasticsearch is running on
* `auth` - the authentication needed to reach Elasticsearch server. In the standard format of 'username:password'
* `protocol` - the protocol the Elasticsearch server uses. Defaults to http
* `hydrate` - whether or not to lookup results in mongodb before
* `hydrateOptions` - options to pass into hydrate function
* `bulk` - size and delay options for bulk indexing
* `filter` - the function used for filtered indexing
* `transform` - the function used to transform serialized document before indexing
* `populate` - an Array of Mongoose populate options objects
* `indexAutomatically` - allows indexing after model save to be disabled for when you need finer control over when documents are indexed. Defaults to true


To have a model indexed into Elasticsearch simply add the plugin.

```javascript
var mongoose     = require('mongoose')
  , mongoosastic = require('mongoosastic')
  , Schema       = mongoose.Schema

var User = new Schema({
    name: String
  , email: String
  , city: String
})

User.plugin(mongoosastic)
```

This will by default simply use the pluralization of the model name as the index 
while using the model name itself as the type. So if you create a new
User object and save it, you can see it by navigating to
http://localhost:9200/users/user/_search (this assumes Elasticsearch is
running locally on port 9200). 

The default behavior is all fields get indexed into Elasticsearch. This can be a little wasteful especially considering that
the document is now just being duplicated between mongodb and
Elasticsearch so you should consider opting to index only certain fields by specifying `es_indexed` on the 
fields you want to store:


```javascript
var User = new Schema({
    name: {type:String, es_indexed:true}
  , email: String
  , city: String
})

User.plugin(mongoosastic)
```

In this case only the name field will be indexed for searching.

Now, by adding the plugin, the model will have a new method called
`search` which can be used to make simple to complex searches. The `search`
method accepts [standard Elasticsearch query DSL](http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-queries.html)

```javascript
User.search({
  query_string: {
    query: "john"
  }
}, function(err, results) {
  // results here
});

```

To connect to more than one host, you can use an array of hosts. 

```javascript
MyModel.plugin(mongoosastic, {
  hosts: [
    'localhost:9200',
    'anotherhost:9200'
  ]
})
```

Also, you can re-use an existing Elasticsearch `Client` instance

```javascript
var esClient = new elasticsearch.Client({host: 'localhost:9200'});
MyModel.plugin(mongoosastic, {
  esClient: esClient
})
```


## Indexing

### Saving a document
The indexing takes place after saving inside the mongodb and is a defered process. 
One can check the end of the indexion catching es-indexed event. 

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


###Indexing Nested Models
In order to index nested models you can refer following example.

```javascript
var Comment = new Schema({
    title: String
  , body: String
  , author: String
})


var User = new Schema({
    name: {type:String, es_indexed:true}
  , email: String
  , city: String
  , comments: {type:[Comment], es_indexed:true}
})

User.plugin(mongoosastic)
```

###Elasticsearch [Nested datatype](https://www.elastic.co/guide/en/elasticsearch/reference/2.0/nested.html)
Since the default in Elasticsearch is to take arrays and flatten them into objects,
it can make it hard to write queries where you need to maintain the relationships 
between objects in the array, per .
The way to change this behavior is by changing the Elasticsearch type from `object` 
(the mongoosastic default) to `nested`

```javascript
var Comment = new Schema({
    title: String
  , body: String
  , author: String
})


var User = new Schema({
    name: {type: String, es_indexed: true}
  , email: String
  , city: String
  , comments: {
      type:[Comment], 
      es_indexed: true, 
      es_type: 'nested', 
      es_include_in_parent: true
  }
})

User.plugin(mongoosastic)
```

###Indexing Mongoose References
In order to index mongoose references you can refer following example.

```javascript
var Comment = new Schema({
    title: String
  , body: String
  , author: String
});


var User = new Schema({
    name: {type:String, es_indexed:true}
  , email: String
  , city: String
  , comments: {type: Schema.Types.ObjectId, ref: 'Comment',
    es_schema: Comment, es_indexed:true, es_select: 'title body'}
})

User.plugin(mongoosastic, {
  populate: [
    {path: 'comments', select: 'title body'}
  ]
})
```
In the schema you'll need to provide `es_schema` field - the referenced schema.
By default every field of the referenced schema will be mapped. Use `es_select` field to pick just specific fields.

`populate` is an array of options objects you normally pass to
[Model.populate](http://mongoosejs.com/docs/api.html#model_Model.populate).

### Indexing An Existing Collection
Already have a mongodb collection that you'd like to index using this
plugin? No problem! Simply call the synchronize method on your model to
open a mongoose stream and start indexing documents individually.

```javascript
var BookSchema = new Schema({
  title: String
});
BookSchema.plugin(mongoosastic);

var Book = mongoose.model('Book', BookSchema)
  , stream = Book.synchronize()
  , count = 0;

stream.on('data', function(err, doc){
  count++;
});
stream.on('close', function(){
  console.log('indexed ' + count + ' documents!');
});
stream.on('error', function(err){
  console.log(err);
});
```

You can also synchronize a subset of documents based on a query!

```javascript
var stream = Book.synchronize({author: 'Arthur C. Clarke'})
```

### Bulk Indexing

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

### Filtered Indexing

You can specify a filter function to index a model to Elasticsearch based on some specific conditions.

Filtering function must return True for conditions that will ignore indexing to Elasticsearch.

```javascript
var MovieSchema = new Schema({
  title: {type: String},
  genre: {type: String, enum: ['horror', 'action', 'adventure', 'other']}
});

MovieSchema.plugin(mongoosastic, {
  filter: function(doc) {
    return doc.genre === 'action';
  }
});
```

Instances of Movie model having 'action' as their genre will not be indexed to Elasticsearch.


### Indexing On Demand
You can do on-demand indexes using the `index` function

```javascript
Dude.findOne({name:'Jeffery Lebowski', function(err, dude){
  dude.awesome = true;
  dude.index(function(err, res){
    console.log("egads! I've been indexed!");
  });
});
```

The index method takes 2 arguments:

* `options` (optional) - {index, type} - the index and type to publish to. Defaults to the standard index and type.
  the model was setup with.
* `callback` - callback function to be invoked when model has been
  indexed.

Note that indexing a model does not mean it will be persisted to
mongodb. Use save for that.

### Truncating an index

The static method `esTruncate` will delete all documents from the associated index. This method combined with synchronise can be usefull in case of integration tests for example when each test case needs a cleaned up index in Elasticsearch.

```javascript
GarbageModel.esTruncate(function(err){...});
```

## Mapping

Schemas can be configured to have special options per field. These match
with the existing [field mapping configurations](http://www.elasticsearch.org/guide/reference/mapping/core-types.html) defined by Elasticsearch with the only difference being they are all prefixed by "es_". 

So for example. If you wanted to index a book model and have the boost
for title set to 2.0 (giving it greater priority when searching) you'd
define it as follows:

```javascript
var BookSchema = new Schema({
    title: {type:String, es_boost:2.0}
  , author: {type:String, es_null_value:"Unknown Author"}
  , publicationDate: {type:Date, es_type:'date'} 
}); 

```
This example uses a few other mapping fields... such as null_value and
type (which overrides whatever value the schema type is, useful if you
want stronger typing such as float).

There are various mapping options that can be defined in Elasticsearch. Check out [http://www.elasticsearch.org/guide/reference/mapping/](http://www.elasticsearch.org/guide/reference/mapping/) for more information. Here are examples to the currently possible definitions in mongoosastic:

```javascript
var ExampleSchema = new Schema({
  // String (core type)
  string: {type:String, es_boost:2.0},

  // Number (core type)
  number: {type:Number, es_type:'integer'},

  // Date (core type)
  date: {type:Date, es_type:'date'},

  // Array type
  array: {type:Array, es_type:'string'},

  // Object type 
  object: {
    field1: {type: String},
    field2: {type: String}
  },

  // Nested type 
  nested: [SubSchema],

  // Multi field type
  multi_field: {
    type: String,
    es_type: 'multi_field',
    es_fields: {
      multi_field: { type: 'string', index: 'analyzed' },
      untouched: { type: 'string', index: 'not_analyzed' }
    }
  },

  // Geo point type
  geo: {
    type: String,
    es_type: 'geo_point'
  },

  // Geo point type with lat_lon fields
  geo_with_lat_lon: {
    geo_point: {
      type: String,
      es_type: 'geo_point',
      es_lat_lon: true
    },
    lat: { type: Number },
    lon: { type: Number }
  }

  geo_shape: {
    coordinates : [],
    type: {type: String},
    geo_shape: {
      type:String,
      es_type: "geo_shape",
      es_tree: "quadtree",
      es_precision: "1km"
    }
  }

  // Special feature : specify a cast method to pre-process the field before indexing it
  someFieldToCast : {
    type: String,
    es_cast: function(value){
      return value + ' something added';
    }
  }

});

// Used as nested schema above.
var SubSchema = new Schema({
  field1: {type: String},
  field2: {type: String}
});
```

### Geo mapping
Prior to index any geo mapped data (or calling the synchronize), 
the mapping must be manualy created with the createMapping (see above).

Notice that the name of the field containing the ES geo data must start by
'geo_' to be recognize as such.

#### Indexing a geo point

```javascript
var geo = new GeoModel({
  /* … */
  geo_with_lat_lon: { lat: 1, lon: 2}
  /* … */
});
```

#### Indexing a geo shape

```javascript
var geo = new GeoModel({
  …
  geo_shape:{
    type:'envelope',
    coordinates: [[3,4],[1,2] /* Arrays of coord : [[lon,lat],[lon,lat]] */
  }
  …
});
```

Mapping, indexing and searching example for geo shape can be found in test/geo-test.js

For example, one can retrieve the list of document where the shape contain a specific 
point (or polygon...)

```javascript
var geoQuery = {
      "match_all": {}
    }

var geoFilter = {
      geo_shape: {
        geo_shape: {
          shape: {
            type: "point", 
            coordinates: [3,1]
          }
        }
      }
    }

GeoModel.search(geoQuery, {filter: geoFilter}, function(err, res) { /* ... */ })
```

### Creating Mappings On Demand
Creating the mapping is a one time operation and can be done as
follows (using the BookSchema as an example):

```javascript 
var BookSchema = new Schema({
    title: {type:String, es_boost:2.0}
  , author: {type:String, es_null_value:"Unknown Author"}
  , publicationDate: {type:Date, es_type:'date'} 

BookSchema.plugin(mongoosastic);
var Book = mongoose.model('Book', BookSchema);
Book.createMapping({
  "analysis" : {
    "analyzer":{
      "content":{
        "type":"custom",
        "tokenizer":"whitespace"
      }
    }
  }
},function(err, mapping){
  // do neat things here
});

```
This feature is still a work in progress. As of this writing you'll have
to manage whether or not you need to create the mapping, mongoosastic
will make no assumptions and simply attempt to create the mapping. If
the mapping already exists, an Exception detailing such will be
populated in the `err` argument. 


## Queries
The full query DSL of Elasticsearch is exposed through the search
method. For example, if you wanted to find all people between ages 21
and 30:

```javascript
Person.search({
  range: {
    age:{
      from:21
    , to: 30
    }
  }
}, function(err, people){
   // all the people who fit the age group are here!   
});

```
See the Elasticsearch [Query DSL](http://www.elasticsearch.org/guide/reference/query-dsl/) docs for more information.

You can also specify query options like [sorts](http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html#search-request-sort)

```javascript
Person.search({/* ... */}, {sort: "age:asc"}, function(err, people){
  //sorted results
});
```

And also [aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html):

```javascript
Person.search({/* ... */}, {
  aggs: {
    'names': {
      'terms': {
        'field': 'name'
      }
    }
  }
}, function(err, results){
  // results.aggregations holds the aggregations
});
```

Options for queries must adhere to the [javascript elasticsearch driver specs](http://www.elasticsearch.org/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-search).


### Hydration
By default objects returned from performing a search will be the objects
as is in Elasticsearch. This is useful in cases where only what was
indexed needs to be displayed (think a list of results) while the actual
mongoose object contains the full data when viewing one of the results.

However, if you want the results to be actual mongoose objects you can
provide {hydrate:true} as the second argument to a search call.

```javascript

User.search({query_string: {query: "john"}}, {hydrate:true}, function(err, results) {
  // results here
});

```

You can also pass in a `hydrateOptions` object with information on
how to query for the mongoose object.

```javascript

User.search({query_string: {query: "john"}}, {hydrate:true, hydrateOptions: {select: 'name age'}}, function(err, results) {
  // results here
});

```

Note using hydrate will be a degree slower as it will perform an Elasticsearch
query and then do a query against mongodb for all the ids returned from
the search result. 

You can also default this to always be the case by providing it as a
plugin option (as well as setting default hydrate options):


```javascript
var User = new Schema({
    name: {type:String, es_indexed:true}
  , email: String
  , city: String
})

User.plugin(mongoosastic, {hydrate:true, hydrateOptions: {lean: true}})
```
