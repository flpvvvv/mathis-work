"use client";

import { X, Plus, Hash } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

type Props = {
  /** All existing tags available for selection */
  availableTags: string[];
  /** Currently selected tags (including any new ones not in availableTags) */
  selectedTags: string[];
  /** Called when tags change */
  onChange: (tags: string[]) => void;
  /** Placeholder for the new tag input */
  placeholder?: string;
  /** ID for the input element */
  id?: string;
  /** Name for the input element */
  name?: string;
};

export function TagInput({
  availableTags,
  selectedTags,
  onChange,
  placeholder = "Add new tag…",
  id = "tag-input",
  name = "tag-input",
}: Props) {
  const [inputValue, setInputValue] = useState("");

  // Tags that exist but aren't selected yet
  const unselectedExistingTags = useMemo(
    () => availableTags.filter((tag) => !selectedTags.includes(tag)),
    [availableTags, selectedTags],
  );

  // Tags that were newly created (not in availableTags)
  const newTags = useMemo(
    () => selectedTags.filter((tag) => !availableTags.includes(tag)),
    [selectedTags, availableTags],
  );

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  }

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    if (selectedTags.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...selectedTags, trimmed]);
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && selectedTags.length > 0) {
      // Remove last tag when backspace on empty input
      onChange(selectedTags.slice(0, -1));
    }
  }

  return (
    <div className="space-y-3">
      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => {
            const isNew = newTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className="group flex items-center gap-1 border-2 border-[var(--border)] bg-[var(--primary)] text-black shadow-[var(--shadow-brutal-sm)] px-2 py-1 text-xs font-bold uppercase tracking-wider font-display transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[var(--shadow-brutal)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--border)]"
              >
                <span className={isNew ? "italic" : ""}>
                  {tag}
                  {isNew && <span className="ml-1 opacity-60 text-[10px]">new</span>}
                </span>
                <X className="size-3 opacity-60 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}

      {/* Input for new tags */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]">
          <Hash className="size-4" />
        </div>
        <Input
          id={id}
          name={name}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="pl-9"
        />
        {inputValue.trim() && (
          <button
            type="button"
            onClick={() => addTag(inputValue)}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 border-2 border-[var(--border)] bg-[var(--secondary)] text-black px-2 py-0.5 text-xs font-bold uppercase tracking-wider font-display shadow-[var(--shadow-brutal-active)] transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[var(--shadow-brutal-sm)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <Plus className="size-3" />
            Add
          </button>
        )}
      </div>

      {/* Existing tags to pick from */}
      {unselectedExistingTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wider">
            Pick from existing tags
          </p>
          <div className="flex flex-wrap gap-2">
            {unselectedExistingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className="border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] px-2 py-1 text-xs font-bold uppercase tracking-wider font-display transition-[transform,box-shadow,background-color] hover:bg-[var(--secondary)] hover:text-black hover:-translate-y-[1px] hover:shadow-[var(--shadow-brutal-sm)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--border)]"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-[var(--text-secondary)]">
        Type a new tag and press Enter, or click existing tags to add them. Click a tag to remove it.
      </p>
    </div>
  );
}