import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="w-full py-16 md:py-24 lg:py-32 flex flex-col items-center justify-center text-center px-4 md:px-6">
      <div className="space-y-4 max-w-3xl">
        <div className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
          ✨ Welcome to Orbit
        </div>
        <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
          Your modern workspace for thoughts & notes.
        </h1>
        <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
          A seamless Notion-style app built to organize your notebooks, capture ideas, and boost productivity.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        <Link href="/sign-in">
        <Button size="lg">
          Get Started Free
        </Button>
        </Link>
        <Button variant="outline" size="lg">
          <Link href="https://github.com/volostrs/Orbit" target="_blank">
            View Source Code
          </Link>
        </Button>
      </div>
    </section>
  );
}