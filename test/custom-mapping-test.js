var mongoose = require('mongoose'),
  config = require('./config'),
  Schema = mongoose.Schema,
  Phone,
  mongoosastic = require('../lib/mongoosastic');

// -- Only index specific field
var PhoneSchema = new Schema({
  name: {
    type: String,
    es_indexed: true
  }
});


PhoneSchema.plugin(mongoosastic, {
  transform: function(data, phone) {
    data.created = new Date(phone._id.generationTime * 1000);
    return data;
  },
  customProperties: {
    created: {
      type: 'date'
    }
  }
});

Phone = mongoose.model('Phone', PhoneSchema);

describe('Custom Properties for Mapping', function() {
  this.timeout(5000);

  before(function(done) {
    config.deleteIndexIfExists(['phones'], function() {
      mongoose.connect(config.mongoUrl, function() {
        var client = mongoose.connections[0].db;
        client.collection('phones', function() {
          Phone.remove(done);
        });
      });
    });
  });

  after(function(done) {
    mongoose.disconnect();
    Phone.esClient.close();
    done();
  });

  it('should index with field "fullTitle"', function(done) {
    config.createModelAndEnsureIndex(Phone, {
      name: 'iPhone'
    }, function() {
      Phone.search({
        query_string: {
          query: 'iPhone'
        }
      }, {
        sort: 'created:asc'
      }, function(err, results) {
        results.hits.total.should.eql(1);
        done();
      });
    });
  });
});
