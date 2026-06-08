import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Phone, Mail, MessageCircle, MapPin, Instagram } from "lucide-react";

const ContactSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const contacts = [
    { icon: Phone, label: "Call Us", value: "+91 7034719720", href: "tel:+917034719720" },
    { icon: MessageCircle, label: "WhatsApp", value: "Chat with us", href: "https://wa.me/917034719720" },
    { icon: Mail, label: "Email", value: "rootedacademy01@gmail.com", href: "mailto:rootedacademy01@gmail.com" },
    { icon: Instagram, label: "Instagram", value: "Check out our page", href: "https://instagram.com/root_ed_academy" },
  ];

  return (
    <section id="contact" className="section-padding bg-background" ref={ref}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold tracking-[0.2em] uppercase text-secondary">Get In Touch</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mt-3 mb-6">
            Start Your <span className="text-gradient-gold">Journey</span> Today
          </h2>
          <p className="text-muted-foreground text-lg">
            Seats are limited. Start early. Stay ahead. Reach out to us for enrollment details.
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-6">
            {contacts.map((c, i) => (
              <motion.a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 * (i + 1) }}
                className="group flex items-center gap-4 p-6 rounded-2xl bg-card border border-border hover:border-secondary/40 hover:shadow-elevated transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <c.icon className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="font-semibold text-foreground">{c.value}</p>
                </div>
              </motion.a>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-8 flex items-center gap-3 justify-center text-muted-foreground"
          >
            <MapPin className="w-4 h-4" />
            <span className="text-sm">Kerala, India</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
