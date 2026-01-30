/**
 * OptimizedImage Component
 * Lazy-loaded image with blur-up placeholder and error handling
 */

import { useState, useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  aspectRatio?: string // e.g., '16/9', '4/3', '1/1'
  blurhash?: string // Optional blurhash for placeholder
  sizes?: string // Responsive sizes attribute
  priority?: boolean // Skip lazy loading for above-the-fold images
  onLoad?: () => void
  onError?: () => void
}

export function OptimizedImage({
  src,
  alt,
  className,
  aspectRatio,
  blurhash,
  sizes,
  priority = false,
  onLoad,
  onError,
}: OptimizedImageProps) {
  // Validate src upfront - return null for empty/invalid src
  const isValidSrc = src && src.trim() !== ''

  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [hasError, setHasError] = useState(!isValidSrc)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return // Skip lazy loading for priority images

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [priority])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden bg-neutral-100', className)}
      style={{
        aspectRatio: aspectRatio || 'auto',
      }}
    >
      {/* Blur placeholder - shown while loading */}
      {!isLoaded && !hasError && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: blurhash
              ? `url(data:image/svg+xml;base64,${blurhash})`
              : 'linear-gradient(135deg, rgba(229, 231, 235, 0.8), rgba(209, 213, 219, 0.8))',
            backgroundSize: 'cover',
            filter: 'blur(10px)',
            transform: 'scale(1.1)', // Slightly larger to hide blur edges
          }}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
          <div className="text-center p-4">
            <svg
              className="mx-auto h-12 w-12 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-neutral-500">Failed to load image</p>
          </div>
        </div>
      )}

      {/* Actual image - only load when in view */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-500',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}

      {/* Loading spinner overlay */}
      {!isLoaded && !hasError && isInView && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"
            style={{ color: 'var(--premium-blue)' }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Avatar component - optimized for profile pictures
 */
interface AvatarProps {
  src?: string
  alt: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fallback?: string // Initials or icon
}

export function Avatar({ src, alt, size = 'md', className, fallback }: AvatarProps) {
  const [hasError, setHasError] = useState(false)

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  }

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold',
          'bg-gradient-to-br from-blue-400 to-indigo-600 text-white',
          sizeClasses[size],
          className
        )}
      >
        {fallback || alt.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={cn(
        'rounded-full object-cover',
        sizeClasses[size],
        className
      )}
      loading="lazy"
      decoding="async"
    />
  )
}

/**
 * Thumbnail component - optimized for article/content thumbnails
 */
interface ThumbnailProps {
  src?: string
  alt: string
  className?: string
  aspectRatio?: '16/9' | '4/3' | '1/1' | 'auto'
  priority?: boolean
}

export function Thumbnail({
  src,
  alt,
  className,
  aspectRatio = '16/9',
  priority = false,
}: ThumbnailProps) {
  if (!src) {
    // Default placeholder for missing thumbnails
    return (
      <div
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-200',
          className
        )}
        style={{ aspectRatio: aspectRatio === 'auto' ? 'auto' : aspectRatio }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="h-12 w-12 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={className}
      aspectRatio={aspectRatio === 'auto' ? undefined : aspectRatio}
      priority={priority}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  )
}
