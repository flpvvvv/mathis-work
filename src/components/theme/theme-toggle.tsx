"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      aria-label="Toggle theme"
      size="icon"
      type="button"
      variant="outline"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Both icons are rendered and the `dark` class that next-themes puts on
          <html> picks one, so server and client markup stay identical.
          resolvedTheme is undefined until hydration, and branching on it
          rendered a different icon on the server than in the browser. */}
      <Sun className="hidden size-4 [.dark_&]:block" />
      <Moon className="size-4 [.dark_&]:hidden" />
    </Button>
  );
}
