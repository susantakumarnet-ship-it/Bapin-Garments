import { useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { waLink } from '../../lib/format';

export function WhatsAppIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.004 3C9.375 3 3.998 8.373 3.998 15.002c0 2.115.553 4.18 1.6 6.002L3.9 27.1l6.27-1.645a12 12 0 0 0 5.832 1.49h.005C22.633 26.945 28 21.572 28 14.943 28 8.315 22.633 3 16.004 3Zm0 21.92h-.004a9.95 9.95 0 0 1-5.072-1.39l-.364-.216-3.721.976.993-3.627-.237-.373a9.93 9.93 0 0 1-1.523-5.288c0-5.49 4.47-9.957 9.966-9.957 2.661 0 5.161 1.037 7.042 2.92a9.89 9.89 0 0 1 2.915 7.04c-.003 5.49-4.47 9.915-9.995 9.915Zm5.463-7.43c-.3-.15-1.774-.875-2.049-.975-.275-.1-.475-.15-.675.15-.2.3-.774.975-.949 1.175-.175.2-.35.225-.65.075-.3-.15-1.266-.467-2.411-1.488-.891-.795-1.493-1.776-1.668-2.076-.175-.3-.019-.462.131-.611.135-.134.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.585-.491-.506-.675-.515l-.575-.01c-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.116 3.231 5.126 4.531.716.309 1.275.494 1.711.632.719.229 1.373.196 1.89.119.577-.086 1.774-.725 2.024-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35Z" />
    </svg>
  );
}

/** Floating click-to-chat button shown on every storefront page. */
export default function WhatsAppFloat() {
  const { settings } = useStore();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHint(true), 4000);
    const t2 = setTimeout(() => setHint(false), 12000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!settings.whatsapp_number) return null;
  const text = `Hello ${settings.store_name}! I'm visiting your website and would like to know more. Page: ${window.location.href}`;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
      <div
        className={`hidden rounded-xl bg-white px-4 py-2.5 text-sm text-navy-800 shadow-xl ring-1 ring-slate-100 transition-all duration-500 sm:block ${
          hint ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'
        }`}
      >
        Need help? <span className="font-semibold text-[#128C7E]">Chat with us!</span>
      </div>
      <a
        href={waLink(settings.whatsapp_number, text)}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg shadow-green-600/30 transition hover:scale-110"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30" />
        <WhatsAppIcon className="relative h-7 w-7" />
      </a>
    </div>
  );
}
