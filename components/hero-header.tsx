import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { TextEffect } from "@/components/ui/text-effect";

export function HeroHeader() {
  return (
    <div className="relative bg-background text-foreground flex flex-col overflow-hidden">
      {/* Non-circular top light beam flare at z-0 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-48 bg-purple-500/25 dark:bg-purple-600/30 blur-3xl rounded-b-[120px] pointer-events-none z-0" />

      {/* Content wrapper sitting at z-10 above glow */}
      <div className="relative z-10">
        {/* Top Navbar */}
        <header className="w-full border-b border-border/40 bg-background/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Orbit Logo"
                width={40}
                height={40}
                className="h-12 w-12 object-contain"
              />
              <span className="font-bold text-lg tracking-tight">Orbit</span>
            </div>

            <nav className="flex items-center gap-3">
              <ModeToggle />
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link href="/getting-started">
                <Button size="sm">Get Started</Button>
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero Content with Animations */}
        <section className="flex flex-col items-center justify-center text-center px-6 py-12 md:py-20 max-w-4xl mx-auto">
          <AnimatedGroup className="flex flex-col items-center justify-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground mb-6">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Orbit v1.0 is ready</span>
            </div>

            {/* Animated Headline */}
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
              <TextEffect>Organize your thoughts with total clarity.</TextEffect>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-8">
              A distraction-free, Notion-style workspace built for notes, notebooks, and seamless organization.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-sm">
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto">Start Notes Free</Button>
              </Link>
              <Link href="https://github.com/volostrs/Orbit" target="_blank">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  View Source
                </Button>
              </Link>
            </div>
          </AnimatedGroup>
        </section>
      </div>
    </div>
  );
}