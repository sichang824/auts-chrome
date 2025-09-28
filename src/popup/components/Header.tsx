import { Button } from "@/components/ui/button";
import { Code2, Settings as SettingsIcon } from "lucide-react";

interface HeaderProps {
  onOpenOptions: () => void;
}

export function Header({ onOpenOptions }: HeaderProps) {
  return (
    <div className="bg-card border-b p-3 fixed top-0 left-0 right-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
            <Code2 className="w-3 h-3 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Auts</h1>
            <p className="text-xs text-muted-foreground leading-tight">用户脚本管理器</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenOptions}
          className="gap-1 h-7 px-2"
        >
          <SettingsIcon className="w-3 h-3" />
          <span className="text-xs">设置</span>
        </Button>
      </div>
    </div>
  );
}