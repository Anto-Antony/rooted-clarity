import { Link } from "react-router-dom";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function ResetSuccess() {
  return (
    <AuthCard>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Password updated</h2>
        <p className="text-sm text-muted-foreground">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Button asChild className="w-full">
          <Link to="/auth">Continue to sign in</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
