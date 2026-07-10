"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useEffect } from "react";

/**
 * Logo géant flouté en fond, avec le même effet de parallax (ressort Framer
 * Motion) que ParallaxBlob. Purement décoratif (aria-hidden), désactivé si
 * l'utilisateur préfère les animations réduites.
 */
export function ParallaxLogo({ className }: { className?: string }) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 50, damping: 20, mass: 0.9 });
  const springY = useSpring(pointerY, { stiffness: 50, damping: 20, mass: 0.9 });
  const x = useTransform(springX, (v) => v * 18);
  const y = useTransform(springY, (v) => v * 14);

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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 0.55, scale: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className={`pointer-events-none absolute flex items-center justify-center blur-md ${className ?? ""}`}
    >
      <Image src="/logo.png" alt="" width={800} height={800} priority className="size-full object-contain" />
    </motion.div>
  );
}
