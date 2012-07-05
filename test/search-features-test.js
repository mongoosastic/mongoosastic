var mongoose  = require('mongoose')
  , elastical = require('elastical')
  , should    = require('should')
  , config    = require('./config')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.ObjectId
  , async     = require('async')
  , mongoosastic = require('../lib/mongoosastic');

var esClient  = new elastical.Client();
var BondSchema = new Schema({
    name: String
  , type: {type:String, default:'Other Bond'}
  , price: Number
});

BondSchema.plugin(mongoosastic);

var Bond = mongoose.model('Bond', BondSchema);

describe('Query DSL', function(){
  before(function(done){
    mongoose.connect(config.mongoUrl, function(){
      Bond.remove(function(){
        config.deleteIndexIfExists(['bonds'], function(){
          var bonds = [
              new Bond({name:'Bail', type:'A', price:10000})
            , new Bond({name:'Commercial', type:'B', price:15000})
            , new Bond({name:'Construction', type:'B', price:20000})
            , new Bond({name:'Legal', type:'C', price:30000})
          ];
          async.forEach(bonds, save, function(){
            setTimeout(done, 1100);
          });
        });
      });
    });
  });
  after(function(done){
    Bond.remove(done);
  });
  describe('range', function(){
    it('should be able to find within range', function(done){
      Bond.search({
        query:{
          range: {
            price:{
              from:20000
            , to: 30000
            }
          }
        }
      }, function(err, res){
        res.hits.total.should.eql(2);
        res.hits.hits.forEach(function(bond){
          ['Legal', 'Construction'].should.include(bond._source.name);
        });
        done();
      });
    });
  });
});

function save(model, cb){
  model.save();
  model.on('es-indexed', cb);
}
