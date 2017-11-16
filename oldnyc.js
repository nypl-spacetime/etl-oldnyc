const fs = require('fs')
const path = require('path')
const request = require('request')
const H = require('highland')
const JSONStream = require('JSONStream')
const digitalCollections = require('digital-collections')

const dataUrl = 'https://raw.githubusercontent.com/oldnyc/oldnyc.github.io/master/data.json'

const requestsPerSecond = 10
const cacheFilename = 'imageIdsToUuids.json'

// Global cache
let imageIdsToUuids = {}

function loadCacheFile (cachePath) {
  try {
    imageIdsToUuids = require(cachePath)
  } catch (err) {
    console.log(`      ${cachePath} not found — creating new cache file! 🙅\n`)
  }
}

function saveCacheFile (cachePath) {
  fs.writeFileSync(cachePath, JSON.stringify(imageIdsToUuids, null, 2))
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

function findUuid (cachePath, photo, callback) {
  const imageId = photo.imageId
  if (imageIdsToUuids[imageId] !== undefined) {
    addUuid(photo, imageIdsToUuids[imageId], callback)
  } else {
    const options = {
      fieldName: 'local_image_id',
      value: photo.imageId
    }

    console.log(`      Getting UUID for Image ID ${imageId}`)

    digitalCollections.uuidForLocalIdentifier(options, (err, uuid) => {
      if (err) {
        callback(err)
        return
      }

      imageIdsToUuids[imageId] = uuid || null
      saveCacheFile(cachePath)

      if (!uuid) {
        console.log('        Error, UUID not found...')
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

function cachedDownload (config, dirs, tools, callback) {
  const cachePath = path.join(dirs.current, cacheFilename)
  loadCacheFile(cachePath)

  const stream = request(dataUrl)
    .pipe(JSONStream.parse('photos.*'))

  H(stream)
    .map(findImageId)
    .map(H.curry(findUuid, cachePath))
    .nfcall([])
    .series()
    .stopOnError(callback)
    .map(JSON.stringify)
    .intersperse('\n')
    .pipe(fs.createWriteStream(path.join(dirs.current, 'data.ndjson')))
    .on('finish', callback)
}

function download (config, dirs, tools, callback) {
  const cachePath = path.join(dirs.current, cacheFilename)

  if (!fs.existsSync(cachePath)) {
    fs.createReadStream(path.join(__dirname, 'data', cacheFilename))
      .pipe(fs.createWriteStream(cachePath))
      .on('error', callback)
      .on('finish', () => {
        cachedDownload(config, dirs, tools, callback)
      })
  } else {
    cachedDownload(config, dirs, tools, callback)
  }
}

function transform (config, dirs, tools, callback) {
  H(fs.createReadStream(path.join(dirs.previous, 'data.ndjson')))
    .split()
    .compact()
    .map(JSON.parse)
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
          text: photo.text || undefined,
          folder: photo.folder,
          url: `https://www.oldnyc.org/#${photo.photo_id}`,
          imageUrl: photo.image_url,
          nyplUrl: 'http://digitalcollections.nypl.org/items/' + photo.uuid
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
