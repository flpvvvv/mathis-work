export function GallerySkeleton() {
  return (
    <section className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-none bg-black/10 dark:bg-white/10" />
      <div className="h-12 w-full animate-pulse rounded-none bg-black/10 dark:bg-white/10" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="aspect-[3/4] animate-pulse rounded-none bg-black/10 dark:bg-white/10"
          />
        ))}
      </div>
    </section>
  );
}
