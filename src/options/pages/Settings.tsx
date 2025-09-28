import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ThemeMode } from "@/extension/types";
import {
  Settings as SettingsIcon,
  Power,
  PowerOff,
  Palette,
  Server,
  Shield,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sun,
  Moon,
  Monitor,
  Globe,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react";
import { useEffect, useState } from "react";

export function SettingsPage(props: {
  autsEnabled: boolean;
  autsServer?: string;
  autsTheme: ThemeMode;
  autsVisualIndicator?: boolean;
  onChangeEnabled(next: boolean): void;
  onChangeServer(next: string): void;
  onChangeTheme(next: ThemeMode): void;
  onChangeVisualIndicator?(next: boolean): void;
  onDisableAll(): void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);

  // Load auts_auto_update from sync storage
  useEffect(() => {
    chrome.storage.sync.get({ auts_auto_update: true }, (d) => {
      setAutoUpdate(Boolean(d.auts_auto_update));
    });
  }, []);

  const getThemeIcon = (theme: ThemeMode) => {
    switch (theme) {
      case 'light': return <Sun className="w-4 h-4" />;
      case 'dark': return <Moon className="w-4 h-4" />;
      case 'system': return <Monitor className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const exportConfig = () => {
    const config = {
      autsEnabled: props.autsEnabled,
      autsServer: props.autsServer,
      autsTheme: props.autsTheme,
      autsVisualIndicator: props.autsVisualIndicator,
      exportedAt: new Date().toISOString(),
      version: "1.0"
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auts-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const config = JSON.parse(e.target?.result as string);
            if (config.autsEnabled !== undefined) props.onChangeEnabled(config.autsEnabled);
            if (config.autsServer !== undefined) props.onChangeServer(config.autsServer);
            if (config.autsTheme !== undefined) props.onChangeTheme(config.autsTheme);
            if (config.autsVisualIndicator !== undefined && props.onChangeVisualIndicator) {
              props.onChangeVisualIndicator(config.autsVisualIndicator);
            }
          } catch (err) {
            console.error('Failed to import config:', err);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          系统设置
        </h1>
        <p className="text-muted-foreground">
          配置 Auts 的全局设置和首选项
        </p>
      </div>

      {/* Global Control */}
      <div className="bg-card border rounded-xl p-8">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              props.autsEnabled 
                ? 'bg-green-100 text-green-600' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {props.autsEnabled ? <Power className="w-6 h-6" /> : <PowerOff className="w-6 h-6" />}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold">自动注入控制</h2>
                <p className="text-muted-foreground">
                  控制是否自动执行所有插件
                </p>
              </div>
              <Switch 
                checked={props.autsEnabled} 
                onCheckedChange={props.onChangeEnabled}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            
            {props.autsEnabled ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                <span>自动注入已启用，插件将在匹配的页面上自动运行</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                <Info className="w-4 h-4" />
                <span>自动注入已禁用，所有插件都不会自动执行</span>
              </div>
            )}
            
            {/* Visual Indicator Setting */}
            {props.autsEnabled && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      props.autsVisualIndicator
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {props.autsVisualIndicator ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">视觉指示器</h3>
                      <p className="text-muted-foreground text-xs">
                        为运行脚本的页面添加彩色边框和角标
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={props.autsVisualIndicator || false}
                    onCheckedChange={(checked) => props.onChangeVisualIndicator?.(checked)}
                    className="data-[state=checked]:bg-blue-500"
                  />
                </div>

                {props.autsVisualIndicator && (
                  <div className="mt-3 p-3 bg-background rounded border">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-muted-foreground">默认为绿色，可在脚本设置中自定义颜色</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auto Update Setting */}
            {props.autsEnabled && (
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      autoUpdate ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">自动更新远程脚本</h3>
                      <p className="text-muted-foreground text-xs">在注入前自动拉取 URL 与订阅的最新内容，失败则回退本地缓存</p>
                    </div>
                  </div>
                  <Switch
                    checked={autoUpdate}
                    onCheckedChange={(checked) => {
                      setAutoUpdate(checked);
                      chrome.storage.sync.set({ auts_auto_update: checked }, () => {
                        // Broadcast change
                        chrome.runtime.sendMessage({ type: 'STATE_CHANGED', source: 'options' });
                      });
                    }}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={props.onDisableAll}
                className="gap-2 text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
              >
                <PowerOff className="w-4 h-4" />
                快速禁用所有插件
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-card border rounded-xl p-8">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Palette className="w-6 h-6" />
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-3">外观主题</h2>
            <p className="text-muted-foreground mb-6">
              选择您偏好的界面主题
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => props.onChangeTheme(theme)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    props.autsTheme === theme
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-ring'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {getThemeIcon(theme)}
                    <span className="font-medium capitalize">
                      {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '系统'}
                    </span>
                    {props.autsTheme === theme && (
                      <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {theme === 'light' && '使用浅色主题'}
                    {theme === 'dark' && '使用深色主题'}
                    {theme === 'system' && '跟随系统设置'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Server Settings */}
      <div className="bg-card border rounded-xl p-8">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Server className="w-6 h-6" />
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-3">服务器配置</h2>
            <p className="text-muted-foreground mb-6">
              配置用于服务器类型插件的基础 URL
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="server-url" className="text-sm font-medium">
                  AUTS 服务器地址
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="server-url"
                    value={props.autsServer || ''}
                    onChange={(e) => props.onChangeServer(e.target.value)}
                    placeholder="https://your-auts-server.com"
                    className="pl-10 h-12"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  服务器类型的插件将从此地址获取脚本内容
                </p>
              </div>
              
              {props.autsServer && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>服务器地址已配置</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="bg-card border rounded-xl p-8">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <SettingsIcon className="w-6 h-6" />
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">高级选项</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-muted-foreground"
              >
                {showAdvanced ? '收起' : '展开'}
              </Button>
            </div>
            
            <p className="text-muted-foreground mb-6">
              导入导出配置、清除缓存等高级功能
            </p>

            {showAdvanced && (
              <div className="space-y-6">
                {/* Import/Export */}
                <div className="space-y-4">
                  <h3 className="font-medium">配置管理</h3>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={exportConfig}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      导出配置
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={importConfig}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      导入配置
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    导出当前设置以备份或在其他设备上使用
                  </p>
                </div>

                {/* Cache Management */}
                <div className="space-y-4">
                  <h3 className="font-medium">缓存管理</h3>
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="gap-2 text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
                      onClick={() => {
                        // TODO: Implement cache clearing
                        console.log('Clear cache');
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      清除所有插件缓存
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      清除所有远程插件的缓存数据，下次访问时会重新下载
                    </p>
                  </div>
                </div>

                {/* Security */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    安全选项
                  </h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-800 font-medium mb-1">安全提醒</p>
                        <p className="text-yellow-700 text-sm">
                          用户脚本具有强大的权限，请只从可信来源安装插件。
                          建议定期检查您的插件列表，删除不再需要的插件。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Debug Info */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="font-medium">调试信息</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">扩展版本:</span>
                        <span className="font-mono">1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">用户代理:</span>
                        <span className="font-mono truncate">
                          {navigator.userAgent.split(' ').slice(-2).join(' ')}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">平台:</span>
                        <span className="font-mono">{navigator.platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">语言:</span>
                        <span className="font-mono">{navigator.language}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}