import { RobotIcon } from "@/components/icons";

function ChatTail({ from }: { from: "user" | "bot" }) {
  return from === "user" ? (
    <svg
      className="absolute -right-2 top-0 fill-current text-[#005c4b]"
      height="13"
      viewBox="0 0 8 13"
      width="8"
    >
      <path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" fill="currentColor" />
    </svg>
  ) : (
    <svg
      className="absolute -left-2 top-0 fill-current text-[#202c33]"
      height="13"
      viewBox="0 0 8 13"
      width="8"
    >
      <path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" fill="currentColor" />
    </svg>
  );
}

function BotHeader({ title, rightIcons }: { title: string; rightIcons: React.ReactNode }) {
  return (
    <div className="relative z-10 mb-2 flex items-center gap-3 border-b border-white/5 bg-[#202c33] px-4 pb-3 pt-4">
      <div className="relative h-10 w-10 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] shadow-lg">
          <RobotIcon className="h-5 w-5 text-white" />
        </div>
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202c33] bg-whatsapp-green" />
      </div>
      <div className="flex-grow">
        <div className="text-[16px] font-bold leading-tight text-white">{title}</div>
        <div className="text-xs text-text-secondary">en línea</div>
      </div>
      <div className="flex gap-4 text-text-secondary">{rightIcons}</div>
    </div>
  );
}

function ChatInput() {
  return (
    <div className="relative z-10 mt-auto flex items-center gap-2 bg-[#202c33] px-2 py-2">
      <span className="cursor-pointer p-2 text-text-secondary transition-colors hover:text-white">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </span>
      <div className="flex min-h-[40px] flex-grow items-center rounded-full bg-[#2a3942] px-4 py-2">
        <div className="flex-grow text-[14px] text-text-secondary">Mensaje</div>
        <span className="cursor-pointer text-[20px] text-text-secondary">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </span>
      </div>
      <div className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#00a884]">
        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 19v3" />
        </svg>
      </div>
    </div>
  );
}

function BotBubble({
  time,
  children,
  className = "",
}: {
  time: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="relative max-w-[85%] rounded-r-xl rounded-tl-xl bg-[#202c33] p-2 px-3 text-[#e9edef] shadow-sm">
        {children}
        <div className="float-right ml-3 pt-1 text-[10px] text-text-secondary">{time}</div>
        <ChatTail from="bot" />
      </div>
    </div>
  );
}

function UserBubble({
  time,
  children,
  className = "",
}: {
  time: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex justify-end ${className}`}>
      <div className="relative max-w-[85%] rounded-l-xl rounded-tr-xl bg-[#005c4b] p-2 px-3 text-white shadow-sm">
        {children}
        <div className="float-right ml-3 flex items-center gap-1 pt-1 text-[10px] text-white/70">
          {time}
          <svg className="h-3.5 w-3.5 text-[#53bdeb]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
          </svg>
        </div>
        <ChatTail from="user" />
      </div>
    </div>
  );
}

function TypingIndicator({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="relative flex h-[36px] items-center gap-1 rounded-r-xl rounded-tl-xl bg-[#202c33] p-3 text-[#e9edef] shadow-sm">
        <span className="ld-dot ld-animate-typing" />
        <span className="ld-dot ld-animate-typing" />
        <span className="ld-dot ld-animate-typing" />
        <ChatTail from="bot" />
      </div>
    </div>
  );
}

// ===== Chat 1: Auto-responses =====
export function ChatAutoResponses() {
  return (
    <div className="ld-glass-panel ld-animate-float relative flex h-[520px] w-full max-w-[380px] flex-col overflow-hidden rounded-[2.5rem] border-[8px] border-[#172127] bg-[#0b141a] shadow-2xl">
      <div className="ld-chat-bg absolute inset-0 opacity-40" />
      <BotHeader
        title="Mi Boti"
        rightIcons={
          <>
            <svg className="h-5 w-5 cursor-pointer transition-colors hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect width="14" height="14" x="2" y="5" rx="2" />
              <path d="m22 7-6 5 6 5V7Z" />
            </svg>
            <svg className="h-5 w-5 cursor-pointer transition-colors hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </>
        }
      />
      <div className="ld-no-scrollbar relative z-10 flex flex-grow flex-col justify-end space-y-4 overflow-y-auto px-4 py-2 pb-20 text-[14.5px]">
        <UserBubble time="10:23" className="ld-msg-1 ld-animate-message-pop">
          Hola, ¿cuál es el horario?
        </UserBubble>
        <TypingIndicator className="ld-typing-indicator ld-typing-hide" />
        <BotBubble time="10:23" className="ld-msg-2 ld-animate-message-pop">
          Nuestro horario es de lunes a viernes de 9:00 a 18:00 y sábados de 9:00 a 14:00.
        </BotBubble>
        <UserBubble time="10:24" className="ld-msg-3 ld-animate-message-pop">
          ¿Tienen estacionamiento?
        </UserBubble>
        <BotBubble time="10:24" className="ld-msg-4 ld-animate-message-pop">
          ¡Sí! Tenemos estacionamiento gratuito para nuestros clientes.
        </BotBubble>
      </div>
      <ChatInput />
    </div>
  );
}

// ===== Chat 2: Appointments =====
export function ChatAppointments() {
  return (
    <div className="ld-glass-panel ld-animate-float relative flex h-[520px] w-full max-w-[380px] flex-col overflow-hidden rounded-[2.5rem] border-[8px] border-[#172127] bg-[#0b141a] shadow-2xl md:mt-16" style={{ animationDelay: "1.5s" }}>
      <div className="ld-chat-bg absolute inset-0 opacity-40" />
      <BotHeader
        title="Mi Boti Turnos"
        rightIcons={
          <>
            <svg className="h-5 w-5 cursor-pointer transition-colors hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <svg className="h-5 w-5 cursor-pointer transition-colors hover:text-white" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="5.5" r="1.5" />
              <circle cx="12" cy="18.5" r="1.5" />
            </svg>
          </>
        }
      />
      <div className="ld-no-scrollbar relative z-10 flex flex-grow flex-col justify-end space-y-4 overflow-y-auto px-4 py-2 pb-20 text-[14.5px]">
        <UserBubble time="11:45" className="ld-msg-b-1 ld-animate-message-pop">
          Hola, quiero agendar un turno para mañana
        </UserBubble>
        <BotBubble time="11:45" className="ld-msg-b-2 ld-animate-message-pop">
          <div className="px-2 pb-1 pt-1">
            ¡Hola! Claro, tengo estos horarios disponibles para mañana:
          </div>
          <div className="mt-2 cursor-pointer border-t border-white/5 py-2.5 text-center font-medium text-[#53bdeb] transition-colors hover:bg-white/5">
            Confirmar Turno
          </div>
          <div className="cursor-pointer border-t border-white/5 py-2.5 text-center font-medium text-[#53bdeb] transition-colors hover:bg-white/5">
            Ver disponibilidad
          </div>
        </BotBubble>
        <UserBubble time="11:46" className="ld-msg-b-3 ld-animate-message-pop">
          Confirmar Turno
        </UserBubble>
        <BotBubble time="11:46" className="ld-msg-b-4 ld-animate-message-pop">
          ¡Turno confirmado! Te esperamos mañana. ¿Te puedo ayudar con algo más?
        </BotBubble>
      </div>
      <ChatInput />
    </div>
  );
}