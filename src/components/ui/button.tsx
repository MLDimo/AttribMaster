import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Slot as SlotPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,box-shadow,border-color,color] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-md active:bg-primary/95",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 hover:shadow-md active:bg-destructive/95",
        outline:
          "border border-input bg-background hover:border-primary/40 hover:bg-accent hover:text-accent-foreground hover:shadow-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary hover:text-primary/70",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/** Ressort de "lift" au survol, appliqué aux variantes avec relief (pas ghost/link). */
const LIFT_VARIANTS = new Set(["default", "destructive", "outline", "secondary"]);
const SPRING = { type: "spring" as const, stiffness: 400, damping: 25 };

const MotionSlot = motion.create(SlotPrimitive.Root);

function Button({
  className,
  variant,
  size,
  asChild = false,
  disabled,
  ...props
}: HTMLMotionProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? MotionSlot : motion.button;
  const hasLift = variant ? LIFT_VARIANTS.has(variant) : LIFT_VARIANTS.has("default");
  const noMotion = variant === "link";

  return (
    <Comp
      data-slot="button"
      disabled={disabled}
      whileHover={!disabled && !noMotion ? { y: hasLift ? -2 : 0, scale: hasLift ? 1 : 1.02 } : undefined}
      whileTap={!disabled && !noMotion ? { scale: 0.97, y: 0 } : undefined}
      transition={SPRING}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
