"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import { 
  X, RotateCw, FlipHorizontal, FlipVertical, 
  Sun, Contrast, Sliders, Crop, 
  Undo, Redo, Save, ZoomIn, ZoomOut,
  Brush, Eraser, RotateCcw, Maximize2, Minimize2,
  AlertCircle,
  Droplet
} from "lucide-react";
import * as Slider from "@radix-ui/react-slider";

interface ImageEditorProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onSave: (editedFile: File) => void;
}

type Tab = "crop" | "adjust" | "draw";

const ASPECT_RATIOS = [
  { label: "Свободная", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
  { label: "9:16", value: 9 / 16 },
];

export default function ImageEditor({ isOpen, imageUrl, onClose, onSave }: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [activeTab, setActiveTab] = useState<Tab>("adjust");
  const [drawColor, setDrawColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(5);
  const [drawMode, setDrawMode] = useState<"brush" | "eraser">("brush");
  const [selectedAspect, setSelectedAspect] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Загрузка изображения
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    
    setIsLoading(true);
    setError(null);
    setLoadedImage(null);
    
    // Создаем новый объект Image
    const img = new Image();
    
    // Обработчик успешной загрузки
    img.onload = () => {
      setLoadedImage(img);
      setIsLoading(false);
      
      // Инициализируем canvas после загрузки
      setTimeout(() => {
        initializeCanvas(img);
      }, 100);
    };
    
    // Обработчик ошибки загрузки
    img.onerror = (err) => {
      console.error("Failed to load image:", err);
      setError("Не удалось загрузить изображение. Проверьте формат файла.");
      setIsLoading(false);
    };
    
    // Загружаем изображение
    img.src = imageUrl;
    
    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isOpen, imageUrl]);

  // Инициализация canvas
  const initializeCanvas = useCallback((img: HTMLImageElement) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Устанавливаем размеры canvas с сохранением пропорций
    const maxSize = 800;
    let width = img.width;
    let height = img.height;
    
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else {
        width = (width / height) * maxSize;
        height = maxSize;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Рисуем изображение
    ctx.drawImage(img, 0, 0, width, height);
    
    // Сохраняем оригинал для истории
    const originalData = canvas.toDataURL();
    sessionStorage.setItem(`editor_original_${Date.now()}`, originalData);
  }, []);

  // Применение фильтров
  const applyFilters = useCallback(() => {
    if (!canvasRef.current || !loadedImage) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Сохраняем текущее состояние для undo
    const currentState = canvas.toDataURL();
    sessionStorage.setItem(`editor_undo_${Date.now()}`, currentState);
    
    // Применяем фильтры
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    
    ctx.save();
    
    // Применяем трансформации
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    // Очищаем и перерисовываем
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
    
    ctx.restore();
  }, [brightness, contrast, saturation, rotation, flipX, loadedImage]);

  // Автоматическое применение фильтров при изменении
  useEffect(() => {
    if (loadedImage && activeTab === "adjust") {
      applyFilters();
    }
  }, [brightness, contrast, saturation, rotation, flipX, loadedImage, activeTab, applyFilters]);

  // Применение обрезки
  const applyCrop = useCallback(() => {
    if (!croppedAreaPixels || !canvasRef.current || !loadedImage) return;
    
    const canvas = canvasRef.current;
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = croppedAreaPixels.width;
    croppedCanvas.height = croppedAreaPixels.height;
    const croppedCtx = croppedCanvas.getContext("2d");
    
    if (croppedCtx) {
      // Создаем временное изображение из canvas
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
        
        croppedCtx.drawImage(
          tempCanvas,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );
        
        // Обновляем основной canvas
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;
        const finalCtx = canvas.getContext("2d");
        if (finalCtx) {
          finalCtx.drawImage(croppedCanvas, 0, 0);
        }
        
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      }
    }
  }, [croppedAreaPixels, loadedImage]);

  // Рисование на canvas
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTab !== "draw") return;
    e.preventDefault();
    isDrawingRef.current = true;
    const point = getCanvasCoordinates(e);
    lastPointRef.current = point;
  };

  const draw = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (!canvasRef.current || !isDrawingRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = drawMode === "eraser" ? "#FFFFFF" : drawColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (drawMode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }
    
    ctx.stroke();
  }, [drawColor, brushSize, drawMode]);

  const continueDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const point = getCanvasCoordinates(e);
    if (lastPointRef.current) {
      draw(lastPointRef.current, point);
    }
    lastPointRef.current = point;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: Math.max(0, Math.min(canvas.width, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(canvas.height, (clientY - rect.top) * scaleY)),
    };
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    
    // Перезагружаем оригинал
    if (loadedImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.filter = "none";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveImage = async () => {
    if (!canvasRef.current) return;
    
    setIsLoading(true);
    
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `edited-${Date.now()}.png`, { type: "image/png" });
        onSave(file);
        onClose();
      }
      setIsLoading(false);
    }, "image/png");
  };

  const clearCanvas = () => {
    if (!canvasRef.current || !loadedImage) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
    }
  };

  const sliderClass = "relative flex items-center select-none touch-none w-full h-5";
  const trackClass = "bg-white/20 relative grow rounded-full h-1";
  const rangeClass = "absolute bg-violet-500 h-full rounded-full";
  const thumbClass = "block w-4 h-4 bg-violet-500 rounded-full hover:bg-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500";

  if (!isOpen) return null;

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center"
        onClick={onClose}
      >
        <div className="text-center p-8 bg-red-500/10 rounded-2xl border border-red-500/30 max-w-md">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 z-[500] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={24} className="text-white" />
          </button>
          <h2 className="text-xl font-bold text-white">Редактор изображений</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={saveImage} 
            disabled={isLoading}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-xl text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save size={18} />
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-white/10 bg-black/30 shrink-0">
        <button
          onClick={() => setActiveTab("adjust")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
            activeTab === "adjust"
              ? "bg-violet-500 text-white"
              : "text-white/60 hover:bg-white/10"
          }`}
        >
          <Sliders size={18} />
          <span className="text-sm hidden sm:inline">Настройки</span>
        </button>
        <button
          onClick={() => setActiveTab("crop")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
            activeTab === "crop"
              ? "bg-violet-500 text-white"
              : "text-white/60 hover:bg-white/10"
          }`}
        >
          <Crop size={18} />
          <span className="text-sm hidden sm:inline">Обрезка</span>
        </button>
        <button
          onClick={() => setActiveTab("draw")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
            activeTab === "draw"
              ? "bg-violet-500 text-white"
              : "text-white/60 hover:bg-white/10"
          }`}
        >
          <Brush size={18} />
          <span className="text-sm hidden sm:inline">Рисование</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black/20 relative">
          {isLoading ? (
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60">Загрузка изображения...</p>
            </div>
          ) : activeTab === "crop" && loadedImage ? (
            <div className="relative w-full h-full">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={selectedAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                classes={{
                  containerClassName: "rounded-lg",
                  mediaClassName: "rounded-lg",
                }}
              />
              
              {/* Controls for cropping */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/80 backdrop-blur-sm rounded-xl p-2">
                <button
                  onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Уменьшить"
                >
                  <Minimize2 size={18} className="text-white" />
                </button>
                <span className="px-2 py-1 text-white text-sm min-w-[50px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Увеличить"
                >
                  <Maximize2 size={18} className="text-white" />
                </button>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button
                  onClick={applyCrop}
                  className="px-3 py-1 bg-violet-500 hover:bg-violet-600 rounded-lg text-white text-sm font-medium"
                >
                  Применить
                </button>
              </div>
              
              {/* Aspect ratios */}
              <div className="absolute top-4 right-4 flex gap-1 bg-black/80 backdrop-blur-sm rounded-xl p-1 flex-wrap max-w-[200px]">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.label}
                    onClick={() => setSelectedAspect(ratio.value)}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors whitespace-nowrap ${
                      selectedAspect === ratio.value
                        ? "bg-violet-500 text-white"
                        : "text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={continueDrawing}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={continueDrawing}
              onTouchEnd={stopDrawing}
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              style={{ 
                cursor: activeTab === "draw" ? "crosshair" : "default",
              }}
            />
          )}
        </div>

        {/* Controls Panel */}
        <div className="w-80 border-l border-white/10 p-4 overflow-y-auto bg-black/30 shrink-0 hidden md:block">
          {activeTab === "adjust" && loadedImage && (
            <div className="space-y-6">
              <div>
                <label className="text-sm text-white/80 mb-2 flex items-center gap-2">
                  <Sun size={16} /> Яркость ({brightness}%)
                </label>
                <Slider.Root
                  className={sliderClass}
                  value={[brightness]}
                  onValueChange={(val) => setBrightness(val[0])}
                  min={0}
                  max={200}
                  step={1}
                >
                  <Slider.Track className={trackClass}>
                    <Slider.Range className={rangeClass} />
                  </Slider.Track>
                  <Slider.Thumb className={thumbClass} />
                </Slider.Root>
              </div>

              <div>
                <label className="text-sm text-white/80 mb-2 flex items-center gap-2">
                  <Contrast size={16} /> Контраст ({contrast}%)
                </label>
                <Slider.Root
                  className={sliderClass}
                  value={[contrast]}
                  onValueChange={(val) => setContrast(val[0])}
                  min={0}
                  max={200}
                  step={1}
                >
                  <Slider.Track className={trackClass}>
                    <Slider.Range className={rangeClass} />
                  </Slider.Track>
                  <Slider.Thumb className={thumbClass} />
                </Slider.Root>
              </div>

              <div>
                <label className="text-sm text-white/80 mb-2 flex items-center gap-2">
                  <Droplet size={16} /> Насыщенность ({saturation}%)
                </label>
                <Slider.Root
                  className={sliderClass}
                  value={[saturation]}
                  onValueChange={(val) => setSaturation(val[0])}
                  min={0}
                  max={200}
                  step={1}
                >
                  <Slider.Track className={trackClass}>
                    <Slider.Range className={rangeClass} />
                  </Slider.Track>
                  <Slider.Thumb className={thumbClass} />
                </Slider.Root>
              </div>

              <div className="pt-4 border-t border-white/10">
                <label className="text-sm text-white/80 mb-2 flex items-center gap-2">
                  <RotateCw size={16} /> Трансформация
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRotation((rotation - 90) % 360)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={14} /> -90°
                  </button>
                  <button
                    onClick={() => setRotation((rotation + 90) % 360)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCw size={14} /> +90°
                  </button>
                  <button
                    onClick={() => setFlipX(!flipX)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm flex items-center justify-center gap-2"
                  >
                    <FlipHorizontal size={14} /> По горизонтали
                  </button>
                  <button
                    onClick={() => setFlipY(!flipY)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm flex items-center justify-center gap-2"
                  >
                    <FlipVertical size={14} /> По вертикали
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={resetFilters}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/80 text-sm"
                >
                  Сбросить всё
                </button>
              </div>
            </div>
          )}

          {activeTab === "draw" && loadedImage && (
            <div className="space-y-6">
              <div>
                <label className="text-sm text-white/80 mb-2 block">Инструмент</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDrawMode("brush")}
                    className={`flex-1 px-3 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                      drawMode === "brush" ? "bg-violet-500" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <Brush size={16} /> Кисть
                  </button>
                  <button
                    onClick={() => setDrawMode("eraser")}
                    className={`flex-1 px-3 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                      drawMode === "eraser" ? "bg-violet-500" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <Eraser size={16} /> Ластик
                  </button>
                </div>
              </div>

              {drawMode === "brush" && (
                <div>
                  <label className="text-sm text-white/80 mb-2 block">Цвет</label>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"].map((color) => (
                      <button
                        key={color}
                        onClick={() => setDrawColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          drawColor === color ? "border-white scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                    className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-white/80 mb-2 block">Размер кисти: {brushSize}px</label>
                <Slider.Root
                  className={sliderClass}
                  value={[brushSize]}
                  onValueChange={(val) => setBrushSize(val[0])}
                  min={1}
                  max={50}
                  step={1}
                >
                  <Slider.Track className={trackClass}>
                    <Slider.Range className={rangeClass} />
                  </Slider.Track>
                  <Slider.Thumb className={thumbClass} />
                </Slider.Root>
              </div>

              <button
                onClick={clearCanvas}
                className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-400 text-sm transition-colors"
              >
                Очистить всё
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile controls */}
      <div className="md:hidden p-3 border-t border-white/10 bg-black/30 shrink-0 overflow-x-auto">
        {activeTab === "adjust" && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-white/60">Яркость</label>
              <input
                type="range"
                min="0"
                max="200"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-white/60">Контраст</label>
              <input
                type="range"
                min="0"
                max="200"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
        {activeTab === "draw" && (
          <div className="flex gap-2">
            <button
              onClick={() => setDrawMode("brush")}
              className={`px-3 py-1 rounded-lg text-xs ${
                drawMode === "brush" ? "bg-violet-500" : "bg-white/10"
              }`}
            >
              Кисть
            </button>
            <button
              onClick={() => setDrawMode("eraser")}
              className={`px-3 py-1 rounded-lg text-xs ${
                drawMode === "eraser" ? "bg-violet-500" : "bg-white/10"
              }`}
            >
              Ластик
            </button>
            <input
              type="color"
              value={drawColor}
              onChange={(e) => setDrawColor(e.target.value)}
              className="w-8 h-8 rounded"
            />
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-2 border-t border-white/10 text-center text-xs text-white/40 bg-black/30 shrink-0 hidden sm:block">
        {activeTab === "draw" && "🎨 Нажмите и перетаскивайте для рисования • Настройте размер и цвет кисти"}
        {activeTab === "crop" && "✂️ Перемещайте и изменяйте размер области обрезки • Выберите пропорцию"}
        {activeTab === "adjust" && "⚙️ Настройте параметры для изменения изображения"}
      </div>
    </motion.div>
  );
}