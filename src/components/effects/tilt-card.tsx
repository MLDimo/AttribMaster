"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * Effet 3D "tilt" au survol : incline légèrement l'élément selon la position
 * du curseur (ressort Framer Motion, plus fluide qu'une transition CSS).
 * Désactivé si prefers-reduced-motion.
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

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const springConfig = { stiffness: 300, damping: 25, mass: 0.5 };
  const springX = useSpring(px, springConfig);
  const springY = useSpring(py, springConfig);
  const rotateX = useTransform(springY, (v) => v * -6);
  const rotateY = useTransform(springX, (v) => v * 6);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reducedMotion.current === null) {
      reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    if (reducedMotion.current) return;

    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handlePointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ rotateX, rotateY, perspective: 800 }}
      className={`will-change-transform ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}
