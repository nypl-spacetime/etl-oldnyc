var fs = require('fs')
var path = require('path')
var request = require('request')
var H = require('highland')
var JSONStream = require('JSONStream')

var baseUrl = 'https://www.oldnyc.org/'
var counts = 'lat-lon-counts.js'

var downloadLatlonFile = function (latLon, callback) {
  var url = baseUrl + 'by-location/' + latLon.replace(',', '') + '.json'
  console.log('\tdownloading ' + latLon)

  request(url, {json: true}, function (err, response, json) {
    if (err) {
      callback(err)
      return
    }

    callback(null, {
      coordinates: latLon.split(',').reverse().map((c) => parseFloat(c)),
      data: json
    })
  })
}

function download (config, dirs, tools, callback) {
  H(request(baseUrl + counts))
    .splitBy(':')
    .map(function (line) {
      return line.match(/(-?\d+\.\d*)/g)
    })
    .compact()
    .toArray((latLons) => {
      H(latLons)
        .map((latLon) => latLon.join(','))
        .map(H.curry(downloadLatlonFile))
        .nfcall([])
        .series()
        .errors(callback)
        .pipe(JSONStream.stringify())
        .on('end', callback)
        .pipe(fs.createWriteStream(path.join(dirs.current, 'data.json')))
    })
}

function transform (config, dirs, tools, callback) {
  var stream = fs.createReadStream(path.join(dirs.previous, 'data.json'))
    .pipe(JSONStream.parse('*'))

  H(stream)
    .map(function (d) {
      var geometry = {
        type: 'Point',
        coordinates: d.coordinates
      }

      return Object.keys(d.data).map(function (key) {
        var obj = d.data[key]

        var imageId = key.split('-')[0]

        var pit = {
          id: key,
          type: 'st:Photo',
          data: {
            text: obj.text,
            imageUrl: obj.image_url,
            nyplUrl: 'http://digitalcollections.nypl.org/items/image_id/' + imageId
          },
          geometry: geometry
        }

        if (obj.original_title) {
          pit.name = obj.original_title
        }

        if (obj.date) {
          var matches = obj.date.match(/(\b\d{4}\b)/g)
          if (matches) {
            var years = matches.map(function (m) {
              return parseInt(m)
            }).sort()

            var minYear = years[0]
            var maxYear = years[years.length - 1]

            pit.validSince = minYear
            pit.validUntil = maxYear
          }
        }

        return pit
      })
    })
    .flatten()
    .map((pit) => ({
      type: 'pit',
      obj: pit
    }))
    .map(H.curry(tools.writer.writeObject))
    .nfcall([])
    .series()
    .errors(callback)
    .done(callback)
}

// ==================================== API ====================================

module.exports.steps = [
  download,
  transform
]
