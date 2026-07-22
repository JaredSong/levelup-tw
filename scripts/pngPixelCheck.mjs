// Minimal PNG pixel decoder used only to detect a flat/blank crop (every
// pixel the same colour) — the failure mode a page-boundary crop bug
// produces (see build-exam-packs.mjs INACTIVE_IDS, 2026-07-21 entries).
//
// Deliberately dependency-free: publicationGate.mjs must run identically on
// Cloudflare's build image with no network and no poppler. node:zlib is the
// only import — it ships with Node itself, so this adds nothing the build
// environment doesn't already have.
//
// Scope: PNG only (one .jpg exists in the whole image set; JPEG's DCT
// decode is out of scope for a cheap deterministic gate check — callers
// should treat non-PNG files as unsupported and skip them, not fail them).
// Anything this decoder cannot confidently parse (unexpected color type,
// bit depth, interlacing, or a chunk-parse/inflate error) is reported as
// `{ supported: false }` rather than guessed at — a decoder bug must never
// block a good deploy, so "cannot tell" always means "skip", never "block".

import { inflateSync } from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

// channels present per PNG color type, per the spec.
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

function readChunks(buffer) {
  const chunks = []
  let offset = PNG_SIGNATURE.length
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > buffer.length) break
    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) })
    offset = dataEnd + 4 // skip the trailing CRC
  }
  return chunks
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

// Reverses PNG's per-scanline filtering, producing the raw (unfiltered)
// pixel bytes, row-major, with no filter-type byte and no row padding.
function unfilter(inflated, height, bytesPerRow, bytesPerPixel) {
  const out = Buffer.alloc(height * bytesPerRow)
  let inOffset = 0
  for (let y = 0; y < height; y += 1) {
    if (inOffset >= inflated.length) throw new Error('truncated PNG scanline data')
    const filterType = inflated[inOffset]
    inOffset += 1
    const rowStart = y * bytesPerRow
    const prevRowStart = rowStart - bytesPerRow
    for (let x = 0; x < bytesPerRow; x += 1) {
      const rawByte = inflated[inOffset + x]
      const a = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel] : 0
      const b = y > 0 ? out[prevRowStart + x] : 0
      const c = y > 0 && x >= bytesPerPixel ? out[prevRowStart + x - bytesPerPixel] : 0
      let value
      switch (filterType) {
        case 0: value = rawByte; break
        case 1: value = (rawByte + a) & 0xff; break
        case 2: value = (rawByte + b) & 0xff; break
        case 3: value = (rawByte + ((a + b) >> 1)) & 0xff; break
        case 4: value = (rawByte + paeth(a, b, c)) & 0xff; break
        default: throw new Error(`unsupported PNG filter type ${filterType}`)
      }
      out[rowStart + x] = value
    }
    inOffset += bytesPerRow
  }
  return out
}

// Reads `count` samples of `bitDepth` bits, packed MSB-first, from one
// defiltered scanline — trailing pad bits past `count` samples are ignored,
// which matters for bit depths under 8 when width isn't a byte multiple.
function readSamples(row, count, bitDepth) {
  const samples = new Array(count)
  if (bitDepth === 8) {
    for (let i = 0; i < count; i += 1) samples[i] = row[i]
    return samples
  }
  if (bitDepth === 16) {
    for (let i = 0; i < count; i += 1) samples[i] = (row[i * 2] << 8) | row[i * 2 + 1]
    return samples
  }
  let bitPos = 0
  const mask = (1 << bitDepth) - 1
  for (let i = 0; i < count; i += 1) {
    const byteIndex = bitPos >> 3
    const bitOffset = bitPos & 7
    samples[i] = (row[byteIndex] >> (8 - bitDepth - bitOffset)) & mask
    bitPos += bitDepth
  }
  return samples
}

/**
 * Inspects a PNG buffer and reports whether every pixel's colour channels
 * (alpha excluded, matching how a viewer would render it against any
 * background) carry the exact same value — i.e. the crop is a single flat
 * colour, the failure mode of a bad crop rectangle landing entirely off the
 * source figure.
 *
 * Returns `{ supported: false }` when the file can't be confidently decoded
 * (non-PNG, interlaced, exotic color type, or a parse/inflate error) —
 * callers must treat that as "skip", never as "flat".
 */
export function checkPngFlatness(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { supported: false, reason: 'not a PNG file' }
  }
  let chunks
  try {
    chunks = readChunks(buffer)
  } catch (error) {
    return { supported: false, reason: `chunk parse failed: ${error.message}` }
  }
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')
  if (!ihdr || ihdr.data.length < 13) return { supported: false, reason: 'missing IHDR' }

  const width = ihdr.data.readUInt32BE(0)
  const height = ihdr.data.readUInt32BE(4)
  const bitDepth = ihdr.data.readUInt8(8)
  const colorType = ihdr.data.readUInt8(9)
  const interlace = ihdr.data.readUInt8(12)

  if (interlace !== 0) return { supported: false, reason: 'interlaced PNG not supported' }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType]
  if (!channels) return { supported: false, reason: `unsupported color type ${colorType}` }
  if (![1, 2, 4, 8, 16].includes(bitDepth)) return { supported: false, reason: `unsupported bit depth ${bitDepth}` }
  if (width <= 0 || height <= 0) return { supported: false, reason: 'zero-sized image' }

  const idatChunks = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)
  if (idatChunks.length === 0) return { supported: false, reason: 'no IDAT chunk' }

  let inflated
  try {
    inflated = inflateSync(Buffer.concat(idatChunks))
  } catch (error) {
    return { supported: false, reason: `inflate failed: ${error.message}` }
  }

  const bytesPerRow = Math.ceil((channels * bitDepth * width) / 8)
  const bytesPerPixel = Math.max(1, Math.ceil((channels * bitDepth) / 8))
  const expectedLength = height * (bytesPerRow + 1)
  if (inflated.length < expectedLength) return { supported: false, reason: 'truncated pixel data' }

  let pixels
  try {
    pixels = unfilter(inflated, height, bytesPerRow, bytesPerPixel)
  } catch (error) {
    return { supported: false, reason: `unfilter failed: ${error.message}` }
  }

  // Drop the alpha channel (if any) — a uniformly-coloured but transparent
  // image is still a broken crop, but what matters here is whether the
  // visible colour is flat, matching how the audit's PIL check (`.convert
  // ('L')`, which discards alpha) read the three known-bad crops. Keyed off
  // colorType, not channel count, since channels alone can't distinguish
  // gray+alpha (2 channels, 1 visible) from RGB (also happens to need all
  // of its channels compared).
  const colorChannels = colorType === 2 || colorType === 6 ? 3 : 1

  let min = Infinity
  let max = -Infinity
  for (let y = 0; y < height; y += 1) {
    const row = pixels.subarray(y * bytesPerRow, (y + 1) * bytesPerRow)
    const samples = readSamples(row, width * channels, bitDepth)
    for (let p = 0; p < width; p += 1) {
      for (let c = 0; c < colorChannels; c += 1) {
        const value = samples[p * channels + c]
        if (value < min) min = value
        if (value > max) max = value
      }
    }
  }

  return { supported: true, flat: min === max, min, max, width, height }
}

/**
 * Decodes a PNG and returns lightweight content geometry: image size, whether
 * it is exactly flat, and the bounding box of visible non-white content.
 *
 * This is intentionally simple and conservative. It is not an OCR or visual
 * comparison engine; it catches crop-shape failures that are easy to miss with
 * dimensions alone, especially tiny symbols cut flush against an image edge.
 */
export function analyzePngContent(buffer, { whiteThreshold = 245 } = {}) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { supported: false, reason: 'not a PNG file' }
  }
  let chunks
  try {
    chunks = readChunks(buffer)
  } catch (error) {
    return { supported: false, reason: `chunk parse failed: ${error.message}` }
  }
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')
  if (!ihdr || ihdr.data.length < 13) return { supported: false, reason: 'missing IHDR' }

  const width = ihdr.data.readUInt32BE(0)
  const height = ihdr.data.readUInt32BE(4)
  const bitDepth = ihdr.data.readUInt8(8)
  const colorType = ihdr.data.readUInt8(9)
  const interlace = ihdr.data.readUInt8(12)

  if (interlace !== 0) return { supported: false, reason: 'interlaced PNG not supported' }
  const channels = CHANNELS_BY_COLOR_TYPE[colorType]
  if (!channels) return { supported: false, reason: `unsupported color type ${colorType}` }
  if (![1, 2, 4, 8, 16].includes(bitDepth)) return { supported: false, reason: `unsupported bit depth ${bitDepth}` }
  if (width <= 0 || height <= 0) return { supported: false, reason: 'zero-sized image' }

  const idatChunks = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)
  if (idatChunks.length === 0) return { supported: false, reason: 'no IDAT chunk' }

  let inflated
  try {
    inflated = inflateSync(Buffer.concat(idatChunks))
  } catch (error) {
    return { supported: false, reason: `inflate failed: ${error.message}` }
  }

  const bytesPerRow = Math.ceil((channels * bitDepth * width) / 8)
  const bytesPerPixel = Math.max(1, Math.ceil((channels * bitDepth) / 8))
  const expectedLength = height * (bytesPerRow + 1)
  if (inflated.length < expectedLength) return { supported: false, reason: 'truncated pixel data' }

  let pixels
  try {
    pixels = unfilter(inflated, height, bytesPerRow, bytesPerPixel)
  } catch (error) {
    return { supported: false, reason: `unfilter failed: ${error.message}` }
  }

  const paletteChunk = chunks.find((chunk) => chunk.type === 'PLTE')
  const palette = paletteChunk
    ? Array.from({ length: Math.floor(paletteChunk.data.length / 3) }, (_, index) => ({
      r: paletteChunk.data[index * 3],
      g: paletteChunk.data[index * 3 + 1],
      b: paletteChunk.data[index * 3 + 2],
    }))
    : []

  let min = Infinity
  let max = -Infinity
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let contentPixels = 0

  for (let y = 0; y < height; y += 1) {
    const row = pixels.subarray(y * bytesPerRow, (y + 1) * bytesPerRow)
    const samples = readSamples(row, width * channels, bitDepth)
    for (let x = 0; x < width; x += 1) {
      const base = x * channels
      let gray
      let alpha = 255
      if (colorType === 2 || colorType === 6) {
        const divisor = bitDepth === 16 ? 257 : 1
        const r = samples[base] / divisor
        const g = samples[base + 1] / divisor
        const b = samples[base + 2] / divisor
        gray = Math.round((r * 299 + g * 587 + b * 114) / 1000)
        if (colorType === 6) alpha = samples[base + 3] / divisor
      } else if (colorType === 3) {
        const color = palette[samples[base]]
        gray = color ? Math.round((color.r * 299 + color.g * 587 + color.b * 114) / 1000) : samples[base]
      } else {
        const divisor = bitDepth === 16 ? 257 : ((1 << bitDepth) - 1) / 255
        gray = Math.round(samples[base] / divisor)
        if (colorType === 4) alpha = Math.round(samples[base + 1] / divisor)
      }

      if (gray < min) min = gray
      if (gray > max) max = gray
      if (alpha > 0 && gray < whiteThreshold) {
        contentPixels += 1
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const bbox = contentPixels > 0
    ? {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      margins: {
        left: minX,
        top: minY,
        right: width - maxX - 1,
        bottom: height - maxY - 1,
      },
    }
    : null

  return {
    supported: true,
    width,
    height,
    flat: min === max,
    min,
    max,
    contentPixels,
    bbox,
  }
}
