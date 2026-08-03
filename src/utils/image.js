// Resize + compress a receipt photo into a small data URL for localStorage.
//
// Receipts only need to stay readable, not sharp, so we aim at a byte budget
// instead of a fixed quality: shrink and re-encode until the result fits.
// Smaller photos = less storage used, faster sync, smoother scrolling.

const MAX_CHARS = 110 * 1024 // ~110 KB of data URL per receipt
const DIMS = [900, 750, 600, 460]
const QUALITIES = [0.55, 0.42, 0.3, 0.22]

let webpSupport = null
function supportsWebp() {
  if (webpSupport === null) {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp')
  }
  return webpSupport
}

function draw(img, maxDim) {
  let { width, height } = img
  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width)
    width = maxDim
  } else if (height >= width && height > maxDim) {
    width = Math.round((width * maxDim) / height)
    height = maxDim
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => resolve(img)
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export async function compressImage(file, maxChars = MAX_CHARS) {
  const img = await loadImage(file)
  // WebP is roughly 25–35% smaller than JPEG at the same visual quality
  const type = supportsWebp() ? 'image/webp' : 'image/jpeg'
  let smallest = null

  for (const dim of DIMS) {
    const canvas = draw(img, dim)
    for (const q of QUALITIES) {
      const url = canvas.toDataURL(type, q)
      if (url.length <= maxChars) return url
      if (!smallest || url.length < smallest.length) smallest = url
    }
  }
  return smallest
}
