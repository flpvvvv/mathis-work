"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Loader2,
  RotateCcw,
  ScanEye,
} from "lucide-react";
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
  detectPaperCorners,
  refineCornersOnImage,
} from "@/lib/image/detect-paper-corners";
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

const CORNER_LABELS = ["TL", "TR", "BR", "BL"];
const HANDLE_RADIUS = 14;
/** CSS-pixel hit radius — generous for finger taps */
const HIT_RADIUS_CSS = 40;
/** Pixels of pointer movement below which a touch is a tap (selection) not a drag */
const TAP_THRESHOLD = 4;
const NUDGE_STEP = 1;

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

function normalizedToNaturalPoints(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): Point[] {
  return points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));
}

async function detectCornersWithAi(
  file: File,
): Promise<Array<{ x: number; y: number }> | null> {
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch("/api/admin/perspective-detect", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    points?: Array<{ x: number; y: number }>;
    error?: string;
  };

  return data.points?.length === 4 ? data.points : null;
}

async function detectCorners(
  image: HTMLImageElement,
  file: File,
): Promise<{ points: Point[] | null; error: string | null }> {
  const local = detectPaperCorners(image);
  if (local) {
    return { points: local, error: null };
  }

  try {
    const aiPoints = await detectCornersWithAi(file);
    if (!aiPoints) {
      return {
        points: null,
        error: "Could not auto-detect corners. Adjust them manually.",
      };
    }

    const natural = normalizedToNaturalPoints(
      aiPoints,
      image.naturalWidth,
      image.naturalHeight,
    );
    const refined = refineCornersOnImage(image, natural);

    return {
      points: refined ?? natural,
      error: null,
    };
  } catch {
    return {
      points: null,
      error: "Could not reach AI detection. Adjust corners manually.",
    };
  }
}

export function PerspectiveCorrector({ file, onCancel, onApply }: Props) {
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // Load image and kick off AI detection
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

  // Auto-detect corners (local paper detection first, AI fallback)
  useEffect(() => {
    if (!image) return;
    const loadedImage = image;

    let disposed = false;
    async function runDetection() {
      setIsDetecting(true);
      setDetectError(null);
      try {
        const result = await detectCorners(loadedImage, file);
        if (disposed) return;

        if (result.points) {
          setPoints(result.points);
        } else if (result.error) {
          setDetectError(result.error);
        }
      } finally {
        if (!disposed) setIsDetecting(false);
      }
    }

    void runDetection();
    return () => {
      disposed = true;
    };
  }, [image, file]);

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
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const scaledPoints = points.map((point) => ({
      x: point.x * displaySize.scale,
      y: point.y * displaySize.scale,
    }));

    // Quadrilateral outline
    context.strokeStyle = "#ff6b6b";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    for (let i = 1; i < scaledPoints.length; i += 1) {
      context.lineTo(scaledPoints[i].x, scaledPoints[i].y);
    }
    context.closePath();
    context.stroke();

    // Corner handles + labels
    scaledPoints.forEach((point, index) => {
      const isActive =
        index === draggingIndex || index === selectedIndex;
      context.fillStyle = isActive ? "#ffe66d" : "#ff6b6b";
      context.beginPath();
      context.arc(point.x, point.y, HANDLE_RADIUS, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      context.stroke();

      // Corner label
      const label = CORNER_LABELS[index];
      const offset = HANDLE_RADIUS + 14;
      context.font = "bold 12px ui-monospace, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      const labelX = point.x + (index <= 1 ? offset : -offset);
      const labelY = point.y + (index <= 1 ? -offset : offset);
      // Background pill
      const metrics = context.measureText(label);
      const padX = 6;
      const padY = 3;
      context.fillStyle = "rgba(0,0,0,0.6)";
      context.fillRect(
        labelX - metrics.width / 2 - padX,
        labelY - 8 - padY,
        metrics.width + padX * 2,
        16 + padY * 2,
      );
      context.fillStyle = "#ffffff";
      context.fillText(label, labelX, labelY);
    });

    // Preview
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;

    const sourceForPreview = document.createElement("canvas");
    sourceForPreview.width = displaySize.width;
    sourceForPreview.height = displaySize.height;
    const previewSourceContext = sourceForPreview.getContext("2d");
    if (!previewSourceContext) return;
    previewSourceContext.drawImage(
      image,
      0,
      0,
      displaySize.width,
      displaySize.height,
    );

    drawPerspectiveToCanvas(sourceForPreview, scaledPoints, previewCanvas);
  }, [displaySize, draggingIndex, selectedIndex, image, points]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Keyboard nudge for selected corner
  useEffect(() => {
    if (selectedIndex === null || !points || !image) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      let dx = 0;
      let dy = 0;
      switch (event.key) {
        case "ArrowLeft":
          dx = -NUDGE_STEP;
          break;
        case "ArrowRight":
          dx = NUDGE_STEP;
          break;
        case "ArrowUp":
          dy = -NUDGE_STEP;
          break;
        case "ArrowDown":
          dy = NUDGE_STEP;
          break;
        case "Escape":
          setSelectedIndex(null);
          return;
        default:
          return;
      }

      event.preventDefault();
      if (!image) return;
      const idx = selectedIndex;
      const { naturalWidth, naturalHeight } = image;
      setPoints((current) => {
        if (!current || idx === null) return current;
        const next = [...current];
        const p = next[idx];
        next[idx] = {
          x: clamp(p.x + dx, 0, naturalWidth),
          y: clamp(p.y + dy, 0, naturalHeight),
        };
        return next;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, points, image]);

  function cssToCanvas(
    event: PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function updatePointFromPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (draggingIndex === null || !displaySize || !image || !points) {
      return;
    }

    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    const { x, y } = cssToCanvas(event, canvas);
    const cx = clamp(x, 0, canvas.width);
    const cy = clamp(y, 0, canvas.height);

    const naturalX = (cx / displaySize.width) * image.naturalWidth;
    const naturalY = (cy / displaySize.height) * image.naturalHeight;

    setPoints((current) => {
      if (!current) return current;
      const next = [...current];
      next[draggingIndex] = { x: naturalX, y: naturalY };
      return next;
    });
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!points || !displaySize) return;
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    const { x, y } = cssToCanvas(event, canvas);
    pointerStartRef.current = { x, y };

    const scaled = points.map((point) => ({
      x: point.x * displaySize.scale,
      y: point.y * displaySize.scale,
    }));

    const hitRadius = HIT_RADIUS_CSS * (canvas.width / canvas.getBoundingClientRect().width);
    const targetIndex = scaled.findIndex(
      (pt) => Math.hypot(pt.x - x, pt.y - y) <= hitRadius,
    );

    if (targetIndex !== -1) {
      setDraggingIndex(targetIndex);
      setSelectedIndex(null);
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      // Tapped on empty canvas area — deselect
      setSelectedIndex(null);
    }
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (draggingIndex === null) return;
    updatePointFromPointer(event);
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (draggingIndex !== null) {
      updatePointFromPointer(event);

      // Distinguish tap from drag
      const canvas = sourceCanvasRef.current;
      const start = pointerStartRef.current;
      if (canvas && start) {
        const { x, y } = cssToCanvas(event, canvas);
        const dist = Math.hypot(x - start.x, y - start.y);
        if (dist <= TAP_THRESHOLD) {
          setSelectedIndex(draggingIndex);
        }
      }
    }
    setDraggingIndex(null);
    pointerStartRef.current = null;
  }

  function nudgeCorner(index: number, dx: number, dy: number) {
    if (!image || !points) return;
    setPoints((current) => {
      if (!current) return current;
      const next = [...current];
      const p = next[index];
      next[index] = {
        x: clamp(p.x + dx, 0, image.naturalWidth),
        y: clamp(p.y + dy, 0, image.naturalHeight),
      };
      return next;
    });
  }

  async function applyCorrection() {
    if (!image || !points) return;

    setIsApplying(true);
    setError(null);
    try {
      const corrected = await correctPerspectiveToJpeg(image, points, 0.8);
      onApply(corrected);
    } catch {
      setError(
        "Could not process the image. Please try again or skip correction.",
      );
    } finally {
      setIsApplying(false);
    }
  }

  function resetPoints() {
    if (!image) return;
    setSelectedIndex(null);
    setPoints(defaultPoints(image.naturalWidth, image.naturalHeight));
  }

  async function retryDetection() {
    if (!image) return;
    setIsDetecting(true);
    setDetectError(null);
    try {
      const result = await detectCorners(image, file);
      if (result.points) {
        setPoints(result.points);
        setSelectedIndex(null);
      } else if (result.error) {
        setDetectError(result.error);
      }
    } finally {
      setIsDetecting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-none border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Perspective Correction</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          {selectedIndex !== null
            ? `Corner ${CORNER_LABELS[selectedIndex]} selected — use arrows to nudge or tap another corner.`
            : "Tap a corner to select it, or drag to move. Arrow keys nudge the selected corner."}
        </p>
      </div>

      {error ? (
        <p className="rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {detectError ? (
        <p className="rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {detectError}
        </p>
      ) : null}

      {isDetecting ? (
        <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Loader2 className="size-4 animate-spin" />
          Detecting paper corners…
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Source</p>
            {selectedIndex !== null && points && image ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-secondary)]">
                  Nudge {CORNER_LABELS[selectedIndex]}:
                </span>
                <button
                  type="button"
                  aria-label="Nudge up"
                  className="inline-flex size-7 items-center justify-center rounded-none border border-[var(--border)] hover:bg-[var(--accent)]"
                  onClick={() => nudgeCorner(selectedIndex, 0, -NUDGE_STEP)}
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Nudge down"
                  className="inline-flex size-7 items-center justify-center rounded-none border border-[var(--border)] hover:bg-[var(--accent)]"
                  onClick={() => nudgeCorner(selectedIndex, 0, NUDGE_STEP)}
                >
                  <ArrowDown className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Nudge left"
                  className="inline-flex size-7 items-center justify-center rounded-none border border-[var(--border)] hover:bg-[var(--accent)]"
                  onClick={() => nudgeCorner(selectedIndex, -NUDGE_STEP, 0)}
                >
                  <ArrowLeft className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Nudge right"
                  className="inline-flex size-7 items-center justify-center rounded-none border border-[var(--border)] hover:bg-[var(--accent)]"
                  onClick={() => nudgeCorner(selectedIndex, NUDGE_STEP, 0)}
                >
                  <ArrowRight className="size-3" />
                </button>
              </div>
            ) : null}
          </div>
          <canvas
            ref={sourceCanvasRef}
            className="w-full rounded-none border border-[var(--border)] bg-black/5 dark:bg-white/5 touch-none cursor-crosshair"
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
            className="w-full rounded-none border border-[var(--border)] bg-black/5 dark:bg-white/5"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDetecting}
          onClick={retryDetection}
        >
          {isDetecting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ScanEye className="mr-2 size-4" />
          )}
          Detect corners
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={resetPoints}>
          <RotateCcw className="mr-2 size-4" />
          Reset corners
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
        >
          Skip
        </Button>
        <Button
          disabled={isApplying}
          type="button"
          size="sm"
          onClick={applyCorrection}
        >
          {isApplying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Apply correction
        </Button>
      </div>
    </div>
  );
}
