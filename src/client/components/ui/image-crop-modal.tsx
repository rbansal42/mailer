import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog'
import { Button } from './button'

export interface CropCoordinates {
  x: number
  y: number
  width: number
  height: number
}

interface ImageCropModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  initialCrop?: CropCoordinates
  onCropComplete: (crop: CropCoordinates) => void
}

export function ImageCropModal({
  open,
  onOpenChange,
  imageUrl,
  initialCrop,
  onCropComplete,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  // Convert initial crop (natural coordinates) to display coordinates when image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const { naturalWidth, naturalHeight, width, height } = img

    if (initialCrop && initialCrop.width > 0 && initialCrop.height > 0) {
      // Convert from natural (pixel) coordinates to percentage
      const scaleX = width / naturalWidth
      const scaleY = height / naturalHeight

      const displayCrop: Crop = {
        unit: 'px',
        x: initialCrop.x * scaleX,
        y: initialCrop.y * scaleY,
        width: initialCrop.width * scaleX,
        height: initialCrop.height * scaleY,
      }
      setCrop(displayCrop)
      setCompletedCrop({
        unit: 'px',
        x: displayCrop.x,
        y: displayCrop.y,
        width: displayCrop.width,
        height: displayCrop.height,
      })
    } else {
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
  }, [initialCrop])

  // Reset crop state when modal opens
  useEffect(() => {
    if (!open) {
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
  }, [open])

  const handleApplyCrop = useCallback(() => {
    if (!imgRef.current) return

    const img = imgRef.current
    const { naturalWidth, naturalHeight, width, height } = img

    if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
      // Convert from display coordinates to natural (pixel) coordinates
      const scaleX = naturalWidth / width
      const scaleY = naturalHeight / height

      onCropComplete({
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      })
    } else {
      // No crop selected, return full image dimensions
      onCropComplete({
        x: 0,
        y: 0,
        width: naturalWidth,
        height: naturalHeight,
      })
    }
    onOpenChange(false)
  }, [completedCrop, onCropComplete, onOpenChange])

  const handleClearCrop = useCallback(() => {
    onCropComplete({ x: 0, y: 0, width: 0, height: 0 })
    onOpenChange(false)
  }, [onCropComplete, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center overflow-auto max-h-[60vh]">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              onLoad={onImageLoad}
              style={{ maxWidth: '100%', maxHeight: '60vh' }}
            />
          </ReactCrop>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClearCrop}>
            Clear Crop
          </Button>
          <Button onClick={handleApplyCrop}>
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
