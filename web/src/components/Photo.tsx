import { useLayoutEffect, useRef, useState } from 'react'
import styles from './Photo.module.css'

export interface PhotoProps {
  alt: string
  className?: string
  lazy?: boolean
  src: string
}

type Settled = { src: string; state: 'failed' | 'loaded' }

export const Photo = ({ alt, className, lazy = false, src }: PhotoProps) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const [settled, setSettled] = useState<Settled | null>(null)
  const state = settled?.src === src ? settled.state : 'loading'
  const failed = state === 'failed'

  useLayoutEffect(() => {
    const image = imageRef.current
    if (image?.complete && image.naturalWidth > 0) {
      setSettled({ src, state: 'loaded' })
    }
  }, [src])

  const handleLoad = () => {
    setSettled({ src, state: 'loaded' })
  }

  const handleError = () => {
    setSettled({ src, state: 'failed' })
  }

  return (
    <span
      aria-label={failed && alt ? alt : undefined}
      className={className ? `${styles.frame} ${className}` : styles.frame}
      data-state={state}
      role={failed && alt ? 'img' : undefined}
    >
      {!failed && (
        <img
          alt={alt}
          className={styles.image}
          loading={lazy ? 'lazy' : undefined}
          onError={handleError}
          onLoad={handleLoad}
          ref={imageRef}
          src={src}
        />
      )}
    </span>
  )
}
