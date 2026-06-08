import Navbar from "@/components/intro/Navbar";
import HeroSection from "@/components/intro/HeroSection";
import AboutSection from "@/components/intro/AboutSection";
import ProgramsSection from "@/components/intro/ProgramsSection";
import FeaturesSection from "@/components/intro/FeaturesSection";
import FacultySection from "@/components/intro/FacultySection";
import ContactSection from "@/components/intro/ContactSection";
import Footer from "@/components/intro/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <AboutSection />
      <ProgramsSection />
      <FeaturesSection />
      <FacultySection />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
