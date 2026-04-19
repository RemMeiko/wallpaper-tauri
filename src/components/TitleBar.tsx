import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export function TitleBar() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-semibold tracking-tight">壁纸搜索</h1>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  );
}
