const metas = require('../../data/metazone')
// const metas = require('../../data/05-metazones')
const offsets = require('./offsets')

const titleCase = function (str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
}

const display = function (id) {
  if (!id) {
    return null
  }
  let meta = metas.find((obj) => {
    return obj.ids.find((tz) => {
      return tz === id
    })
  })
  if (!meta) {
    let offset = offsets[id.toLowerCase()]
    if (offset !== undefined) {
      let abbrev = `UTC${offset}`
      let parts = id.split(/\//)
      let name = titleCase(parts[parts.length - 1])
      name = name.replace(/_/g, ' ')
      name += ' Time'
      meta = {
        std: { name: name, abbrev: abbrev },
        offset: null
      }
    } else {
      meta = {
        std: { name: id, abbrev: id }, // 'Etc/GMT+5'
        offset: null
      }
    }
  }
  return {
    iana: id,
    standard: meta.std || null,
    daylight: meta.dst || null
    // offset: meta.offset - 1 || null
  }
}
module.exports = display
