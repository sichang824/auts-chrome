import { Button } from "@/components/ui/button";
import { Play, Plus, RefreshCw } from "lucide-react";

interface QuickActionsProps {
  autsEnabled: boolean;
  activeUrl: string;
  onCreateScript: () => void;
  onRunNow: () => void;
  onReloadTab: () => void;
}

export function QuickActions({
  autsEnabled,
  activeUrl,
  onCreateScript,
  onRunNow,
  onReloadTab,
}: QuickActionsProps) {
  return (
    <div className="bg-background border-t p-3 fixed bottom-0 left-0 right-0 z-10">
      <div className="space-y-2">
        <Button
          size="sm"
          onClick={onCreateScript}
          className="w-full gap-1 bg-blue-600 hover:bg-blue-700 h-8"
          disabled={!activeUrl || activeUrl === ""}
        >
          <Plus className="w-3 h-3" />
          <span className="text-xs">为当前页面创建脚本</span>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            onClick={onRunNow}
            disabled={!autsEnabled}
            className="gap-1 h-7"
          >
            <Play className="w-3 h-3" />
            <span className="text-xs">立即运行</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onReloadTab}
            className="gap-1 h-7"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="text-xs">刷新页面</span>
          </Button>
        </div>
      </div>
    </div>
  );
}