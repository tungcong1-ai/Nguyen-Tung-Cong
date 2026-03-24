import React, { useRef, useState, useEffect } from 'react';
import { Eraser, RotateCcw, Check, MousePointer2 } from 'lucide-react';

interface DrawingCanvasProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-none"
          />
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={lineWidth} 
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            className="w-24 accent-indigo-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={clearCanvas}
            className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
            title="Xóa tất cả"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setColor('#ffffff')}
            className={`p-2 rounded-lg transition-colors ${color === '#ffffff' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-neutral-100 text-neutral-600'}`}
            title="Tẩy"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative aspect-video bg-white border border-neutral-200 rounded-lg overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair"
        />
      </div>

      <div className="flex gap-2 mt-2">
        <button 
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-neutral-200 text-neutral-600 font-medium hover:bg-neutral-50 transition-colors"
        >
          Hủy
        </button>
        <button 
          onClick={handleSave}
          className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" /> Xong
        </button>
      </div>
    </div>
  );
};
