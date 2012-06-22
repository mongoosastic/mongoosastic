# Mongoosastic
A [mongoose](http://mongoosejs.com/) plugin that indexes models into elastic search. I kept
running into cases where I needed full text search capabilities in my
mongodb based models only to discover mongodb has none. In addition to
full text search, I also needed the ability to filter ranges of data
points in the searches and even highlight matches. For these reasons,
elastic search was a perfect fit and hence this project. 


## Installation

```bash
npm install mongoosastic

```

Or add it to your package.json

## Usage

To make a model indexed into elastic search simply add the plugin.


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

This will by default simply use the document id as the index and index
all of the fields into elastic search. This can be a little wasteful so
you should consider opting to index only certain fields:


```javascript
var User = new Schema({
    name: {type:String, es_indexed:true}
  , email: String
  , city: String
})

User.plugin(mongoosastic, {index:'users', type:'user'})
```
This will still use the document id as the index but only the name field
will be indexed for searching. 

Finally, adding the plugin will add a new method to the model called
search which can be used to make simple to complex searches. 

```javascript

User.search({query:"john"}, function(err, results) {
  // results here
});

```
### Per Field Options
Schemas can be configured to have special options per field. These match
with the existing [field mapping configurations](http://www.elasticsearch.org/guide/reference/mapping/core-types.html) defined by elasticsearch with the only difference being they are all prefixed by "es_". 

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

### Advanced Queries
The full query DSL of elasticsearch is exposed through the search
method. For example, if you wanted to find all people between ages 21
and 30:

```javascript
Person.search({
  query:{
    range: {
      age:{
        from:21
      , to: 30
      }
    }
  }
}, function(err, people){
   // all the people who fit the age group are here!   
});

```

See the elasticsearch [Query DSL](http://www.elasticsearch.org/guide/reference/query-dsl/) docs for more information.

### Hydration
By default objects returned from performing a search will be the objects
as is in elastic search. This is useful in cases where only what was
indexed needs to be displayed (think a list of results) while the actual
mongoose object contains the full data when viewing one of the results.

However, if you want the results to be actual mongoose objects you can
provide {hydrate:true} as the second argument to a search call.

```javascript

User.search({query:"john"}, {hydrate:true}, function(err, results) {
  // results here
});

```

Note this will be a degree slower as it will perform an elasticsearch
query and then do a query against mongodb for all the ids returned from
the search result. 

You can also default this to always be the case by providing it as a
plugin option:


```javascript
var User = new Schema({
    name: {type:String, es_indexed:true}
  , email: String
  , city: String
})

User.plugin(mongoosastic, {index:'users', type:'user', hydrate:true})

### Model.plugin(mongoosastic, options)

Options are:

* `index` - the index in elastic search to use. Defaults to the
  pluralization of the model name.
* `type`  - the type this model represents in elastic search. Defaults
  to the model name.
* `host` - the host elastic search is running on
* `hydrate` - whether or not to lookup results in mongodb before
  returning results from a search. Defaults to false.

