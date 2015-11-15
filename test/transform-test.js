var mongoose = require('mongoose'),
  config = require('./config'),
  Schema = mongoose.Schema,
  Repo,
  mongoosastic = require('../lib/mongoosastic');

// -- Only index specific field
var RepoSchema = new Schema({
  name: {
    type: String,
    es_indexed: true
  },
  settingLicense: {
    type: String
  },
  detectedLicense: {
    type: String
  }
});


RepoSchema.plugin(mongoosastic, {
  transform: function(data, repo) {
    data.license = repo.settingLicense || repo.detectedLicense;
    return data;
  }
});

Repo = mongoose.model('Repo', RepoSchema);

describe('Transform mode', function() {
  this.timeout(5000);

  before(function(done) {
    config.deleteIndexIfExists(['repos'], function() {
      mongoose.connect(config.mongoUrl, function() {
        var client = mongoose.connections[0].db;
        client.collection('repos', function() {
          Repo.remove(done);
        });
      });
    });
  });

  after(function(done) {
    mongoose.disconnect();
    Repo.esClient.close();
    done();
  });

  it('should index with field "fullTitle"', function(done) {
    config.createModelAndEnsureIndex(Repo, {
      name: 'LOTR',
      settingLicense: '',
      detectedLicense: 'Apache'
    }, function() {
      Repo.search({
        query_string: {
          query: 'Apache'
        }
      }, function(err, results) {
        results.hits.total.should.eql(1);
        done();
      });
    });
  });
});
