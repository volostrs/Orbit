import { AnimatedGroup } from "@/components/ui/animated-group";
import { TextEffect } from "@/components/ui/text-effect";

export function FeaturesSection() {
  const features = [
    {
      title: "Rich Text Editing",
      description: "Format your notes effortlessly with a clean, distraction-free editor built for focus.",
      icon: (
        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      title: "Notebooks & Folders",
      description: "Group your notes in organized notebooks and navigate quickly with a collapsible sidebar.",
      icon: (
        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      title: "Secure Authentication",
      description: "Keep your notes private with email verification, password reset, and Google OAuth.",
      icon: (
        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      title: "Light & Dark Mode",
      description: "Work comfortably at any time of day with full theme toggle support built right in.",
      icon: (
        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="relative py-16 bg-muted/30 border-t border-border/40 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        {/* Animated Section Header */}
        <AnimatedGroup className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <TextEffect>Everything you need to stay organized</TextEffect>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Designed to help you record ideas, manage notebooks, and boost your daily workflow.
          </p>
        </AnimatedGroup>

        {/* Animated Staggered Grid */}
        <AnimatedGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-background p-6 rounded-xl border border-border/60 shadow-sm hover:shadow-md transition"
            >
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-xl mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </AnimatedGroup>
      </div>
    </section>
  );
}