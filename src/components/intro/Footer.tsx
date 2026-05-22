import logo from "@/assets/logo.png";
import { Instagram } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary border-t border-forest-light/20 py-12 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RootED Academy" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <span className="font-display text-lg font-bold text-cream">RootED</span>
              <span className="font-display text-lg font-light text-gold ml-1">Academy</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-cream/50">
            <a href="#home" className="hover:text-gold transition-colors">Home</a>
            <a href="#about" className="hover:text-gold transition-colors">About</a>
            <a href="#programs" className="hover:text-gold transition-colors">Programs</a>
            <a href="#faculty" className="hover:text-gold transition-colors">Faculty</a>
            <a href="#contact" className="hover:text-gold transition-colors">Contact</a>
          </div>

          <a
            href="https://instagram.com/root_ed_academy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-cream/50 hover:text-gold transition-colors"
          >
            <Instagram className="w-5 h-5" />
            <span className="text-sm">@root_ed_academy</span>
          </a>
        </div>

        <div className="mt-8 pt-8 border-t border-forest-light/10 text-center">
          <p className="text-sm text-cream/30">
            © {new Date().getFullYear()} RootED Academy. All rights reserved. Where Clarity Begins.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
