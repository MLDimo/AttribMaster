"use client";

import { useRef } from "react";

/**
 * Effet 3D "tilt" au survol : incline légèrement l'élément selon la position
 * du curseur (perspective CSS). Désactivé si prefers-reduced-motion.
 */
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef<boolean | null>(null);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reducedMotion.current === null) {
      reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    if (reducedMotion.current) return;

    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${py * -6}deg) rotateY(${px * 6}deg) translateZ(0)`;
  }

  function handlePointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0)";
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`transition-transform duration-200 ease-out will-change-transform ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
