"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Logo géant flouté en fond, avec le même effet de parallax au mouvement de
 * souris que ParallaxBlob. Purement décoratif (aria-hidden), désactivé si
 * l'utilisateur préfère les animations réduites.
 */
export function ParallaxLogo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function handlePointerMove(e: PointerEvent) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      el!.style.transform = `translate3d(${x * 16}px, ${y * 12}px, 0)`;
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute flex items-center justify-center opacity-45 blur-md transition-transform duration-300 ease-out ${className ?? ""}`}
    >
      <Image src="/logo.png" alt="" width={800} height={800} priority className="size-full object-contain" />
    </div>
  );
}
