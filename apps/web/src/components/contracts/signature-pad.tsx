'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, PenTool } from 'lucide-react';
import { Button } from '../ui/button';

export interface SignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

export function SignaturePad({
  onSignatureChange,
  disabled = false,
  className = '',
  testId = 'signature-pad',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  // Setup canvas size with DPI awareness
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const height = 200;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // Set display size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Set buffer size
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0F172A';
    }
  }, []);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => {
      // If user hasn't drawn, safe to resize
      if (!hasDrawn) {
        setupCanvas();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas, hasDrawn]);

  // Coordinates helper
  const getCoordinates = (
    e: React.PointerEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (
    e: React.PointerEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>,
  ) => {
    if (disabled) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (
    e: React.PointerEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing || disabled) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    if (!hasDrawn) {
      setHasDrawn(true);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || disabled) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const newStrokeCount = strokeCount + 1;
    setStrokeCount(newStrokeCount);

    // Verify non-blank pixel check or stroke count
    if (newStrokeCount > 0) {
      setHasDrawn(true);
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    setHasDrawn(false);
    setStrokeCount(0);
    onSignatureChange(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-xl border-2 border-dashed border-surface-borderStrong bg-surface-sunken p-2 sm:p-3 transition-colors focus-within:border-accent ${className}`}
      data-testid={testId}
      dir="rtl"
    >
      <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground border-b border-surface-border mb-2">
        <div className="inline-flex items-center gap-1.5 font-medium text-ink-primary dark:text-dark-ink-primary">
          <PenTool className="w-3.5 h-3.5 text-accent" />
          <span>ارسم توقيعك هنا (باستخدام اللمس أو الفأرة أو القلم)</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSignature}
          disabled={disabled || !hasDrawn}
          className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
          data-testid="clear-signature-btn"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>مسح التوقيع</span>
        </Button>
      </div>

      <div className="relative w-full bg-surface-base rounded-lg border border-surface-border shadow-inner overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="مساحة التوقيع الإلكتروني"
          style={{ touchAction: 'none' }}
          className="w-full block select-none"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          data-testid="signature-canvas"
        />

        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-ink-muted dark:text-dark-ink-muted text-xs">
            <span className="opacity-80">التوقيع مطلوب للاعتماد</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted">
        <span>توقيع إلكتروني ملزم ومشفّر بنظام الهيئة العامة للعقار</span>
        <span className={hasDrawn ? 'text-accent font-semibold' : 'text-ink-muted dark:text-dark-ink-muted'}>
          {hasDrawn ? '✓ تم رسم التوقيع' : 'في انتظار التوقيع'}
        </span>
      </div>
    </div>
  );
}

