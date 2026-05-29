import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button variant="outlinePrimary" size="icon" onClick={toggleTheme}>
      {theme === "dark" ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
    </Button>
  );
}
