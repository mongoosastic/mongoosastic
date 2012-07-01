# Mongoosastic
A [mongoose](http://mongoosejs.com/) plugin that indexes models into [elasticsearch](http://www.elasticsearch.org/). I kept
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

This will by default simply use the pluralization of the model name as the index 
while using the model name itself as the type. So if you create a new
User object and save it, you can see it by navigating to
http://localhost:9200/users/user/_search (this assumes elasticsearch is
running locally on port 9200). 

The default behavior is all fields get indexed into elasticsearch. This can be a little wasteful especially considering that
the document is now just being duplicated between mongodb and
elasticsearch so you should consider opting to index only certain fields by specifying ''es_indexed'' on the 
fields you want to store:


```javascript
var User = new Schema({
    name: {type:String, es_indexed:true}
  , email: String
  , city: String
})

User.plugin(mongoosastic)
```

In this case only the name field
will be indexed for searching. 

Finally, adding the plugin will add a new method to the model called
search which can be used to make simple to complex searches. 

```javascript

User.search({query:"john"}, function(err, results) {
  // results here
});

```

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
One caveat... this is kinda slow for now. Use with care.

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

#### Creating Mappings for These Features
The way this can be mapped in elastic search is by creating a mapping
for the index the model belongs to. Currently to the best of my
knowledge mappings are create once when creating an index and can only
be modified by destroying the index. 

As such, creating the mapping is a one time operation and can be done as
follows (using the BookSchema as an example):

```javascript 
var BookSchema = new Schema({
    title: {type:String, es_boost:2.0}
  , author: {type:String, es_null_value:"Unknown Author"}
  , publicationDate: {type:Date, es_type:'date'} 

BookSchema.plugin(mongoosastic);
var Book = mongoose.model('Book', BookSchema);
Book.createMapping(function(err, mapping){
  // do neat things here
});

```
This feature is still a work in progress. As of this writing you'll have
to manage whether or not you need to create the mapping, mongoosastic
will make no assumptions and simply attempt to create the mapping. If
the mapping already exists, an Exception detailing such will be
populated in the `err` argument. 

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

User.plugin(mongoosastic, {hydrate:true})
```


### Model.plugin(mongoosastic, options)

Options are:

* `index` - the index in elastic search to use. Defaults to the
  pluralization of the model name.
* `type`  - the type this model represents in elastic search. Defaults
  to the model name.
* `host` - the host elastic search is running on
* `hydrate` - whether or not to lookup results in mongodb before
  returning results from a search. Defaults to false.

#### Specifying Different Index and Type
Perhaps you have an existing index and you want to specify the index and
type used to index your document? No problem!!

```javascript
var SupervisorSchema = new Schema({
  name: String
, department: String
});

SupervisorSchema.plugin(mongoosastic, {index: 'employees', type:'manager'});

var Supervisor = mongoose.model('supervisor', SupervisorSchema);

```
## Contributing
Pull requests are always welcome as long as an accompanying test case is
associated. 

Essentially, create a new feature branch and when you're ready issue a
pull request for the feature branch. Pull requests must be made against the develop branch and will typically see release ASAP given all tests are passing.

### Running Tests
In order to run the tests you will need:

* An elasticsearch server running on port 9200
* A mongodb server
* [mocha](http://visionmedia.github.com/mocha/)

With those installed, running ''npm test'' will run the tests with the
preferred timeout (which is extended for integration tests. 


## License
Copyright (c) 2012 James R. Carr <james.r.carr@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

