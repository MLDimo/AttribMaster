"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

/**
 * Décor "sphère 3D douce" façon flow-computing.com, en pur CSS (radial-gradient
 * + blur), avec un effet de parallax au mouvement de souris (ressort Framer
 * Motion). Purement décoratif (aria-hidden) et désactivé si l'utilisateur
 * préfère les animations réduites.
 */
export function ParallaxBlob({ className }: { className?: string }) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 60, damping: 20, mass: 0.8 });
  const springY = useSpring(pointerY, { stiffness: 60, damping: 20, mass: 0.8 });
  const x = useTransform(springX, (v) => v * 24);
  const y = useTransform(springY, (v) => v * 16);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handlePointerMove(e: PointerEvent) {
      pointerX.set(e.clientX / window.innerWidth - 0.5);
      pointerY.set(e.clientY / window.innerHeight - 0.5);
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [pointerX, pointerY]);

  return (
    <motion.div
      aria-hidden
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className={`blob-3d pointer-events-none absolute rounded-full ${className ?? ""}`}
    />
  );
}
