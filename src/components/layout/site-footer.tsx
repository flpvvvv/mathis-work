const CURRENT_YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="border-t-4 border-[var(--border)] bg-[var(--surface)] mt-12">
      <div className="container-page flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          © {CURRENT_YEAR} Mathis. All artworks are original creations.
        </p>
        <nav aria-label="Footer" className="flex gap-4 text-sm">
          <a
            className="text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--border)]"
            href="mailto:contact@mathis.day"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
