var should    = require('should')
  , generator = new (require('../lib/mapping-generator'))
  , serialize = require('../lib/serialize')
  , mongoose  = require('mongoose')
  , Schema    = mongoose.Schema
  , ObjectId  = Schema.Types.ObjectId;

var BowlingBall = mongoose.model('BowlingBall', new Schema({

}));
var PersonSchema22 = new Schema({
  name: {
      first: String
    , last: String
  },
  dob: Date,
  bowlingBall: {type:Schema.ObjectId, ref:'BowlingBall'}
});

var Person = mongoose.model('Person22', PersonSchema22);

var mapping;

// Serialize method requires a schema mapping
generator.generateMapping(PersonSchema22, function(err, tmp) {
  mapping = tmp;
});

describe('serialize', function(){
  var dude = new Person({
    name: {first:'Jeffery', last:'Lebowski'},
    dob: new Date(Date.parse('05/17/1962')),
    bowlingBall: new BowlingBall()
  });
  describe('with no indexed fields', function(){
    var serialized = serialize(dude, mapping);
    it('should serialize model fields', function(){
      serialized.name.first.should.eql('Jeffery');
      serialized.name.last.should.eql('Lebowski');
    });
    it('should serialize object ids as strings', function(){
      serialized.bowlingBall.should.eql(dude.bowlingBall);
    });

    it('should serialize dates in ISO 8601 format', function(){
      serialized.dob.should.eql(dude.dob)
    });
  });

  describe('indexed fields', function(){

  });
});
