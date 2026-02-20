"use client";

import { Loader2, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import type { JpegResult } from "@/lib/image/jpeg";
import { loadImageFromBlob } from "@/lib/image/jpeg";
import {
  correctPerspectiveToJpeg,
  drawPerspectiveToCanvas,
  type Point,
} from "@/lib/image/perspective";

type Props = {
  file: File;
  onCancel: () => void;
  onApply: (result: JpegResult) => void;
};

function defaultPoints(width: number, height: number): Point[] {
  const marginX = width * 0.08;
  const marginY = height * 0.08;
  return [
    { x: marginX, y: marginY },
    { x: width - marginX, y: marginY },
    { x: width - marginX, y: height - marginY },
    { x: marginX, y: height - marginY },
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PerspectiveCorrector({ file, onCancel, onApply }: Props) {
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const loaded = await loadImageFromBlob(file);
        if (disposed) return;
        setImage(loaded);
        setPoints(defaultPoints(loaded.naturalWidth, loaded.naturalHeight));
      } catch {
        if (disposed) return;
        setError("Could not process the image. Please try again or skip correction.");
      }
    }

    void load();
    return () => {
      disposed = true;
    };
  }, [file]);

  const displaySize = useMemo(() => {
    if (!image) return null;
    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    return {
      width: Math.round(image.naturalWidth * scale),
      height: Math.round(image.naturalHeight * scale),
      scale,
    };
  }, [image]);

  const draw = useCallback(() => {
    if (!image || !points || !displaySize) {
      return;
    }

    const canvas = sourceCanvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const scaledPoints = points.map((point) => ({
      x: point.x * displaySize.scale,
      y: point.y * displaySize.scale,
    }));

    context.strokeStyle = "#ff6b6b";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    for (let i = 1; i < scaledPoints.length; i += 1) {
      context.lineTo(scaledPoints[i].x, scaledPoints[i].y);
    }
    context.closePath();
    context.stroke();

    scaledPoints.forEach((point, index) => {
      context.fillStyle = index === draggingIndex ? "#ffe66d" : "#ff6b6b";
      context.beginPath();
      context.arc(point.x, point.y, 8, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      context.stroke();
    });

    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) {
      return;
    }

    const sourceForPreview = document.createElement("canvas");
    sourceForPreview.width = displaySize.width;
    sourceForPreview.height = displaySize.height;
    const previewSourceContext = sourceForPreview.getContext("2d");
    if (!previewSourceContext) {
      return;
    }
    previewSourceContext.drawImage(image, 0, 0, displaySize.width, displaySize.height);

    drawPerspectiveToCanvas(
      sourceForPreview,
      scaledPoints,
      previewCanvas,
    );
  }, [displaySize, draggingIndex, image, points]);

  useEffect(() => {
    draw();
  }, [draw]);

  function updatePointFromPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (draggingIndex === null || !displaySize || !image || !points) {
      return;
    }

    const canvas = sourceCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);

    const naturalX = (x / displaySize.width) * image.naturalWidth;
    const naturalY = (y / displaySize.height) * image.naturalHeight;

    setPoints((current) => {
      if (!current) return current;
      const next = [...current];
      next[draggingIndex] = { x: naturalX, y: naturalY };
      return next;
    });
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!points || !displaySize) {
      return;
    }
    const canvas = sourceCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const scaled = points.map((point) => ({
      x: point.x * displaySize.scale,
      y: point.y * displaySize.scale,
    }));

    const targetIndex = scaled.findIndex(
      (point) => Math.hypot(point.x - x, point.y - y) <= 20,
    );

    if (targetIndex !== -1) {
      setDraggingIndex(targetIndex);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (draggingIndex === null) {
      return;
    }
    updatePointFromPointer(event);
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (draggingIndex !== null) {
      updatePointFromPointer(event);
    }
    setDraggingIndex(null);
  }

  async function applyCorrection() {
    if (!image || !points) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      const corrected = await correctPerspectiveToJpeg(image, points, 0.8);
      onApply(corrected);
    } catch {
      setError("Could not process the image. Please try again or skip correction.");
    } finally {
      setIsApplying(false);
    }
  }

  function resetPoints() {
    if (!image) return;
    setPoints(defaultPoints(image.naturalWidth, image.naturalHeight));
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Perspective Correction</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Drag the four corner handles to match the painting edges.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Source</p>
          <canvas
            ref={sourceCanvasRef}
            className="w-full rounded-md border border-[var(--border)] bg-black/5 dark:bg-white/5 touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview</p>
          <canvas
            ref={previewCanvasRef}
            className="w-full rounded-md border border-[var(--border)] bg-black/5 dark:bg-white/5"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={resetPoints}>
          <RotateCcw className="mr-2 size-4" />
          Reset corners
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Skip
        </Button>
        <Button disabled={isApplying} type="button" onClick={applyCorrection}>
          {isApplying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Apply correction
        </Button>
      </div>
    </div>
  );
}
