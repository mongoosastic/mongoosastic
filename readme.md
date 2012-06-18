# Mongoosastic
A mongoose plugin that indexes models into elastic search


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

