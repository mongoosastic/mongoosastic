The full query DSL of Elasticsearch is exposed through the search
method. For example, if you wanted to find all people between ages 21
and 30:

```javascript
const people = await Person.search({
  range: {
    age:{
      from:21,
      to: 30
    }
  }
});
```
See the Elasticsearch [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html) docs for more information.

You can also specify query options like [sorts](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-sort.html#search-request-sort)

```javascript
const sortedPeople = await Person.search({/* ... */}, { sort: "age:asc" });
```

And also [aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html):

```javascript
const results = await Person.search({/* ... */}, {
  aggs: {
    'names': {
      'terms': {
        'field': 'name'
      }
    }
  }
});
```

Options for queries must adhere to the [javascript elasticsearch driver specs](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-search).

### Raw queries
A full ElasticSearch query object can be provided to mongoosastic through `.esSearch()` method.
It can be useful when paging results. The query to be provided wraps the query object provided to `.search()` method and
accepts the same options:

```javascript
var rawQuery = {
    from: 60,
    size: 20,
    query: /* query object as in .search() */
};

await Model.esSearch(rawQuery, options);
```

For example:

```javascript
// only the 61st to 80th ranked people who fit the age group are here!
const people = await Person.esSearch({
  from: 60,
  size: 20,
  query: {
    range: {
      age:{
        from:21,
        to: 30
      }
    }
  }
});
```

### Hydration
By default objects returned from performing a search will be the objects
as is in Elasticsearch. This is useful in cases where only what was
indexed needs to be displayed (think a list of results) while the actual
mongoose object contains the full data when viewing one of the results.

However, if you want the results to be actual mongoose objects you can
provide `{ hydrate: true }` as the second argument to a search call.

The hydrated results will be accessible through `.hydrated` property.

```javascript
const results = await User.search(
  {
    query_string: {
      query: 'john'
    }
  },
  { hydrate: true }
);

console.log(results.body.hits.hits) // will be empty: []
console.log(results.body.hits.hydrated)
```

You can also pass in a `hydrateOptions` object with information on
how to query for the mongoose object.

```javascript
const results = await User.search(
  {
    query_string: {
      query: 'john'
    }
  },
  {
    hydrate: true,
    hydrateOptions: { select: 'name age' }
  },
);
```

Original ElasticSearch result data can be kept with `hydrateWithESResults` option. Documents are then enhanced with a
`_esResult` property

```javascript
const results = await User.search(
  {
    query_string: {
      query: 'john'
    }
  },
  {
    hydrate: true,
    hydrateWithESResults: true,
    hydrateOptions: { select: 'name age' }
  }
);

results.body.hits.hydrated.forEach(function(result) {
  console.log(
    'score',
    result._id,
    result._esResult._score
  );
});
```

By default the `_esResult._source` document is skipped. It can be added with the option `hydrateWithESResults: { source: false }`.

You can also default this to always be the case by providing it as a
plugin option (as well as setting default hydrate options):


```javascript
var User = new Schema({
    name: { type: String, es_indexed: true },
    email: String,
    city: String
})

User.plugin(mongoosastic, {
  alwaysHydrate: true,
  hydrateOptions: {
    lean: true
  }
})
```

Note using hydrate will be a degree slower as it will perform an Elasticsearch
query and then do a query against mongodb for all the ids returned from
the search result.