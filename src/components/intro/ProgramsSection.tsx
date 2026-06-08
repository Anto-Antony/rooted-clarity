import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { BookOpen, Clock, IndianRupee, Monitor, FileText, Users } from "lucide-react";

const ProgramsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    { icon: BookOpen, title: "Integrated Curriculum", desc: "All core +1/+2 Commerce subjects combined with CA/CMA Foundation topics" },
    { icon: Monitor, title: "Online and Offline Mode", desc: "Offline class and live interactive sessions, recorded lectures, and digital study materials" },
    { icon: Clock, title: "Flexible Schedule", desc: "1-hour sessions, 3 days a week — balanced with school studies" },
    { icon: IndianRupee, title: "Just ₹600/month", desc: "Making professional dreams accessible to every student" },
    { icon: FileText, title: "Mock Tests", desc: "Regular assessments to track progress and improve exam readiness" },
    { icon: Users, title: "Doubt Clearing", desc: "Dedicated sessions so no concept is ever left unresolved" },
  ];

  return (
    <section id="programs" className="section-padding bg-primary relative overflow-hidden" ref={ref}>
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-gold/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-gold/3 blur-3xl" />

      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-gold">Our Program</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-cream mt-3 mb-6">
            Integrated Commerce <span className="text-gradient-gold">Program</span>
          </h2>
          <p className="text-cream/60 text-lg leading-relaxed">
            A smarter way to learn — combining +1/+2 Commerce with CA Foundation preparation. 
            Study once. Benefit twice.
          </p>
        </motion.div>

        {/* Subjects covered */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="bg-forest-light/40 backdrop-blur-sm rounded-2xl border border-gold/10 p-8 md:p-10 mb-12"
        >
          <h3 className="font-display text-xl font-bold text-gold mb-4">Subjects Covered</h3>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 w-full max-w-3xl mx-auto text-center">
  {["Accounting", "Business Economics", "Business Mathematics", "Business Law"].map((s) => (
    <span
      key={s}
      className="px-6 py-2 rounded-full bg-gold/10 text-cream/80 text-sm font-medium border border-gold/15 whitespace-nowrap"
    >
      {s}
    </span>
  ))}
</div>
        </motion.div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * (i + 1) }}
              className="group flex gap-4 p-6 rounded-xl bg-forest-light/20 border border-gold/5 hover:border-gold/20 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0 group-hover:bg-gold/20 transition-colors">
                <f.icon className="w-6 h-6 text-gold" />
              </div>
              <div>
                <h4 className="font-display font-bold text-cream mb-1">{f.title}</h4>
                <p className="text-sm text-cream/50 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
