"use client";

import { useEffect, useRef } from "react";

/**
 * Décor "sphère 3D douce" façon flow-computing.com, en pur CSS (radial-gradient
 * + blur), avec un effet de parallax au mouvement de souris. Purement décoratif
 * (aria-hidden) et désactivé si l'utilisateur préfère les animations réduites.
 */
export function ParallaxBlob({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handlePointerMove(e: PointerEvent) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      el!.style.transform = `translate3d(${x * 24}px, ${y * 16}px, 0)`;
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`blob-3d pointer-events-none absolute rounded-full transition-transform duration-300 ease-out ${className ?? ""}`}
    />
  );
}
