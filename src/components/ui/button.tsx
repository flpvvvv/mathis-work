import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-display uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-transparent border-2 border-[var(--border)] shadow-[var(--shadow-brutal)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[var(--shadow-brutal-lg)] motion-reduce:transition-none motion-reduce:transform-none",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-black",
        secondary: "bg-[var(--secondary)] text-black",
        outline:
          "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-black",
        ghost: "border-transparent shadow-none hover:shadow-[var(--shadow-brutal)] hover:bg-[var(--accent)] hover:border-[var(--border)] hover:text-black dark:text-white",
        destructive: "bg-red-500 text-black",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ className, variant, size }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
