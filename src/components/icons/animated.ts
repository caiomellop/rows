import type { ForwardRefExoticComponent, PointerEvent, RefAttributes } from "react";
import { useRef } from "react";

/**
 * The animated icons in this folder are copied from lucide-animated
 * (github.com/pqoqubbw/icons, MIT). Only the ones the app uses are here.
 * They all share this imperative handle.
 */
export type AnimatedIconHandle = { startAnimation: () => void; stopAnimation: () => void };

export type AnimatedIcon = ForwardRefExoticComponent<
  { size?: number; className?: string } & RefAttributes<AnimatedIconHandle>
>;

/**
 * Plays an icon's animation while the mouse is over its whole parent (the
 * sidebar item), not just the icon. Pass `ref` to the icon and spread `hover`
 * on the parent. Touch never animates, nor does "reduce motion".
 */
export function useIconHover() {
  const ref = useRef<AnimatedIconHandle>(null);
  const hover = {
    onPointerEnter(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      ref.current?.startAnimation();
    },
    onPointerLeave() {
      ref.current?.stopAnimation();
    },
  };
  return { ref, hover };
}
