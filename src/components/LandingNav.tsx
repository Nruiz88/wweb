// LandingNav component — uses session JWT cookie instead of Supabase
// This is a placeholder; the actual navigation will be updated once
// the auth pages are rewritten.

export function LandingNav() {
  return (
    <nav className="bg-wa-header border-b border-wa-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-wa-accent flex items-center justify-center">
              <span className="text-white text-sm font-bold">B</span>
            </div>
            <span className="text-lg font-bold text-wa-text">Boti</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm text-wa-text-secondary hover:text-wa-text">Iniciar sesión</a>
            <a href="/register" className="rounded-xl bg-wa-accent px-4 py-2 text-sm font-semibold text-white hover:bg-wa-accent/90">Crear cuenta</a>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default LandingNav;
