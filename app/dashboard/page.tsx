export default function Home() {
  return (
    
    <div className="min-h-screen flex flex-col justify-between">
      <main>
        <div>dashboard stuff</div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/40">
        © {new Date().getFullYear()} Orbit. Built with Next.js & Shadcn UI.
      </footer>
    </div>
  );
}