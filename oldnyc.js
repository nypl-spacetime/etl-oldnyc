const fs = require('fs')
const path = require('path')
const request = require('request')
const H = require('highland')
const JSONStream = require('JSONStream')

const dataUrl = 'https://raw.githubusercontent.com/oldnyc/oldnyc.github.io/master/data.json'

function download (config, dirs, tools, callback) {
  var stream = request(dataUrl)
  stream.pipe(fs.createWriteStream(path.join(dirs.current, 'maps.json')))
  stream.on('end', callback)
}

function transform (config, dirs, tools, callback) {
  var stream = fs.createReadStream(path.join(dirs.previous, 'maps.json'))
    .pipe(JSONStream.parse('photos.*'))

  H(stream)
    .map((photo) => {
      const geometry = {
        type: 'Point',
        coordinates: [
          photo.location.lat,
          photo.location.lon
        ]
      }

      const imageId = photo.photo_id.split('-')[0]

      var pit = {
        id: photo.photo_id,
        type: 'st:Photo',
        name: photo.title || photo.original_title,
        data: {
          text: photo.text,
          folder: photo.folder,
          imageUrl: photo.image_url,
          nyplUrl: 'http://digitalcollections.nypl.org/items/image_id/' + imageId
        },
        geometry: geometry
      }

      if (photo.date) {
        var matches = photo.date.match(/(\b\d{4}\b)/g)
        if (matches) {
          var years = matches.map((m) => parseInt(m))
            .sort()

          var minYear = years[0]
          var maxYear = years[years.length - 1]

          pit.validSince = minYear
          pit.validUntil = maxYear
        }
      }

      return pit
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
