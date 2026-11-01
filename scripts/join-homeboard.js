const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const root = path.join(__dirname, '..')
function loadPart(name) {
  const b64 = fs.readFileSync(path.join(root, 'app/dashboard', name), 'utf8').trim()
  return zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8')
}
const a = loadPart('hb-a.b64')
const b = loadPart('hb-b.b64')
fs.writeFileSync(path.join(root, 'app/dashboard/HomeBoard.tsx'), a + b)
console.log('HomeBoard joined', a.length + b.length)
