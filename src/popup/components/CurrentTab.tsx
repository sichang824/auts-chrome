import { Globe, Hash } from "lucide-react";

interface CurrentTabProps {
  activeUrl: string;
  scriptCount: number;
  totalScripts: number;
  getDomain: (url: string) => string;
}

export function CurrentTab({
  activeUrl,
  scriptCount,
  totalScripts,
  getDomain,
}: CurrentTabProps) {
  return (
    <div className="px-3 pb-3">
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Globe className="w-3 h-3" />
          <span>当前标签页</span>
        </div>

        <div className="bg-muted rounded-lg p-2">
          <div
            className="text-sm font-medium truncate leading-tight"
            title={activeUrl}
          >
            {getDomain(activeUrl) || "未知页面"}
          </div>
          <div
            className="text-xs text-muted-foreground truncate leading-tight"
            title={activeUrl}
          >
            {activeUrl || "无法获取页面地址"}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">已启用脚本:</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">{scriptCount}</span>
            <span className="text-muted-foreground">/ {totalScripts}</span>
          </div>
        </div>
      </div>
    </div>
  );
}