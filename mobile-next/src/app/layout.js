import "./globals.css";

export const metadata = {
  title: "WTK Ticket · Next",
  description: "War Tiket Konser — client Next.js ke API monolit",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <div className="mx-auto min-h-dvh max-w-lg px-3 pb-10 pt-3">
          <header className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-sky-400">
                WTK Ticket
              </p>
              <h1 className="text-lg font-extrabold">Open Concert · Next.js</h1>
            </div>
            <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-400">
              mobile-next
            </span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
