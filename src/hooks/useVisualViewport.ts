"use client";
import { useEffect, useState } from "react";

export function useVisualViewport() {
  const [viewport, setViewport] = useState({
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    offsetTop: 0,
  });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewport({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return viewport;
}
