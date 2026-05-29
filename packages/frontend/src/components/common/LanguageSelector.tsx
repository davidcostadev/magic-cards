import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === "en" ? "pt" : "en";
    i18n.changeLanguage(next);
  };

  return (
    <Button variant="outlinePrimary" size="icon" onClick={toggleLanguage} title={i18n.language.toUpperCase()}>
      <Globe className="h-6 w-6" />
    </Button>
  );
}
