export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        body > header { display: none !important; }
        body > footer { display: none !important; }
        body > main  { height: 100dvh; overflow: hidden; }
        @keyframes slideLeft  { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes slideRight { from { transform: translateX(-50%) } to { transform: translateX(0) } }
      `}} />
      {children}
    </>
  );
}
