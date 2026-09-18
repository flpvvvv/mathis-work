"use client";

import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { getPublicImageUrl } from "@/lib/storage/images";
import type { WorkImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Scale at which the artwork fills the screen ("fit"). */
const MIN_SCALE = 1;
const MAX_SCALE = 6;
/** Pointer travel (px) below which a press still counts as a tap. */
const TAP_SLOP_PX = 10;
const ZOOM_STEP = 1.6;
const WHEEL_ZOOM_SENSITIVITY = 0.0022;
const ZOOM_TRANSITION = "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)";
const SWIPE_TRANSITION = "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)";
const SWIPE_MIN_DISTANCE_PX = 48;
const SWIPE_MAX_DISTANCE_PX = 96;
const SWIPE_DISTANCE_RATIO = 0.2;
/**
 * The track holds three slots — previous, current, next — and always rests
 * showing the middle one, so zoom/pan math can assume the artwork is centred.
 * The style object is module-level on purpose: React then never rewrites the
 * track's inline transform, leaving it free for gesture-driven updates.
 */
const TRACK_REST_TRANSFORM = "translate3d(-100%, 0, 0)";
const TRACK_REST_STYLE: CSSProperties = { transform: TRACK_REST_TRANSFORM };
const ACTIVE_SLOT = 1;

type Point = { x: number; y: number };
type Transform = { scale: number; x: number; y: number };
type DragAxis = "none" | "x" | "y";
type Gesture =
  | {
      kind: "drag";
      startPoint: Point;
      startTransform: Transform;
      moved: boolean;
      axis: DragAxis;
      offset: number;
    }
  | {
      kind: "pinch";
      startMid: Point;
      startDistance: number;
      startTransform: Transform;
    };

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

const CHROME_BUTTON =
  "pointer-events-auto inline-flex touch-manipulation items-center justify-center border-2 border-white bg-black/70 text-white shadow-[4px_4px_0px_0px_var(--primary)] transition-[transform,box-shadow,background-color,color] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-none motion-reduce:transition-none";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function wrapIndex(index: number, count: number) {
  return ((index % count) + count) % count;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

type Props = {
  images: WorkImage[];
  index: number;
  altText: string;
  open: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/**
 * Full-screen artwork viewer.
 *
 * Mobile-first gestures: tap the artwork to open it, pinch to zoom, drag to pan
 * while zoomed, swipe sideways to move between images, then tap to step back
 * out (reset zoom, then close). Desktop gets wheel/trackpad zoom plus explicit
 * zoom controls.
 */
export function ImageLightbox({
  images,
  index,
  altText,
  open,
  onClose,
  onIndexChange,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const current = images[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  // Esc fires `cancel`; route it through the controlled `open` prop instead.
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

  // Lock background scrolling while the viewer is up.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Full screen artwork viewer"
      className="fixed inset-x-0 top-0 m-0 h-[100dvh] w-full max-w-none max-h-none overflow-hidden border-0 bg-black p-0 text-white backdrop:bg-black"
    >
      {open && current ? (
        <LightboxContent
          key={current.id}
          altText={altText}
          images={images}
          index={index}
          onClose={onClose}
          onIndexChange={onIndexChange}
        />
      ) : null}
    </dialog>
  );
}

type ContentProps = {
  images: WorkImage[];
  index: number;
  altText: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

function LightboxContent({
  images,
  index,
  altText,
  onClose,
  onIndexChange,
}: ContentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const transformRef = useRef<Transform>({ ...IDENTITY });
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const reducedMotionRef = useRef(false);

  const [zoomPercent, setZoomPercent] = useState(100);

  const imageCount = images.length;
  const hasMultiple = imageCount > 1;
  // Neighbouring slots mount eagerly, so their full-resolution variants are
  // already cached by the time a swipe reveals them. The window wraps, so the
  // artwork after the last one is the first (and swiping always has somewhere
  // to go).
  const slides = Array.from(
    { length: ACTIVE_SLOT * 2 + 1 },
    (_, slot) => images[wrapIndex(index - ACTIVE_SLOT + slot, imageCount)],
  );

  const applyTransform = useCallback((next: Transform, animate: boolean) => {
    transformRef.current = next;
    const img = imgRef.current;
    if (img) {
      img.style.transition =
        animate && !reducedMotionRef.current ? ZOOM_TRANSITION : "none";
      img.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
    }
    setZoomPercent((previous) => {
      const percent = Math.round(next.scale * 100);
      return previous === percent ? previous : percent;
    });
  }, []);

  /** Drops any zoom on the outgoing artwork without animating. */
  const clearZoom = useCallback(() => {
    transformRef.current = { ...IDENTITY };
    const img = imgRef.current;
    if (img) {
      img.style.transition = "none";
      img.style.transform = "";
    }
    setZoomPercent(100);
  }, []);

  const setTrackOffset = useCallback((offset: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition =
      animate && !reducedMotionRef.current ? SWIPE_TRANSITION : "none";
    track.style.transform =
      offset === 0
        ? TRACK_REST_TRANSFORM
        : `translate3d(calc(-100% + ${offset}px), 0, 0)`;
  }, []);

  /** Keeps the artwork inside the viewport: scale clamped, edges never pulled inside. */
  const constrain = useCallback((next: Transform): Transform => {
    const stage = stageRef.current;
    const img = imgRef.current;
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    if (!stage || !img) return { ...next, scale };

    const { width, height } = stage.getBoundingClientRect();
    const baseWidth = img.offsetWidth;
    const baseHeight = img.offsetHeight;
    if (!width || !height || !baseWidth || !baseHeight) {
      return { ...next, scale };
    }

    const maxX = Math.max(0, (baseWidth * scale - width) / 2);
    const maxY = Math.max(0, (baseHeight * scale - height) / 2);
    return {
      scale,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
  }, []);

  /** Zooms so the point under (clientX, clientY) stays put. */
  const zoomAt = useCallback(
    (
      targetScale: number,
      clientX: number,
      clientY: number,
      animate: boolean,
    ) => {
      const stage = stageRef.current;
      if (!stage) return;

      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const from = transformRef.current;
      const scale = clamp(targetScale, MIN_SCALE, MAX_SCALE);

      // Anchor expressed as an offset from the artwork centre at fit scale.
      const anchorX = (clientX - centerX - from.x) / from.scale;
      const anchorY = (clientY - centerY - from.y) / from.scale;

      applyTransform(
        constrain({
          scale,
          x: clientX - centerX - anchorX * scale,
          y: clientY - centerY - anchorY * scale,
        }),
        animate,
      );
    },
    [applyTransform, constrain],
  );

  const zoomByStep = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      zoomAt(
        transformRef.current.scale * factor,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        true,
      );
    },
    [zoomAt],
  );

  const resetZoom = useCallback(() => {
    applyTransform({ ...IDENTITY }, true);
  }, [applyTransform]);

  /**
   * Settles a swipe: the artwork whose slot is now centred wins, and its
   * neighbours slide into the track behind it.
   */
  const commitSwipe = useCallback(
    (offset: number) => {
      const width = stageRef.current?.getBoundingClientRect().width ?? 0;
      const threshold = clamp(
        width * SWIPE_DISTANCE_RATIO,
        SWIPE_MIN_DISTANCE_PX,
        SWIPE_MAX_DISTANCE_PX,
      );

      // Swiping wraps: past the last artwork comes the first.
      let nextIndex = index;
      if (offset <= -threshold) nextIndex = wrapIndex(index + 1, imageCount);
      else if (offset >= threshold) nextIndex = wrapIndex(index - 1, imageCount);

      clearZoom();
      setTrackOffset(0, true);
      if (nextIndex !== index) onIndexChange(nextIndex);
    },
    [clearZoom, imageCount, index, onIndexChange, setTrackOffset],
  );

  const goTo = useCallback(
    (delta: number) => {
      if (imageCount < 2) return;
      const nextIndex = (index + delta + imageCount) % imageCount;
      clearZoom();
      setTrackOffset(0, false);
      onIndexChange(nextIndex);
    },
    [clearZoom, imageCount, index, onIndexChange, setTrackOffset],
  );

  /**
   * Taps close on `pointerup`, which lands before the browser dispatches the
   * compatibility `click`. Without this, that click hits the gallery preview
   * underneath the (now closed) viewer and immediately reopens it.
   */
  const swallowNextClick = useCallback(() => {
    const swallow = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener("click", swallow, true);
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(
      () => window.removeEventListener("click", swallow, true),
      350,
    );
  }, []);

  /** A tap steps out one level: zoomed -> fit, fit -> close. */
  const handleTap = useCallback(() => {
    if (transformRef.current.scale > MIN_SCALE + 0.001) {
      resetZoom();
      return;
    }
    swallowNextClick();
    onClose();
  }, [onClose, resetZoom, swallowNextClick]);

  const beginGesture = useCallback(
    (options?: { moved?: boolean }) => {
      const pointers = [...pointersRef.current.values()];
      const startTransform = { ...transformRef.current };

      if (pointers.length >= 2) {
        // A second finger always means pinch: abandon any swipe in progress.
        setTrackOffset(0, false);
        const [a, b] = pointers;
        gestureRef.current = {
          kind: "pinch",
          startMid: midpoint(a, b),
          startDistance: Math.max(1, distance(a, b)),
          startTransform,
        };
        return;
      }

      if (pointers.length === 1) {
        gestureRef.current = {
          kind: "drag",
          startPoint: pointers[0],
          startTransform,
          moved: options?.moved ?? false,
          axis: "none",
          offset: 0,
        };
        return;
      }

      gestureRef.current = null;
    },
    [setTrackOffset],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      beginGesture();
    },
    [beginGesture],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointers = pointersRef.current;
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const gesture = gestureRef.current;
      const stage = stageRef.current;
      if (!gesture || !stage) return;

      if (gesture.kind === "pinch") {
        const [a, b] = [...pointers.values()];
        if (!a || !b) return;

        const rect = stage.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const mid = midpoint(a, b);
        const scale = clamp(
          gesture.startTransform.scale *
            (distance(a, b) / gesture.startDistance),
          MIN_SCALE,
          MAX_SCALE,
        );
        const anchorX =
          (gesture.startMid.x - centerX - gesture.startTransform.x) /
          gesture.startTransform.scale;
        const anchorY =
          (gesture.startMid.y - centerY - gesture.startTransform.y) /
          gesture.startTransform.scale;

        applyTransform(
          constrain({
            scale,
            x: mid.x - centerX - anchorX * scale,
            y: mid.y - centerY - anchorY * scale,
          }),
          false,
        );
        return;
      }

      const point = pointers.get(event.pointerId);
      if (!point) return;

      const dx = point.x - gesture.startPoint.x;
      const dy = point.y - gesture.startPoint.y;
      if (!gesture.moved && Math.hypot(dx, dy) > TAP_SLOP_PX) {
        gesture.moved = true;
        gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (!gesture.moved) return;

      const atFitScale = gesture.startTransform.scale <= MIN_SCALE;

      // Sideways drag at fit scale on a multi-image work changes artwork.
      if (atFitScale && gesture.axis === "x" && hasMultiple) {
        gesture.offset = dx;
        setTrackOffset(dx, false);
        return;
      }

      if (gesture.axis === "y" || atFitScale) return;

      applyTransform(
        constrain({
          scale: gesture.startTransform.scale,
          x: gesture.startTransform.x + dx,
          y: gesture.startTransform.y + dy,
        }),
        false,
      );
    },
    [applyTransform, constrain, hasMultiple, setTrackOffset],
  );

  const releasePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, allowTap: boolean) => {
      const pointers = pointersRef.current;
      const gesture = gestureRef.current;
      pointers.delete(event.pointerId);

      if (pointers.size === 0) {
        gestureRef.current = null;

        if (gesture?.kind === "drag") {
          // Trust the release coordinates: move events get coalesced, so the
          // last processed move can lag well behind the finger.
          const dx = allowTap
            ? event.clientX - gesture.startPoint.x
            : gesture.offset;
          const dy = allowTap ? event.clientY - gesture.startPoint.y : 0;
          const axis: DragAxis =
            gesture.axis !== "none"
              ? gesture.axis
              : Math.abs(dx) > Math.abs(dy)
                ? "x"
                : "y";
          const moved = gesture.moved || Math.hypot(dx, dy) > TAP_SLOP_PX;

          if (!moved) {
            if (allowTap) handleTap();
            return;
          }

          const swiping =
            axis === "x" &&
            gesture.startTransform.scale <= MIN_SCALE &&
            hasMultiple;

          if (swiping) {
            if (allowTap) commitSwipe(dx);
            else setTrackOffset(0, true);
            return;
          }

          if (allowTap && gesture.offset !== 0) setTrackOffset(0, true);
        }
        return;
      }

      // Fingers remain: rebase so they keep driving the current transform
      // without a jump, and without a stray tap on release.
      beginGesture({ moved: true });
    },
    [
      beginGesture,
      commitSwipe,
      handleTap,
      hasMultiple,
      setTrackOffset,
    ],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => releasePointer(event, true),
    [releasePointer],
  );

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => releasePointer(event, false),
    [releasePointer],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = query.matches;
    const handleChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  // The stage owns the keyboard: it is mounted only while the viewer is open.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomByStep(ZOOM_STEP);
      } else if (event.key === "-") {
        event.preventDefault();
        zoomByStep(1 / ZOOM_STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goTo, resetZoom, zoomByStep]);

  // Wheel and trackpad-pinch zoom. React registers `wheel` as passive, so this
  // needs a native non-passive listener to cancel the page scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(
        transformRef.current.scale *
          Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY),
        event.clientX,
        event.clientY,
        false,
      );
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  return (
    <div className="relative size-full motion-safe:animate-fade-in">
      <div
        ref={stageRef}
        className="absolute inset-0 touch-none select-none overflow-hidden focus:outline-none"
        tabIndex={-1}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={trackRef}
          className="flex h-full w-full will-change-transform"
          style={TRACK_REST_STYLE}
        >
          {slides.map((slide, slot) => (
            <div
              // With three or more artworks the window always holds distinct
              // ids, so nodes can be keyed by artwork and React *moves* them
              // between slots on a swipe — reusing the already-decoded bitmap.
              // Fewer artworks means duplicates, and slot keys are the only
              // stable option there.
              key={imageCount >= 3 ? slide.id : `slot-${slot}`}
              className="flex h-full w-full shrink-0 items-center justify-center"
            >
              <Image
                ref={slot === ACTIVE_SLOT ? imgRef : undefined}
                alt={slot === ACTIVE_SLOT ? altText : ""}
                className="max-h-full max-w-full select-none will-change-transform"
                draggable={false}
                fetchPriority={slot === ACTIVE_SLOT ? "high" : "low"}
                height={slide.height}
                loading="eager"
                quality={90}
                sizes="100vw"
                src={getPublicImageUrl(slide.storage_path)}
                width={slide.width}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        {hasMultiple ? (
          <p className="border-2 border-white bg-black/70 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider">
            {index + 1} / {imageCount}
          </p>
        ) : (
          <span />
        )}
        <button
          aria-label="Close full screen view"
          className={cn(CHROME_BUTTON, "size-11")}
          onClick={onClose}
          type="button"
        >
          <X className="size-5" />
        </button>
      </div>

      {hasMultiple ? (
        <>
          <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 sm:left-4">
            <button
              aria-label="Previous image"
              className={cn(CHROME_BUTTON, "size-11")}
              onClick={() => goTo(-1)}
              type="button"
            >
              <ChevronLeft className="size-5" />
            </button>
          </div>
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 sm:right-4">
            <button
              aria-label="Next image"
              className={cn(CHROME_BUTTON, "size-11")}
              onClick={() => goTo(1)}
              type="button"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-5">
        <div className="flex items-center gap-2">
          <button
            aria-label="Zoom out"
            className={cn(
              CHROME_BUTTON,
              "size-11",
              zoomPercent === 100 && "opacity-40",
            )}
            onClick={() => zoomByStep(1 / ZOOM_STEP)}
            type="button"
          >
            <Minus className="size-5" />
          </button>
          <p
            className="w-16 border-2 border-white bg-black/70 py-2 text-center font-display text-xs font-bold tabular-nums"
            title="Zoom level"
          >
            {zoomPercent}%
          </p>
          <button
            aria-label="Fit artwork to screen"
            className={cn(
              CHROME_BUTTON,
              "h-11 px-3 font-display text-xs font-bold uppercase tracking-wider",
              zoomPercent === 100 && "opacity-40",
            )}
            onClick={resetZoom}
            type="button"
          >
            Fit
          </button>
          <button
            aria-label="Zoom in"
            className={cn(
              CHROME_BUTTON,
              "size-11",
              zoomPercent >= MAX_SCALE * 100 && "opacity-40",
            )}
            onClick={() => zoomByStep(ZOOM_STEP)}
            type="button"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
