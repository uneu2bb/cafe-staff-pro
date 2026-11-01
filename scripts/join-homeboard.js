const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const root = path.join(__dirname, '..')
const dir = path.join(root, 'app/dashboard')
function loadParts(prefix) {
  let i = 0
  let out = ''
  while (true) {
    const f = path.join(dir, `${prefix}-${i}.b64`)
    if (!fs.existsSync(f)) break
    out += fs.readFileSync(f, 'utf8').trim()
    i++
  }
  if (!out) throw new Error('missing parts for ' + prefix)
  return zlib.gunzipSync(Buffer.from(out, 'base64')).toString('utf8')
}
const a = loadParts('hb-a')
const b = loadParts('hb-b')
fs.writeFileSync(path.join(dir, 'HomeBoard.tsx'), a + b)
console.log('HomeBoard joined', a.length + b.length)
