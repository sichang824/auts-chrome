import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle2, Power, PowerOff } from "lucide-react";

interface GlobalStatusProps {
  autsEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
}

export function GlobalStatus({ autsEnabled, onToggleEnabled }: GlobalStatusProps) {
  return (
    <div className="p-3">
      <div className="bg-card border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                autsEnabled
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {autsEnabled ? (
                <Power className="w-4 h-4" />
              ) : (
                <PowerOff className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="text-sm font-medium leading-tight">自动注入</div>
              <div className="text-xs text-muted-foreground leading-tight">
                {autsEnabled ? "已启用" : "已禁用"}
              </div>
            </div>
          </div>
          <Switch
            checked={autsEnabled}
            onCheckedChange={onToggleEnabled}
            className="data-[state=checked]:bg-green-500"
          />
        </div>

        {autsEnabled ? (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
            <CheckCircle2 className="w-3 h-3" />
            <span>自动注入已启用，匹配的脚本将自动运行</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded">
            <AlertCircle className="w-3 h-3" />
            <span>自动注入已禁用，所有脚本都不会自动执行</span>
          </div>
        )}
      </div>
    </div>
  );
}