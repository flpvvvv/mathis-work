"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Loader2,
  Pipette,
  RotateCcw,
  RotateCw,
  ScanEye,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { detectPaperCorners } from "@/lib/image/detect-paper-corners";
import { canvasToJpeg, loadImageFromBlob, type JpegResult } from "@/lib/image/jpeg";
import {
  drawPerspectiveToCanvas,
  scalePoints,
  type Point,
} from "@/lib/image/perspective";
import { orderCorners } from "@/lib/image/quad";
import {
  createRotatedSource,
  normalizeRotation,
  rotatePoint,
  rotatePoints,
  rotatedSize,
  type Rotation,
} from "@/lib/image/rotate";
import {
  applyWhiteBalance,
  applyWhiteBalanceToPixels,
  gainsFromSample,
  sampleWhiteRegion,
  type Rgb,
} from "@/lib/image/white-balance";

type Props = {
  file: File;
  onApply: (result: JpegResult) => void;
  /** Keep the original photo, unmodified. */
  onUseAsIs: () => void;
  /** Close without deciding; the photo stays unprocessed. */
  onClose: () => void;
};

type WhiteBalanceState = {
  /** Median colour of the picked patch, sRGB 0–255. */
  sample: Rgb;
  /** Where it was picked, in the rotated natural frame — used for the marker. */
  point: Point;
  strength: number;
  brightness: number;
};

const CORNER_LABELS = ["TL", "TR", "BR", "BL"];
/** Handle size in CSS pixels — kept constant on screen whatever the image size. */
const HANDLE_RADIUS_CSS = 12;
/** CSS-pixel hit radius — generous for finger taps. */
const HIT_RADIUS_CSS = 40;
/** Pixels of pointer movement below which a touch is a tap (selection) not a drag. */
const TAP_THRESHOLD = 4;
const NUDGE_STEP = 1;
const MAX_DISPLAY_DIM = 900;
const WHITE_SAMPLE_RADIUS_RATIO = 0.02;
const WHITE_STRENGTH_STEP = 0.05;
const DETECT_FAILURE =
  "Could not find the paper automatically — drag the four corners onto its edges.";
const PROCESS_FAILURE = "Could not process the image. Please try again.";

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

function previewKey(points: Point[], rotation: Rotation) {
  return `${rotation}|${points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(";")}`;
}

/**
 * Photo adjuster for a not-yet-uploaded image: quarter-turn rotation,
 * perspective rectification, and white balance from a picked paper sample.
 *
 * Rendered as a full-screen modal: on phones the previous inline panel opened
 * below the fold, so tapping "Modify" looked like nothing happened.
 */
export function ImageModifier({ file, onApply, onUseAsIs, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerStartRef = useRef<Point | null>(null);
  const displayScaleRef = useRef(1);
  const previewBaseRef = useRef<{ key: string; data: ImageData } | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [whiteBalance, setWhiteBalance] = useState<WhiteBalanceState | null>(
    null,
  );
  const [isPickingWhite, setIsPickingWhite] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  const frameSize = useMemo(
    () =>
      image
        ? rotatedSize(image.naturalWidth, image.naturalHeight, rotation)
        : null,
    [image, rotation],
  );

  const gains = useMemo(
    () =>
      whiteBalance
        ? gainsFromSample(whiteBalance.sample, {
            strength: whiteBalance.strength,
            brightness: whiteBalance.brightness,
          })
        : null,
    [whiteBalance],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  // Esc fires `cancel`; route it through the controlled close instead.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  // Load the image and look for the paper corners right away.
  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const loaded = await loadImageFromBlob(file);
        if (disposed) return;
        setImage(loaded);

        const detected = detectPaperCorners(loaded);
        if (disposed) return;
        if (detected) {
          setPoints(detected);
        } else {
          setPoints(defaultPoints(loaded.naturalWidth, loaded.naturalHeight));
          setDetectError(DETECT_FAILURE);
        }
      } catch {
        if (disposed) return;
        setError("Could not read the image. Please try another file.");
      }
    }

    void load();
    return () => {
      disposed = true;
    };
  }, [file]);

  // On a phone the pick target is off-screen once the controls are reached.
  useEffect(() => {
    if (!isPickingWhite) return;
    sourceCanvasRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [isPickingWhite]);

  const drawSource = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || !image || !points) return;

    const { canvas: source, scale } = createRotatedSource(
      image,
      rotation,
      MAX_DISPLAY_DIM,
    );
    displayScaleRef.current = scale;
    canvas.width = source.width;
    canvas.height = source.height;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(source, 0, 0);

    // Handles and labels are drawn in canvas pixels, so scale them by how much
    // the canvas is shrunk on screen to keep a constant on-screen size.
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = rect.width > 0 ? canvas.width / rect.width : 1;
    const handleRadius = HANDLE_RADIUS_CSS * pixelRatio;
    const scaledPoints = scalePoints(points, scale);

    context.strokeStyle = "#ff6b6b";
    context.lineWidth = 2 * pixelRatio;
    context.beginPath();
    context.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    for (let index = 1; index < scaledPoints.length; index += 1) {
      context.lineTo(scaledPoints[index].x, scaledPoints[index].y);
    }
    context.closePath();
    context.stroke();

    scaledPoints.forEach((point, index) => {
      const isActive = index === draggingIndex || index === selectedIndex;
      context.fillStyle = isActive ? "#ffe66d" : "#ff6b6b";
      context.beginPath();
      context.arc(point.x, point.y, handleRadius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2 * pixelRatio;
      context.stroke();

      const label = CORNER_LABELS[index];
      const offset = handleRadius + 12 * pixelRatio;
      context.font = `bold ${Math.round(12 * pixelRatio)}px ui-monospace, monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const labelX = point.x + (index <= 1 ? offset : -offset);
      const labelY = point.y + (index <= 1 ? -offset : offset);
      const metrics = context.measureText(label);
      const padX = 6 * pixelRatio;
      const padY = 3 * pixelRatio;
      context.fillStyle = "rgba(0,0,0,0.6)";
      context.fillRect(
        labelX - metrics.width / 2 - padX,
        labelY - 8 * pixelRatio - padY,
        metrics.width + padX * 2,
        16 * pixelRatio + padY * 2,
      );
      context.fillStyle = "#ffffff";
      context.fillText(label, labelX, labelY);
    });

    if (whiteBalance) {
      const marker = scalePoints([whiteBalance.point], scale)[0];
      const markerRadius = Math.max(
        handleRadius * 0.9,
        Math.min(canvas.width, canvas.height) * WHITE_SAMPLE_RADIUS_RATIO,
      );
      context.save();
      context.strokeStyle = "#4ecdc4";
      context.lineWidth = 2.5 * pixelRatio;
      context.setLineDash([5 * pixelRatio, 4 * pixelRatio]);
      context.beginPath();
      context.arc(marker.x, marker.y, markerRadius, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(marker.x - markerRadius * 1.6, marker.y);
      context.lineTo(marker.x + markerRadius * 1.6, marker.y);
      context.moveTo(marker.x, marker.y - markerRadius * 1.6);
      context.lineTo(marker.x, marker.y + markerRadius * 1.6);
      context.stroke();
      context.restore();
    }
  }, [draggingIndex, image, points, rotation, selectedIndex, whiteBalance]);

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !image || !points) return;

    // Warping is the expensive step, so cache the rectified pixels and only
    // re-run the white balance pass while its sliders are being dragged.
    const key = previewKey(points, rotation);
    if (!previewBaseRef.current || previewBaseRef.current.key !== key) {
      const { canvas: source, scale } = createRotatedSource(
        image,
        rotation,
        MAX_DISPLAY_DIM,
      );
      const rectified = document.createElement("canvas");
      drawPerspectiveToCanvas(source, scalePoints(points, scale), rectified);

      const context = rectified.getContext("2d");
      if (!context) return;
      previewBaseRef.current = {
        key,
        data: context.getImageData(0, 0, rectified.width, rectified.height),
      };
    }

    const base = previewBaseRef.current;
    if (!base) return;

    const output = new ImageData(
      new Uint8ClampedArray(base.data.data),
      base.data.width,
      base.data.height,
    );
    if (gains) {
      applyWhiteBalanceToPixels(output.data, gains);
    }

    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.putImageData(output, 0, 0);
  }, [gains, image, points, rotation]);

  useEffect(() => {
    drawSource();
  }, [drawSource]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // Redraw when the canvas box changes (dialog opening, device rotation) so the
  // handles keep their on-screen size. The canvas size does not depend on the
  // box, so this cannot feed back into itself.
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => drawSource());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawSource]);

  const nudgeCorner = useCallback(
    (index: number, dx: number, dy: number) => {
      if (!frameSize) return;
      setPoints((current) => {
        if (!current) return current;
        const next = [...current];
        const point = next[index];
        next[index] = {
          x: clamp(point.x + dx, 0, frameSize.width),
          y: clamp(point.y + dy, 0, frameSize.height),
        };
        return next;
      });
    },
    [frameSize],
  );

  // Keyboard nudge for the selected corner.
  useEffect(() => {
    if (selectedIndex === null || !frameSize) return;
    const index = selectedIndex;

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

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
          event.preventDefault();
          setSelectedIndex(null);
          return;
        default:
          return;
      }

      event.preventDefault();
      nudgeCorner(index, dx, dy);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [frameSize, nudgeCorner, selectedIndex]);

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

  function canvasToFrame(point: Point): Point {
    const scale = displayScaleRef.current || 1;
    return { x: point.x / scale, y: point.y / scale };
  }

  function updatePointFromPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (draggingIndex === null || !frameSize || !points) return;

    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    const point = canvasToFrame(cssToCanvas(event, canvas));
    setPoints((current) => {
      if (!current) return current;
      const next = [...current];
      next[draggingIndex] = {
        x: clamp(point.x, 0, frameSize.width),
        y: clamp(point.y, 0, frameSize.height),
      };
      return next;
    });
  }

  function pickWhiteSample(canvas: HTMLCanvasElement, x: number, y: number) {
    const radius = Math.max(
      3,
      Math.min(canvas.width, canvas.height) * WHITE_SAMPLE_RADIUS_RATIO,
    );
    const sample = sampleWhiteRegion(canvas, x, y, radius);
    if (!sample) return;

    setWhiteBalance({
      sample,
      point: canvasToFrame({ x, y }),
      strength: whiteBalance?.strength ?? 1,
      brightness: whiteBalance?.brightness ?? 1,
    });
    setIsPickingWhite(false);
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!points || !frameSize) return;
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    const position = cssToCanvas(event, canvas);

    if (isPickingWhite) {
      pickWhiteSample(canvas, position.x, position.y);
      return;
    }

    pointerStartRef.current = position;

    const scaledPoints = scalePoints(points, displayScaleRef.current);
    const hitRadius =
      HIT_RADIUS_CSS * (canvas.width / canvas.getBoundingClientRect().width);
    const targetIndex = scaledPoints.findIndex(
      (point) =>
        Math.hypot(point.x - position.x, point.y - position.y) <= hitRadius,
    );

    if (targetIndex !== -1) {
      setDraggingIndex(targetIndex);
      setSelectedIndex(null);
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
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

      // Distinguish tap from drag.
      const canvas = sourceCanvasRef.current;
      const start = pointerStartRef.current;
      if (canvas && start) {
        const { x, y } = cssToCanvas(event, canvas);
        if (Math.hypot(x - start.x, y - start.y) <= TAP_THRESHOLD) {
          setSelectedIndex(draggingIndex);
        }
      }
    }
    setDraggingIndex(null);
    pointerStartRef.current = null;
  }

  function rotateBy(delta: 90 | 270) {
    if (!image || !frameSize || !points) return;

    setRotation(normalizeRotation(rotation + delta));
    setPoints(orderCorners(points.map((point) => rotatePoint(point, delta, frameSize.width, frameSize.height))));
    setSelectedIndex(null);
    setWhiteBalance((current) =>
      current
        ? {
            ...current,
            point: rotatePoint(current.point, delta, frameSize.width, frameSize.height),
          }
        : current,
    );
  }

  function detectCorners() {
    if (!image) return;

    const detected = detectPaperCorners(image);
    if (!detected) {
      setDetectError(DETECT_FAILURE);
      return;
    }

    setDetectError(null);
    setSelectedIndex(null);
    setPoints(
      orderCorners(
        rotatePoints(detected, rotation, image.naturalWidth, image.naturalHeight),
      ),
    );
  }

  function resetCorners() {
    if (!frameSize) return;
    setSelectedIndex(null);
    setPoints(defaultPoints(frameSize.width, frameSize.height));
  }

  /** Leaves the top layer explicitly, rather than relying on unmount. */
  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }

  async function applyAdjustments() {
    if (!image || !points) return;

    setIsApplying(true);
    setError(null);
    try {
      const { canvas: source, scale } = createRotatedSource(image, rotation);
      const rectified = document.createElement("canvas");
      drawPerspectiveToCanvas(source, scalePoints(points, scale), rectified);
      if (gains) {
        applyWhiteBalance(rectified, gains);
      }
      const result = await canvasToJpeg(rectified, 0.8);
      closeDialog();
      onApply(result);
    } catch {
      setError(PROCESS_FAILURE);
    } finally {
      setIsApplying(false);
    }
  }

  const hint = isPickingWhite
    ? "Tap a spot on the white paper in the source image."
    : selectedIndex !== null
      ? `Corner ${CORNER_LABELS[selectedIndex]} selected — drag it, use the arrows to nudge, or tap another corner.`
      : "Drag the corner handles onto the edges of the paper. Tap a corner to select it and nudge it with the arrow keys.";

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Modify ${file.name}`}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-[var(--background)] p-0 text-[var(--text-primary)] backdrop:bg-black/60 open:flex open:flex-col"
    >
      <header className="flex items-center justify-between gap-3 border-b-2 border-[var(--border)] px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold uppercase tracking-wider">
            Modify image
          </h3>
          <p className="truncate text-xs text-[var(--text-secondary)]">
            {file.name}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          className="inline-flex size-9 shrink-0 items-center justify-center border-2 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)] focus-visible:ring-offset-2"
          onClick={() => {
            closeDialog();
            onClose();
          }}
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
        <p className="text-sm text-[var(--text-secondary)]">{hint}</p>

        {error ? (
          <p className="border-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {detectError ? (
          <p className="border-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {detectError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => rotateBy(270)}
          >
            <RotateCcw className="mr-2 size-4" />
            Rotate left
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => rotateBy(90)}
          >
            <RotateCw className="mr-2 size-4" />
            Rotate right
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={detectCorners}>
            <ScanEye className="mr-2 size-4" />
            Detect corners
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={resetCorners}>
            Reset corners
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Source</p>
              {selectedIndex !== null && points ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Nudge {CORNER_LABELS[selectedIndex]}:
                  </span>
                  <button
                    type="button"
                    aria-label="Nudge up"
                    className="inline-flex size-7 items-center justify-center border border-[var(--border)] hover:bg-[var(--accent)]"
                    onClick={() => nudgeCorner(selectedIndex, 0, -NUDGE_STEP)}
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Nudge down"
                    className="inline-flex size-7 items-center justify-center border border-[var(--border)] hover:bg-[var(--accent)]"
                    onClick={() => nudgeCorner(selectedIndex, 0, NUDGE_STEP)}
                  >
                    <ArrowDown className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Nudge left"
                    className="inline-flex size-7 items-center justify-center border border-[var(--border)] hover:bg-[var(--accent)]"
                    onClick={() => nudgeCorner(selectedIndex, -NUDGE_STEP, 0)}
                  >
                    <ArrowLeft className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Nudge right"
                    className="inline-flex size-7 items-center justify-center border border-[var(--border)] hover:bg-[var(--accent)]"
                    onClick={() => nudgeCorner(selectedIndex, NUDGE_STEP, 0)}
                  >
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              ) : null}
            </div>
            <canvas
              ref={sourceCanvasRef}
              className={`mx-auto block h-auto max-h-[33dvh] w-auto max-w-full border-2 border-[var(--border)] bg-black/5 dark:bg-white/5 ${
                isPickingWhite ? "cursor-crosshair" : "cursor-move touch-none"
              }`}
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
              className="mx-auto block h-auto max-h-[33dvh] w-auto max-w-full border-2 border-[var(--border)] bg-black/5 dark:bg-white/5"
            />
          </div>
        </div>

        <div className="space-y-3 border-2 border-[var(--border)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">White balance</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {whiteBalance
                  ? "Paper sample picked — tune it, or pick another spot."
                  : "Pick a spot on the white paper to take the colour cast out of it."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={isPickingWhite ? "default" : "outline"}
                onClick={() => setIsPickingWhite((current) => !current)}
              >
                <Pipette className="mr-2 size-4" />
                {isPickingWhite ? "Tap the paper…" : "Pick white"}
              </Button>
              {whiteBalance ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setWhiteBalance(null)}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {whiteBalance ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="white-strength">
                  Strength {Math.round(whiteBalance.strength * 100)}%
                </Label>
                <input
                  id="white-strength"
                  className="h-6 w-full accent-[var(--primary)]"
                  max={100}
                  min={0}
                  step={WHITE_STRENGTH_STEP * 100}
                  type="range"
                  value={Math.round(whiteBalance.strength * 100)}
                  onChange={(event) =>
                    setWhiteBalance((current) =>
                      current
                        ? {
                            ...current,
                            strength: Number(event.target.value) / 100,
                          }
                        : current,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="white-brightness">
                  Brightness {Math.round(whiteBalance.brightness * 100)}%
                </Label>
                <input
                  id="white-brightness"
                  className="h-6 w-full accent-[var(--primary)]"
                  max={170}
                  min={70}
                  step={5}
                  type="range"
                  value={Math.round(whiteBalance.brightness * 100)}
                  onChange={(event) =>
                    setWhiteBalance((current) =>
                      current
                        ? {
                            ...current,
                            brightness: Number(event.target.value) / 100,
                          }
                        : current,
                    )
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t-2 border-[var(--border)] px-3 py-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            closeDialog();
            onUseAsIs();
          }}
        >
          Keep original
        </Button>
        <Button
          disabled={isApplying || !points}
          type="button"
          onClick={() => void applyAdjustments()}
        >
          {isApplying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Apply
        </Button>
      </footer>
    </dialog>
  );
}
