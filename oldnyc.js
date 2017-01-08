const fs = require('fs')
const path = require('path')
const request = require('request')
const H = require('highland')
const JSONStream = require('JSONStream')
const digitalCollections = require('digital-collections')

const dataUrl = 'https://raw.githubusercontent.com/oldnyc/oldnyc.github.io/master/data.json'

const requestsPerSecond = 10
const cacheFilename = 'imageIdsToUuids.json'
var cacheFileDir
var imageIdsToUuids = {}

function loadCacheFile (dir) {
  cacheFileDir = dir
  try {
    imageIdsToUuids = require(path.join(dir, cacheFilename))
  } catch (err) {
    console.log(`      ${cacheFilename} not found — creating new cache file! 🙅\n`)
  }
}

function saveCacheFile () {
  if (cacheFileDir) {
    fs.writeFileSync(path.join(cacheFileDir, cacheFilename), JSON.stringify(imageIdsToUuids, null, 2))
  }
}

function findImageId (photo) {
  return Object.assign(photo, {
    imageId: photo.photo_id.split('-')[0]
  })
}

function addUuid (photo, uuid, callback) {
  callback(null, Object.assign(photo, {
    uuid: uuid
  }))
}

function findUuid (photo, callback) {
  const imageId = photo.imageId
  if (imageIdsToUuids[imageId] !== undefined) {
    addUuid(photo, imageIdsToUuids[imageId], callback)
  } else {
    const options = {
      fieldName: 'local_image_id',
      value: photo.imageId
    }

    console.log(`      Getting UUID for Image ID ${imageId}`)

    digitalCollections.uuidForLocalIdentifier (options, (err, uuid) => {
      if (err) {
        callback(err)
        return
      }

      imageIdsToUuids[imageId] = uuid || null
      saveCacheFile()

      if (!uuid) {
        console.log(`        Error, UUID not found...`)
        callback(null, photo)
      } else {
        console.log(`        Found: ${uuid}`)
        setTimeout(() => {
          addUuid(photo, imageIdsToUuids[imageId], callback)
        }, 1000 / requestsPerSecond)
      }
    })
  }
}

function download (config, dirs, tools, callback) {
  loadCacheFile(dirs.current)

  var stream = request(dataUrl)
    .pipe(JSONStream.parse('photos.*'))

  H(stream)
    .map(findImageId)
    .map(H.curry(findUuid))
    .nfcall([])
    .series()
    .errors(callback)
    .pipe(JSONStream.stringify())
    .pipe(fs.createWriteStream(path.join(dirs.current, 'data.json')))
    .on('finish', callback)
}

function transform (config, dirs, tools, callback) {
  var stream = fs.createReadStream(path.join(dirs.previous, 'data.json'))
    .pipe(JSONStream.parse('*'))

  H(stream)
    .map((photo) => {
      const geometry = {
        type: 'Point',
        coordinates: [
          photo.location.lon,
          photo.location.lat
        ]
      }

      const imageId = photo.imageId

      var object = {
        id: photo.photo_id,
        type: 'st:Photo',
        name: photo.title || photo.original_title,
        data: {
          uuid: photo.uuid,
          imageId: photo.imageId,
          text: photo.text,
          folder: photo.folder,
          url: `https://www.oldnyc.org/#${photo.photo_id}`,
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

          object.validSince = minYear
          object.validUntil = maxYear
        }
      }

      return object
    })
    .flatten()
    .map((object) => ({
      type: 'object',
      obj: object
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
