"use client";

import { useEffect, useRef } from "react";

type Props = {
  enabled: boolean;
  onLoadMore: () => void;
};

export function InfiniteLoader({ enabled, onLoadMore }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        rootMargin: "240px",
      },
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  return <div ref={ref} className="h-4 w-full" />;
}
