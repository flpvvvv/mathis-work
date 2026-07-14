"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "m-auto max-w-md border-2 border-[var(--border)] bg-[var(--surface)] p-0 shadow-[var(--shadow-brutal)] backdrop:bg-black/50",
        "open:flex open:flex-col",
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">
          {title}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="px-4 py-6 text-sm text-[var(--text-secondary)]">
        {description}
      </p>

      <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "inline-flex h-10 items-center justify-center border-2 border-[var(--border)] bg-[var(--surface)] px-4 font-display text-sm font-bold uppercase tracking-wider transition-[transform,box-shadow] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[var(--shadow-brutal-lg)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
          )}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            "inline-flex h-10 items-center justify-center border-2 border-[var(--border)] px-4 font-display text-sm font-bold uppercase tracking-wider transition-[transform,box-shadow] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[var(--shadow-brutal-lg)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
            variant === "destructive"
              ? "bg-red-500 text-black"
              : "bg-[var(--primary)] text-black",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
