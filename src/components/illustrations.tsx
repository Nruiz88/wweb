"use client";

// ===== HERO: WhatsApp conversation with bot =====
export function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Glow */}
      <div className="absolute inset-0 rounded-3xl bg-[#00a884]/10 blur-3xl" />

      {/* Phone frame */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b141a] shadow-2xl">
        {/* Status bar */}
        <div className="flex items-center justify-between bg-[#1f2c34] px-5 py-2">
          <span className="text-[10px] font-medium text-white/60">9:41</span>
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-4 rounded-sm border border-white/30">
              <div className="m-0.5 h-1 w-2 rounded-sm bg-[#00a884]" />
            </div>
          </div>
        </div>

        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-white/5 bg-[#1f2c34] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884]/20 text-[10px] font-bold text-[#00a884]">
            BOT
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Mi Bot WhatsApp</p>
            <p className="text-[10px] text-[#00a884]">en linea</p>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-2.5 px-3 py-4">
          {/* Incoming 1 */}
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-xl rounded-tl-sm bg-[#1f2c34] px-3 py-2">
              <p className="text-[11px] leading-relaxed text-white/90">Hola, cual es el horario?</p>
              <p className="mt-0.5 text-right text-[8px] text-white/30">10:23</p>
            </div>
          </div>

          {/* Bot reply 1 */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2">
              <p className="text-[11px] leading-relaxed text-white/90">
                Nuestro horario es de lunes a viernes de 9:00 a 18:00 y sabados de 9:00 a 14:00.
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[8px] text-white/30">
                10:23
                <svg className="h-2.5 w-2.5 text-[#53bdeb]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                </svg>
              </p>
            </div>
          </div>

          {/* Incoming 2 */}
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-xl rounded-tl-sm bg-[#1f2c34] px-3 py-2">
              <p className="text-[11px] leading-relaxed text-white/90">Tienen parking?</p>
              <p className="mt-0.5 text-right text-[8px] text-white/30">10:24</p>
            </div>
          </div>

          {/* Bot reply 2 */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2">
              <p className="text-[11px] leading-relaxed text-white/90">
                Si! Tenemos estacionamiento gratuito para nuestros clientes.
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[8px] text-white/30">
                10:24
                <svg className="h-2.5 w-2.5 text-[#53bdeb]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                </svg>
              </p>
            </div>
          </div>

          {/* Typing indicator */}
          <div className="flex justify-start">
            <div className="rounded-xl rounded-tl-sm bg-[#1f2c34] px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 border-t border-white/5 bg-[#1f2c34] px-3 py-2.5">
          <div className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-[10px] text-white/30">
            Escribe un mensaje...
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884]">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== STEP 1: QR Code scan =====
export function StepQRCode() {
  return (
    <svg viewBox="0 0 200 200" className="h-48 w-48 sm:h-56 sm:w-56" fill="none">
      {/* Background */}
      <rect width="200" height="200" rx="16" fill="#202c33" />

      {/* QR Code frame */}
      <rect x="50" y="30" width="100" height="100" rx="8" fill="#0b141a" stroke="#00a884" strokeWidth="2" strokeDasharray="6 4" />

      {/* QR corners */}
      <rect x="60" y="40" width="24" height="24" rx="4" fill="#00a884" fillOpacity="0.2" stroke="#00a884" strokeWidth="2" />
      <rect x="66" y="46" width="12" height="12" rx="2" fill="#00a884" />

      <rect x="116" y="40" width="24" height="24" rx="4" fill="#00a884" fillOpacity="0.2" stroke="#00a884" strokeWidth="2" />
      <rect x="122" y="46" width="12" height="12" rx="2" fill="#00a884" />

      <rect x="60" y="96" width="24" height="24" rx="4" fill="#00a884" fillOpacity="0.2" stroke="#00a884" strokeWidth="2" />
      <rect x="66" y="102" width="12" height="12" rx="2" fill="#00a884" />

      {/* QR dots */}
      <rect x="90" y="40" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.5" />
      <rect x="100" y="40" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.3" />
      <rect x="90" y="50" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.4" />
      <rect x="100" y="50" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.6" />
      <rect x="110" y="50" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.3" />
      <rect x="90" y="60" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.5" />
      <rect x="100" y="70" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.4" />
      <rect x="110" y="70" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.6" />
      <rect x="120" y="70" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.3" />
      <rect x="130" y="70" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.5" />
      <rect x="90" y="80" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.4" />
      <rect x="100" y="80" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.3" />
      <rect x="110" y="90" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.5" />
      <rect x="120" y="100" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.4" />
      <rect x="90" y="100" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.3" />
      <rect x="100" y="110" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.5" />
      <rect x="110" y="110" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.4" />
      <rect x="120" y="110" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.6" />
      <rect x="130" y="110" width="6" height="6" rx="1" fill="#00a884" fillOpacity="0.3" />

      {/* Scan line */}
      <rect x="55" y="75" width="90" height="2" rx="1" fill="#00a884" fillOpacity="0.6">
        <animate attributeName="y" values="40;120;40" dur="2s" repeatCount="indefinite" />
      </rect>

      {/* Phone icon */}
      <rect x="70" y="140" width="24" height="40" rx="4" fill="#1f2c33" stroke="#00a884" strokeWidth="1.5" />
      <rect x="74" y="148" width="16" height="24" rx="2" fill="#00a884" fillOpacity="0.1" />
      <circle cx="82" cy="178" r="2" fill="#00a884" fillOpacity="0.5" />

      {/* Arrow */}
      <path d="M100 155 L100 145" stroke="#00a884" strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#arrowhead)" />
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="#00a884" />
        </marker>
      </defs>

      {/* Label */}
      <text x="100" y="196" textAnchor="middle" fill="#00a884" fontSize="8" fontWeight="600" fontFamily="system-ui">
        ESCANEAR QR
      </text>
    </svg>
  );
}

// ===== STEP 2: Config =====
export function StepConfig() {
  return (
    <svg viewBox="0 0 200 200" className="h-48 w-48 sm:h-56 sm:w-56" fill="none">
      <rect width="200" height="200" rx="16" fill="#202c33" />

      {/* Form card */}
      <rect x="25" y="20" width="150" height="160" rx="12" fill="#0b141a" stroke="#e6a44e" strokeWidth="1" strokeOpacity="0.3" />

      {/* Title */}
      <rect x="40" y="35" width="80" height="8" rx="4" fill="#e6a44e" fillOpacity="0.6" />
      <rect x="40" y="48" width="50" height="5" rx="2.5" fill="#e6a44e" fillOpacity="0.2" />

      {/* When someone writes */}
      <text x="40" y="72" fill="#e6a44e" fontSize="6" fontWeight="500" fontFamily="system-ui">CUANDO ALGUIEN ESCRIBA</text>
      <rect x="40" y="78" width="120" height="20" rx="6" fill="#1f2c33" stroke="#e6a44e" strokeWidth="0.5" strokeOpacity="0.4" />
      <rect x="50" y="85" width="40" height="6" rx="3" fill="white" fillOpacity="0.5" />

      {/* Bot will reply */}
      <text x="40" y="112" fill="#e6a44e" fontSize="6" fontWeight="500" fontFamily="system-ui">TU BOT RESPONDERA</text>
      <rect x="40" y="118" width="120" height="30" rx="6" fill="#1f2c33" stroke="#e6a44e" strokeWidth="0.5" strokeOpacity="0.4" />
      <rect x="50" y="125" width="80" height="4" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="50" y="133" width="60" height="4" rx="2" fill="white" fillOpacity="0.2" />

      {/* Toggle */}
      <rect x="40" y="155" width="28" height="14" rx="7" fill="#e6a44e" />
      <circle cx="60" cy="162" r="5" fill="white" />

      {/* Save button */}
      <rect x="40" y="173" width="120" height="16" rx="8" fill="#e6a44e" fillOpacity="0.2" stroke="#e6a44e" strokeWidth="1" />
      <text x="100" y="183" textAnchor="middle" fill="#e6a44e" fontSize="7" fontWeight="600" fontFamily="system-ui">
        GUARDAR
      </text>
    </svg>
  );
}

// ===== STEP 3: Active =====
export function StepActive() {
  return (
    <svg viewBox="0 0 200 200" className="h-48 w-48 sm:h-56 sm:w-56" fill="none">
      <rect width="200" height="200" rx="16" fill="#202c33" />

      {/* Center circle */}
      <circle cx="100" cy="85" r="40" fill="#53bdeb" fillOpacity="0.1" stroke="#53bdeb" strokeWidth="1" strokeOpacity="0.3" />
      <circle cx="100" cy="85" r="28" fill="#53bdeb" fillOpacity="0.15" />

      {/* Checkmark */}
      <path d="M86 85 L96 95 L116 75" stroke="#53bdeb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

      {/* Pulse rings */}
      <circle cx="100" cy="85" r="40" fill="none" stroke="#53bdeb" strokeWidth="1" strokeOpacity="0.3">
        <animate attributeName="r" values="40;55;40" dur="2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="85" r="40" fill="none" stroke="#53bdeb" strokeWidth="1" strokeOpacity="0.2">
        <animate attributeName="r" values="40;65;40" dur="2s" repeatCount="indefinite" begin="0.5s" />
        <animate attributeName="stroke-opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" begin="0.5s" />
      </circle>

      {/* Status text */}
      <text x="100" y="145" textAnchor="middle" fill="#53bdeb" fontSize="11" fontWeight="700" fontFamily="system-ui">
        BOT ACTIVO
      </text>
      <text x="100" y="158" textAnchor="middle" fill="white" fontSize="6" fillOpacity="0.5" fontFamily="system-ui">
        Respondiendo 24/7
      </text>

      {/* Mini messages */}
      <rect x="30" y="165" width="35" height="12" rx="4" fill="#1f2c33" />
      <rect x="35" y="169" width="15" height="3" rx="1.5" fill="white" fillOpacity="0.3" />

      <rect x="135" y="165" width="35" height="12" rx="4" fill="#005c4b" />
      <rect x="140" y="169" width="18" height="3" rx="1.5" fill="white" fillOpacity="0.3" />

      {/* Status dots */}
      <circle cx="82" cy="185" r="3" fill="#00a884" />
      <text x="88" y="187" fill="white" fontSize="5" fillOpacity="0.4" fontFamily="system-ui">online</text>
    </svg>
  );
}

// ===== FEATURE: Auto Responses =====
export function FeatureAutoResponses() {
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" fill="none">
      <rect width="240" height="160" rx="12" fill="#111b21" />

      {/* Incoming */}
      <rect x="20" y="20" width="100" height="32" rx="8" fill="#1f2c33" />
      <rect x="30" y="30" width="60" height="5" rx="2.5" fill="white" fillOpacity="0.3" />
      <rect x="30" y="38" width="40" height="4" rx="2" fill="white" fillOpacity="0.2" />

      {/* Arrow */}
      <path d="M130 36 L150 36" stroke="#00a884" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="155" cy="36" r="3" fill="#00a884" fillOpacity="0.3" />

      {/* Bot reply */}
      <rect x="120" y="60" width="100" height="32" rx="8" fill="#005c4b" />
      <rect x="130" y="70" width="70" height="5" rx="2.5" fill="white" fillOpacity="0.3" />
      <rect x="130" y="78" width="50" height="4" rx="2" fill="white" fillOpacity="0.2" />

      {/* Rules list */}
      <rect x="20" y="105" width="200" height="45" rx="8" fill="#1f2c33" stroke="#00a884" strokeWidth="0.5" strokeOpacity="0.2" />
      <rect x="30" y="115" width="50" height="5" rx="2.5" fill="#00a884" fillOpacity="0.4" />
      <rect x="90" y="115" width="3" height="14" rx="1.5" fill="#00a884" fillOpacity="0.3" />
      <rect x="100" y="115" width="50" height="5" rx="2.5" fill="white" fillOpacity="0.2" />
      <rect x="100" y="125" width="35" height="4" rx="2" fill="white" fillOpacity="0.15" />

      <rect x="30" y="132" width="40" height="5" rx="2.5" fill="#e6a44e" fillOpacity="0.4" />
      <rect x="100" y="132" width="45" height="5" rx="2.5" fill="white" fillOpacity="0.2" />
    </svg>
  );
}

// ===== FEATURE: Multi-user =====
export function FeatureMultiUser() {
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" fill="none">
      <rect width="240" height="160" rx="12" fill="#111b21" />

      {/* Admin */}
      <rect x="80" y="10" width="80" height="50" rx="10" fill="#1f2c33" stroke="#00a884" strokeWidth="1" />
      <circle cx="105" cy="28" r="8" fill="#00a884" fillOpacity="0.2" />
      <text x="105" y="31" textAnchor="middle" fill="#00a884" fontSize="8" fontWeight="600" fontFamily="system-ui">A</text>
      <rect x="120" y="23" width="25" height="4" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="120" y="30" width="18" height="3" rx="1.5" fill="#00a884" fillOpacity="0.4" />
      <rect x="90" y="42" width="60" height="8" rx="4" fill="#00a884" fillOpacity="0.15" />

      {/* Lines to users */}
      <path d="M105 60 L60 80" stroke="#00a884" strokeWidth="1" strokeOpacity="0.3" />
      <path d="M105 60 L120 80" stroke="#00a884" strokeWidth="1" strokeOpacity="0.3" />
      <path d="M105 60 L180 80" stroke="#00a884" strokeWidth="1" strokeOpacity="0.3" />

      {/* Users */}
      {[
        { x: 25, color: "#53bdeb", letter: "J" },
        { x: 85, color: "#e6a44e", letter: "M" },
        { x: 145, color: "#00a884", letter: "L" },
      ].map((user) => (
        <g key={user.letter}>
          <rect x={user.x} y="80" width="70" height="40" rx="8" fill="#1f2c33" />
          <circle cx={user.x + 15} cy="95" r="7" fill={user.color} fillOpacity="0.2" />
          <text x={user.x + 15} y="98" textAnchor="middle" fill={user.color} fontSize="7" fontWeight="600" fontFamily="system-ui">
            {user.letter}
          </text>
          <rect x={user.x + 28} y="91" width="25" height="3" rx="1.5" fill="white" fillOpacity="0.2" />
          <rect x={user.x + 28} y="97" width="18" height="3" rx="1.5" fill="white" fillOpacity="0.15" />
          <rect x={user.x + 10} y="108" width="50" height="6" rx="3" fill={user.color} fillOpacity="0.15" />
        </g>
      ))}

      {/* WhatsApp icons */}
      {[30, 100, 170].map((x) => (
        <g key={x}>
          <rect x={x} y="130" width="30" height="20" rx="6" fill="#1f2c33" stroke="#00a884" strokeWidth="0.5" strokeOpacity="0.3" />
          <circle cx={x + 15} cy="140" r="5" fill="#00a884" fillOpacity="0.15" />
        </g>
      ))}
    </svg>
  );
}

// ===== FEATURE: Analytics =====
export function FeatureAnalytics() {
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" fill="none">
      <rect width="240" height="160" rx="12" fill="#111b21" />

      {/* Chart area */}
      <rect x="20" y="20" width="200" height="100" rx="8" fill="#1f2c33" />

      {/* Grid lines */}
      {[40, 60, 80, 100].map((y) => (
        <line key={y} x1="30" y1={y} x2="210" y2={y} stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
      ))}

      {/* Bar chart */}
      {[
        { x: 40, h: 30, color: "#00a884" },
        { x: 60, h: 50, color: "#00a884" },
        { x: 80, h: 40, color: "#00a884" },
        { x: 100, h: 65, color: "#00a884" },
        { x: 120, h: 55, color: "#00a884" },
        { x: 140, h: 70, color: "#00a884" },
        { x: 160, h: 80, color: "#00a884" },
        { x: 180, h: 60, color: "#00a884" },
      ].map((bar, i) => (
        <rect key={i} x={bar.x} y={100 - bar.h} width="14" height={bar.h} rx="3" fill={bar.color} fillOpacity="0.6">
          <animate attributeName="height" values={`0;${bar.h}`} dur="0.8s" fill="freeze" begin={`${i * 0.1}s`} />
          <animate attributeName="y" values={`100;${100 - bar.h}`} dur="0.8s" fill="freeze" begin={`${i * 0.1}s`} />
        </rect>
      ))}

      {/* Stats */}
      <rect x="25" y="130" width="60" height="20" rx="6" fill="#1f2c33" stroke="#00a884" strokeWidth="0.5" />
      <text x="35" y="143" fill="#00a884" fontSize="8" fontWeight="700" fontFamily="system-ui">247</text>
      <text x="55" y="143" fill="white" fontSize="5" fillOpacity="0.4" fontFamily="system-ui">mensajes</text>

      <rect x="90" y="130" width="60" height="20" rx="6" fill="#1f2c33" stroke="#e6a44e" strokeWidth="0.5" />
      <text x="100" y="143" fill="#e6a44e" fontSize="8" fontWeight="700" fontFamily="system-ui">89%</text>
      <text x="120" y="143" fill="white" fontSize="5" fillOpacity="0.4" fontFamily="system-ui">match</text>

      <rect x="155" y="130" width="60" height="20" rx="6" fill="#1f2c33" stroke="#53bdeb" strokeWidth="0.5" />
      <text x="165" y="143" fill="#53bdeb" fontSize="8" fontWeight="700" fontFamily="system-ui">24/7</text>
      <text x="185" y="143" fill="white" fontSize="5" fillOpacity="0.4" fontFamily="system-ui">activo</text>
    </svg>
  );
}

// ===== FEATURE: Security =====
export function FeatureSecurity() {
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" fill="none">
      <rect width="240" height="160" rx="12" fill="#111b21" />

      {/* Shield */}
      <path d="M120 20 L160 40 L160 80 Q160 120 120 140 Q80 120 80 80 L80 40 Z" fill="#00a884" fillOpacity="0.1" stroke="#00a884" strokeWidth="1.5" />
      <path d="M120 35 L148 50 L148 78 Q148 108 120 125 Q92 108 92 78 L92 50 Z" fill="#00a884" fillOpacity="0.05" />

      {/* Lock icon */}
      <rect x="108" y="70" width="24" height="18" rx="4" fill="#00a884" fillOpacity="0.3" stroke="#00a884" strokeWidth="1" />
      <path d="M112 70 L112 62 Q112 55 120 55 Q128 55 128 62 L128 70" stroke="#00a884" strokeWidth="1.5" fill="none" />
      <circle cx="120" cy="78" r="2.5" fill="#00a884" />
      <line x1="120" y1="80" x2="120" y2="84" stroke="#00a884" strokeWidth="1.5" />

      {/* Checkmarks */}
      {[
        { x: 40, y: 50, text: "Encriptado" },
        { x: 40, y: 70, text: "Privado" },
        { x: 40, y: 90, text: "RLS activo" },
        { x: 165, y: 50, text: "Rate limit" },
        { x: 165, y: 70, text: "Auth JWT" },
        { x: 165, y: 90, text: "Webhook HMAC" },
      ].map((item) => (
        <g key={item.text}>
          <circle cx={item.x} cy={item.y} r="4" fill="#00a884" fillOpacity="0.2" />
          <path d={`M${item.x - 2} ${item.y} L${item.x} ${item.y + 2} L${item.x + 3} ${item.y - 2}`} stroke="#00a884" strokeWidth="1" fill="none" />
          <text x={item.x + 10} y={item.y + 3} fill="white" fontSize="6" fillOpacity="0.5" fontFamily="system-ui">{item.text}</text>
        </g>
      ))}
    </svg>
  );
}
