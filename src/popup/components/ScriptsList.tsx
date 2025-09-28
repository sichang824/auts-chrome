import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Play } from "lucide-react";

interface Script {
  id: string;
  name?: string;
  enabled: boolean;
  sourceType: 'inline' | 'url' | 'server';
}

interface ScriptsListProps {
  matchingScripts: Script[];
  onToggleScriptEnabled: (scriptId: string, enabled: boolean) => void;
  onTestRunScript: (script: Script) => void;
  onOpenScriptDetails: (scriptId: string) => void;
}

export function ScriptsList({
  matchingScripts,
  onToggleScriptEnabled,
  onTestRunScript,
  onOpenScriptDetails,
}: ScriptsListProps) {
  if (matchingScripts.length === 0) {
    return null;
  }

  const getSourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'inline': return 'Inline Script';
      case 'url': return 'URL Script';
      case 'server': return 'Server Script';
      default: return 'Unknown';
    }
  };

  return (
    <div className="px-3 pb-2">
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">当前页面脚本</div>

        <div className="space-y-1">
          {matchingScripts.map((script) => (
            <div
              key={script.id}
              className="bg-card border rounded-lg p-2"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-2 h-2 rounded-full ${
                    script.enabled ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate leading-tight">
                      {script.name || script.id}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      {getSourceTypeLabel(script.sourceType)}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={script.enabled}
                  onCheckedChange={(checked) => onToggleScriptEnabled(script.id, checked)}
                  className="data-[state=checked]:bg-green-500 scale-75"
                />
              </div>

              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTestRunScript(script)}
                  className="flex-1 gap-1 text-xs h-6"
                  disabled={!script.enabled}
                >
                  <Play className="w-3 h-3" />
                  测试运行
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenScriptDetails(script.id)}
                  className="px-2 text-xs h-6"
                >
                  详情
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}