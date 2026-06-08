import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { GraduationCap, Brain, ClipboardCheck, MessageCircleQuestion, Trophy } from "lucide-react";

const FacultySection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const strengths = [
    { icon: GraduationCap, title: "CA-Qualified Mentors", desc: "Learn directly from professionals who understand the CA journey from the inside." },
    { icon: Brain, title: "Concept-Based Teaching", desc: "Clarity, logic, and understanding over rote learning — building strong foundations." },
    { icon: ClipboardCheck, title: "Exam-Oriented Guidance", desc: "Focused preparation for both CA Foundation and Plus One/Plus Two Commerce." },
    { icon: MessageCircleQuestion, title: "Doubt-Clearing Support", desc: "Dedicated sessions ensuring no concept is ever left unresolved." },
    { icon: Trophy, title: "Performance Tracking", desc: "Continuous mock tests to monitor progress and improve exam readiness." },
  ];

  return (
    <section id="faculty" className="section-padding bg-primary relative overflow-hidden" ref={ref}>
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 border border-gold/30 rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 border border-gold/20 rounded-full" />
      </div>

      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-gold">Faculty & Team</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-cream mt-3 mb-6">
            Guided by <span className="text-gradient-gold">Experts</span>
          </h2>
          <p className="text-cream/60 text-lg leading-relaxed">
            Our strength lies in our people — highly qualified Chartered Accountants and subject experts 
            who bring academic depth and real-world experience into every class.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {strengths.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * (i + 1) }}
              className={`p-6 rounded-2xl border border-gold/10 bg-forest-light/20 hover:bg-forest-light/30 transition-all duration-300 ${i === 4 ? "sm:col-span-2 lg:col-span-1" : ""}`}
            >
              <div className="w-12 h-12 rounded-lg bg-gold/10 flex items-center justify-center mb-4">
                <s.icon className="w-6 h-6 text-gold" />
              </div>
              <h4 className="font-display font-bold text-cream text-lg mb-2">{s.title}</h4>
              <p className="text-sm text-cream/50 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* 350+ Success Movement */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative rounded-2xl overflow-hidden"
        >
          <div className="bg-gradient-gold p-[2px] rounded-2xl">
            <div className="bg-primary rounded-2xl p-8 md:p-12 text-center">
              <span className="inline-block text-sm font-bold tracking-[0.3em] uppercase text-gold mb-4">Achievement Initiative</span>
              <h3 className="font-display text-3xl md:text-4xl font-bold text-cream mb-4">
                RootED <span className="text-gradient-gold">Success</span>  Movement
              </h3>
              <p className="text-cream/60 max-w-2xl mx-auto leading-relaxed mb-6">
                A performance-driven initiative recognizing exceptional achievement in the CA Foundation examination. 
                Designed to reward excellence through a strong results-oriented learning culture — reinforcing our 
                confidence in producing top-performing students.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {["Understand Deeply", "Stay Ahead", "Perform Strongly", "Grow Professionally"].map((p) => (
                  <span key={p} className="px-4 py-2 rounded-full bg-gold/10 text-gold border border-gold/20 font-medium">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FacultySection;
