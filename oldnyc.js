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
    callback(null, [latLon, json]);
  });
};

function download(config, dir, writer, callback) {
  H(Object.keys(latLons))
    .map(H.curry(downloadLatlonFile))
    .nfcall([])
    .series()
    .pipe(JSONStream.stringifyObject())
    .on('end', function() {
      callback();
    })
    .pipe(fs.createWriteStream(path.join(dir, 'data.json')));
}

function convert(config, dir, writer, callback) {

}

// ==================================== API ====================================

module.exports.title = 'OldNYC';
module.exports.url = 'https://www.oldnyc.org/';

module.exports.steps = [
  download,
  convert
];
