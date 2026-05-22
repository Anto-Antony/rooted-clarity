import { motion } from "framer-motion";
import gsap from "gsap";
import { useEffect, useRef } from "react";

import { useAntigravity } from "../../hooks/animation";

import "../style/athi.css";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
    const canvasRef = useAntigravity();
    const titleRef = useRef(null);
  const subtitleRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(
      titleRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" }
    );

    gsap.fromTo(
      subtitleRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, delay: 0.2 }
    );
  }, []);

  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="w-full h-full object-cover" width={1920} height={1080} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-transparent to-primary" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-gold/5 blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 rounded-full bg-gold/3 blur-3xl" />

      <div className="container mx-auto px-4 md:px-8 relative z-10 pt-28 pb-16">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-2 mb-8"
          >
            <GraduationCap className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-gold">Kerala's Premier Integrated Commerce Academy</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="font-display text-4xl sm:text-5xl md:text-7xl font-bold text-cream leading-tight mb-6"
          >
            Rooting Confidence,{" "}
            <span className="text-gradient-gold">Building Futures</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg md:text-xl text-cream/70 max-w-2xl mb-10 leading-relaxed font-body"
          >
            India's first online and offline academy integrating Plus One & Plus Two Commerce 
            with CA Foundation preparation — taught by expert Chartered Accountants 
            at just <span className="text-gold font-semibold">₹600/month</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 bg-gradient-gold text-primary font-semibold px-8 py-4 rounded-lg text-lg hover:opacity-90 transition-all shadow-gold"
            >
              Start Your Journey
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#programs"
              className="inline-flex items-center justify-center gap-2 border-2 border-gold/30 text-cream font-medium px-8 py-4 rounded-lg text-lg hover:border-gold/60 hover:bg-gold/5 transition-all"
            >
              <BookOpen className="w-5 h-5" />
              Explore Programs
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-3 gap-8 mt-16 pt-10 border-t border-cream/10 max-w-lg"
          >
            {[
              { value: "₹600", label: "Per Month" },
              { value: "100%", label: "Online Classes" },
              { value: "CA", label: "Qualified Faculty" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-2xl md:text-3xl font-bold text-gold">{stat.value}</p>
                <p className="text-sm text-cream/50 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
