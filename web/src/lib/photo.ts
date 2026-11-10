const MAX_EDGE = 2000
const QUALITY = 0.85

export const fitWithin = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    height: Math.round(height * scale),
    width: Math.round(width * scale),
  }
}

const drawToJpeg = (
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob> => {
  const size = fitWithin(width, height, MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  canvas.getContext('2d')?.drawImage(source, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('no photo'))),
      'image/jpeg',
      QUALITY,
    )
  })
}

export const frameToJpeg = (video: HTMLVideoElement) =>
  drawToJpeg(video, video.videoWidth, video.videoHeight)

export const fileToJpeg = async (file: File): Promise<Blob> => {
  if (file.type === 'image/jpeg') return file
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })
  try {
    return await drawToJpeg(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}
