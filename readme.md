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

User.search("john", function(err, results) {
  // results here
});

```


## API

### Model.plugin(mongoosastic, options)

Options are:

* `host` - the host elastic search is running on
* `collection` - the collection name to use. Defaults to the mongodb
  collection name

