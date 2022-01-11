Schemas can be configured to have special options per field. These match
with the existing [field mapping configurations](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-types.html) defined by Elasticsearch with the only difference being they are all prefixed by "es_".

So for example. If you wanted to index a book model and have the boost
for title set to 2.0 (giving it greater priority when searching) you'd
define it as follows:

```javascript
var BookSchema = new Schema({
    title: { type: String, es_boost: 2.0 },
    author: { type: String, es_null_value: "Unknown Author" },
    publicationDate: { type: Date, es_type: 'date' }
});

```
This example uses a few other mapping fields... such as null_value and
type (which overrides whatever value the schema type is, useful if you
want stronger typing such as float).

There are various mapping options that can be defined in Elasticsearch. Check out [Mapping](https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html) for more information. Here are examples to the currently possible definitions in mongoosastic:

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

Mapping, indexing and searching example for geo shape can be found in `test/geo.test.ts`

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

const results = await GeoModel.search(geoQuery, { filter: geoFilter })
```

### Creating Mappings On Demand
Creating the mapping is a **one time operation** and **should be called manualy**.

A BookSchema as an example:

```javascript
var BookSchema = new Schema({
    title: { type:String, es_boost:2.0 },
    author: { type: String, es_null_value: "Unknown Author" },
    publicationDate: { type: Date, es_type: 'date'}
})

BookSchema.plugin(mongoosastic);

var Book = mongoose.model('Book', BookSchema);

const mapping = await Book.createMapping({
  "analysis" : {
    "analyzer":{
      "content":{
        "type":"custom",
        "tokenizer":"whitespace"
      }
    }
  }
});
```
This feature is still a work in progress. As of this writing you'll have
to manage whether or not you need to create the mapping, mongoosastic
will make no assumptions and simply attempt to create the mapping. If
the mapping already exists, an Exception detailing such will be thrown.