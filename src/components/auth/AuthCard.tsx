import { Sprout } from "lucide-react";
import { ReactNode } from "react";

interface AuthCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthCard({ title = "RootedAcademy", subtitle = "Where Clarity Begins", children }: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <Sprout className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="ra-card p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
