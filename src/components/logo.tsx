interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: { wrapper: "h-8 w-8", icon: 16, text: "text-sm" },
  md: { wrapper: "h-10 w-10", icon: 20, text: "text-base" },
  lg: { wrapper: "h-14 w-14", icon: 28, text: "text-xl" },
  xl: { wrapper: "h-20 w-20", icon: 40, text: "text-3xl" },
};

export function Logo({ className = "", size = "md" }: LogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className={`flex ${s.wrapper} shrink-0 items-center justify-center rounded-2xl bg-[#00a884]`}>
        <svg width={s.icon} height={s.icon} viewBox="0 0 40 40" fill="none">
          {/* Chat bubble */}
          <path
            d="M20 4C11.16 4 4 10.48 4 18.5C4 22.82 6.24 26.68 9.68 29.32L8.56 34.56C8.44 35.12 9.04 35.56 9.52 35.24L14.8 31.8C16.4 32.28 18.16 32.56 20 32.56C28.84 32.56 36 26.08 36 18.08C36 10.48 28.84 4 20 4Z"
            fill="white"
            fillOpacity="0.95"
          />
          {/* Bot eyes */}
          <circle cx="14" cy="17" r="2.5" fill="#00a884" />
          <circle cx="26" cy="17" r="2.5" fill="#00a884" />
          {/* Bot smile */}
          <path
            d="M13 23C13 23 16 27 20 27C24 27 27 23 27 23"
            stroke="#00a884"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Antenna */}
          <line x1="20" y1="4" x2="20" y2="1" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="0" r="1.5" fill="white" />
        </svg>
      </span>
      <span className={`${s.text} font-extrabold tracking-tight`}>
        Boti
      </span>
    </div>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00a884] ${className}`}>
      <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 4C11.16 4 4 10.48 4 18.5C4 22.82 6.24 26.68 9.68 29.32L8.56 34.56C8.44 35.12 9.04 35.56 9.52 35.24L14.8 31.8C16.4 32.28 18.16 32.56 20 32.56C28.84 32.56 36 26.08 36 18.08C36 10.48 28.84 4 20 4Z"
          fill="white"
          fillOpacity="0.95"
        />
        <circle cx="14" cy="17" r="2.5" fill="#00a884" />
        <circle cx="26" cy="17" r="2.5" fill="#00a884" />
        <path d="M13 23C13 23 16 27 20 27C24 27 27 23 27 23" stroke="#00a884" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="4" x2="20" y2="1" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="0" r="1.5" fill="white" />
      </svg>
    </span>
  );
}

export function LogoFull({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark />
      <div>
        <span className="text-lg font-extrabold tracking-tight">Boti</span>
        <span className="ml-1.5 rounded-full bg-[#00a884]/15 px-2 py-0.5 text-[9px] font-semibold text-[#00a884]">
          for Business
        </span>
      </div>
    </div>
  );
}
