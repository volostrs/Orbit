import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { TextEffect } from "@/components/ui/text-effect";
import { Glow } from "@/components/ui/glow";

export function CTASection() {
  return (
    <section className="relative py-20 border-t border-border/40 bg-background text-center px-6 overflow-hidden">

      <AnimatedGroup className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          <TextEffect>Ready to streamline your workspace?</TextEffect>
        </h2>

        <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
          Start capturing your thoughts, notes, and projects in one organized space today.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/sign-up">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">Sign In to Your Account</Button>
          </Link>
        </div>
      </AnimatedGroup>
    </section>
  );
}