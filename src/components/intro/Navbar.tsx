import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone, LogIn } from "lucide-react";
import logo from "@/assets/logo.webp";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Programs", href: "#programs" },
  { label: "Why Us", href: "#features" },
  { label: "Faculty", href: "#faculty" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md border-b border-forest-light/30"
    >
      <div className="container mx-auto flex items-center justify-between py-3 px-4 md:px-8">
        <a href="#home" className="flex items-center gap-3">
          <img src={logo} alt="RootED Academy" className="h-12 w-12 rounded-lg object-cover" />
          <div>
            <span className="font-display text-xl font-bold text-cream">RootED</span>
            <span className="font-display text-xl font-light text-gold ml-1">Academy</span>
            <p className="text-[10px] tracking-[0.2em] uppercase text-gold-light/70">Where Clarity Begins</p>
          </div>
        </a>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-cream/80 hover:text-gold transition-colors duration-300 tracking-wide"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/auth"
            className="flex items-center gap-2 bg-gradient-gold text-primary font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <LogIn className="w-4 h-4" />
            Enrol Now
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden text-cream p-2"
          aria-label="Toggle menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-primary border-t border-forest-light/20"
          >
            <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-cream/80 hover:text-gold transition-colors py-2 font-medium"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/auth"
                className="flex items-center justify-center gap-2 bg-gradient-gold text-primary font-semibold px-5 py-3 rounded-lg mt-2"
              >
                <Login className="w-4 h-4" />
                Enrol Now
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
