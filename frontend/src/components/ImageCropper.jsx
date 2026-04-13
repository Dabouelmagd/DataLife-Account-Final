import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './ui/button';
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

const getCroppedImg = (imageSrc, pixelCrop) => {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, pixelCrop.width, pixelCrop.height
      );
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    };
    image.src = imageSrc;
  });
};

const ImageCropper = ({ imageSrc, onCropComplete, onCancel, language }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const isRTL = language === 'ar';

  const onCropChange = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
    onCropComplete(blob);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" data-testid="image-cropper-modal">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-800">
            {isRTL ? 'قص الصورة' : 'Crop Image'}
          </h3>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="relative h-80 bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropChange}
          />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-gray-400" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#28376B]"
            />
            <ZoomIn className="h-4 w-4 text-gray-400" />
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title={isRTL ? 'تدوير' : 'Rotate'}
            >
              <RotateCw className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-[#28376B] hover:bg-[#1e2a52] text-white">
              <Check className="h-4 w-4 mr-1" />
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
