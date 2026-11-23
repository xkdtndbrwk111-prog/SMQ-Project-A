/**
 * Minimal, dependency-free ZIP reader for BUILD-TIME verification of approved
 * HOJA archives (stored + deflate only). Reads the central directory, refuses
 * ZIP64, encrypted entries, duplicate names, path traversal and size lies.
 */
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';

export const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const fail = code => { throw new Error('HOJA_ZIP_' + code); };

export function readZip(buf, {maxEntries = 4000, maxEntryBytes = 64 * 1024 * 1024} = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) fail('TOO_SMALL');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) fail('NO_EOCD');
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOff = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOff === 0xffffffff) fail('ZIP64_UNSUPPORTED');
  if (count > maxEntries || cdOff + cdSize > eocd) fail('CENTRAL_DIRECTORY');
  const entries = new Map();
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) fail('CD_SIGNATURE');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString((flags & 0x800) ? 'utf8' : 'latin1');
    p += 46 + nlen + xlen + clen;
    if (flags & 1) fail('ENCRYPTED');
    if (name.startsWith('/') || name.split('/').includes('..') || name.includes('\\')) fail('PATH:' + name);
    if (entries.has(name)) fail('DUPLICATE:' + name);
    if (usize > maxEntryBytes) fail('ENTRY_TOO_LARGE');
    entries.set(name, {name, method, csize, usize, local, dir: name.endsWith('/')});
  }
  function read(name) {
    const e = entries.get(name);
    if (!e || e.dir) fail('MISSING:' + name);
    if (buf.readUInt32LE(e.local) !== 0x04034b50) fail('LOCAL_SIGNATURE');
    const nlen = buf.readUInt16LE(e.local + 26), xlen = buf.readUInt16LE(e.local + 28);
    const start = e.local + 30 + nlen + xlen;
    const raw = buf.subarray(start, start + e.csize);
    let out;
    if (e.method === 0) out = Buffer.from(raw);
    else if (e.method === 8) out = inflateRawSync(raw, {maxOutputLength: maxEntryBytes});
    else fail('METHOD_' + e.method);
    if (out.length !== e.usize) fail('SIZE_MISMATCH:' + name);
    return out;
  }
  return {
    names: () => [...entries.values()].filter(e => !e.dir).map(e => e.name).sort(),
    has: name => entries.has(name) && !entries.get(name).dir,
    read,
    json: name => JSON.parse(read(name).toString('utf8')),
  };
}

/* Test helper: build a deflate ZIP in memory (used only by fixture tests). */
import {deflateRawSync, crc32 as zcrc} from 'node:zlib';
function crc32(buf) {
  if (typeof zcrc === 'function') return zcrc(buf) >>> 0;
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function writeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
    const comp = deflateRawSync(data), nb = Buffer.from(name, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, nb, comp); centrals.push(ch, nb);
    offset += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  const n = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
