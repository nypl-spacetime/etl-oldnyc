var fs = require('fs');
var path = require('path');
var request = require('request');
var H = require('highland');
var JSONStream = require('JSONStream');

var latLons = require('./lat-lons.json');

var downloadLatlonFile = function(latLon, callback) {
  var url = 'https://www.oldnyc.org/by-location/' + latLon.replace(',', '') + '.json';
  console.log('\tdownloading ' + latLon);
  request(url, {json: true}, function (err, response, json) {
    if (err) {
      callback(err);
    }
    callback(null, {
      coordinates: latLon.split(',').reverse().map(function(c) {
        return parseFloat(c);
      }),
      data: json
    });
  });
};

var writePit = function(writer, pit, callback) {
  var data = [
    {
      type: 'pit',
      obj: pit
    }
  ];

  writer.writeObjects(data, function(err) {
    callback(err);
  });
};

function download(config, dir, writer, callback) {
  H(Object.keys(latLons))
    .map(H.curry(downloadLatlonFile))
    .nfcall([])
    .series()
    .pipe(JSONStream.stringify())
    .on('end', function() {
      callback();
    })
    .pipe(fs.createWriteStream(path.join(dir, 'data.json')));
}

function convert(config, dir, writer, callback) {
  var stream = fs.createReadStream(path.join(dir, 'data.json'))
    .pipe(JSONStream.parse('*'));

  H(stream)
    .map(function(d) {
      var geometry = {
        type: 'Point',
        coordinates: d.coordinates
      };

      return Object.keys(d.data).map(function(key) {
        var obj = d.data[key];

        var imageId = key.split('-')[0];

        var pit = {
          id: key,
          type: 'st:Photo',
          data: {
            text: obj.text,
            imageUrl: obj.image_url,
            nyplUrl: 'http://digitalcollections.nypl.org/items/image_id/' + imageId
          },
          geometry: geometry
        };

        if (obj.original_title) {
          pit.name = obj.original_title;
        }

        var matches = obj.date.match(/(\b\d{4}\b)/g);
        if (matches) {
          var years = matches.map(function(m) {
              return parseInt(m);
            }).sort();

          var minYear = years[0];
          var maxYear = years[years.length - 1];

          pit.validSince = minYear;
          pit.validUntil = maxYear;
        }

        return pit;
      });
    })
    .flatten()
    .map(H.curry(writePit, writer))
    .nfcall([])
    .series()
    .errors(function(err){
      console.error(err);
    })
    .done(function() {
      callback();
    });
}

// ==================================== API ====================================

module.exports.title = 'OldNYC';
module.exports.url = 'https://www.oldnyc.org/';

module.exports.steps = [
  download,
  convert
];
