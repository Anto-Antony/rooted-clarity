import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Target, Lightbulb, TrendingUp } from "lucide-react";

const AboutSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="section-padding bg-background" ref={ref}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-secondary">About Us</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mt-3 mb-6">
            Where <span className="text-gradient-gold">Clarity</span> Begins
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            RootED Academy is a Kerala-based online coaching institute focused on commerce education. 
            We bridge the gap between school-level commerce and CA-level thinking from day one — 
            because education should be about understanding, not stress.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Target,
              title: "Our Mission",
              desc: "To give every student a strong conceptual base from day one, integrating CA Foundation concepts alongside Plus One & Plus Two Commerce — making professional dreams accessible to everyone.",
            },
            {
              icon: Lightbulb,
              title: "Our Philosophy",
              desc: "Most students start CA preparation after +2. We change that. By introducing CA concepts early, students study once and benefit twice — excelling in both board exams and professional courses.",
            },
            {
              icon: TrendingUp,
              title: "Our Promise",
              desc: "Concept-driven, stress-free learning delivered by CA-qualified mentors at an unmatched ₹600/month. We're so confident in our methods, We offer a full refund upon scoring above 350.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.15 * (i + 1) }}
              className="group relative bg-card rounded-2xl p-8 border border-border hover:border-secondary/40 transition-all duration-500 hover:shadow-elevated"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-gold flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <item.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-3">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
