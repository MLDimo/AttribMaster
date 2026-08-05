"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Slider({
  className,
  trackColor,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { trackColor?: string }) {
  // Radix pose role="slider" sur le Thumb, pas sur le Root : un aria-label
  // passé au Root (comportement HTML natif habituel) resterait invisible aux
  // lecteurs d'écran ET aux locators de test ("getByRole('slider', {name})").
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full rounded-full"
          style={trackColor ? { backgroundColor: trackColor } : undefined}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        aria-label={ariaLabel}
        style={trackColor ? { borderColor: trackColor } : undefined}
        className="block size-4 shrink-0 rounded-full border-2 bg-background shadow-sm transition-[transform,box-shadow] hover:scale-110 focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
