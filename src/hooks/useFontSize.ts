import { useState, useEffect } from "react";

export function useFontSize() {
  const [fontScale, setFontScale] = useState<number>(() => {
    const saved = localStorage.getItem("presta_font_scale");
    return saved ? Number.parseFloat(saved) : 1.0;
  });

  useEffect(() => {
    localStorage.setItem("presta_font_scale", fontScale.toString());
    document.documentElement.style.setProperty("--font-scale", fontScale.toString());
  }, [fontScale]);

  const increaseFontSize = () => {
    setFontScale((prev) => Math.min(prev + 0.1, 1.4));
  };

  const decreaseFontSize = () => {
    setFontScale((prev) => Math.max(prev - 0.1, 0.8));
  };

  const resetFontSize = () => {
    setFontScale(1.0);
  };

  return {
    fontScale,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
  };
}
