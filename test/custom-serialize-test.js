var mongoose = require('mongoose'),
  config = require('./config'),
  Schema = mongoose.Schema,
  Food,
  mongoosastic = require('../lib/mongoosastic');

var FoodSchema = new Schema({
  name: {
    type: String
  }
});
FoodSchema.virtual('type').get(() => { return 'dinner'; });
FoodSchema.set('toObject', { getters: true, virtuals: true, versionKey: false });


FoodSchema.plugin(mongoosastic, {
  customSerialize(model) {
    var data = model.toObject();
    delete data.id;
    delete data._id;
    return data;
  }
});

Food = mongoose.model('Food', FoodSchema);

describe('Custom Serialize', function() {
  this.timeout(5000);

  before(function(done) {
    config.deleteIndexIfExists(['foods'], function() {
      mongoose.connect(config.mongoUrl, function() {
        var client = mongoose.connections[0].db;
        client.collection('foods', function() {
          Food.remove(done);
        });
      });
    });
  });

  after(function(done) {
    mongoose.disconnect();
    Food.esClient.close();
    done();
  });

  it('should index all fields returned from the customSerialize function', function(done) {
    config.createModelAndEnsureIndex(Food, { name: 'pizza' }, (error) => {
      Food.search({ query_string: { query: 'pizza' } }, (searchError, results) => {
        if (searchError) return done(error);
        results.hits.hits[0]._source.name.should.eql('pizza');
        results.hits.hits[0]._source.type.should.eql('dinner');
        done();
      });
    });
  });
});
