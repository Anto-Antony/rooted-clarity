import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Shield, Sparkles, Heart, Award } from "lucide-react";

const FeaturesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      icon: Sparkles,
      title: "Early CA-Level Clarity",
      desc: "Introducing CA/CMA concepts alongside school syllabus reduces post-12th pressure and gives students a significant head start over peers.",
      highlight: "Study once. Benefit twice.",
    },
    {
      icon: Shield,
      title: "Expert CA Faculty",
      desc: "Every instructor is a qualified Chartered Accountant bringing real-world experience and deep conceptual instruction into every class.",
      highlight: "Learn from the best.",
    },
    {
      icon: Heart,
      title: "Stress-Free Learning",
      desc: "Our student-centric approach focuses on confidence-building, concept mastery, and individualized support — never rote memorization.",
      highlight: "Education without anxiety.",
    },
    {
      icon: Award,
      title: "100% Refund Guarantee",
      desc: "Score above 350? We refund your entire tuition. That's how confident we are in our teaching methods and your potential.",
      highlight: "Our confidence in you.",
    },
  ];

  return (
    <section id="features" className="section-padding bg-background" ref={ref}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-secondary">Why Choose Us</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mt-3 mb-6">
            The RootED <span className="text-gradient-gold">Advantage</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            What makes us different from every other coaching institute in Kerala.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.12 * (i + 1) }}
              className="group relative bg-card rounded-2xl p-8 border border-border hover:border-secondary/30 transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-secondary/5 to-transparent rounded-bl-full" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mb-6">
                  <f.icon className="w-7 h-7 text-gold" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">{f.desc}</p>
                <p className="text-sm font-semibold text-secondary italic">"{f.highlight}"</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
