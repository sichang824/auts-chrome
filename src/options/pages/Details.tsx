import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AutsPlugin as Plugin } from "@/extension/types";
import { 
  ArrowLeft, 
  Edit3, 
  Play, 
  Trash2, 
  Globe, 
  Code2, 
  Server, 
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Download
} from "lucide-react";
import { useState } from "react";
import { UpdatePluginButton } from "../components/UpdatePluginButton";

export function DetailsPage(props: {
  plugin: Plugin | undefined;
  serverBase?: string;
  onBack(): void;
  onToggle(enabled: boolean): void;
  onRemove(): void;
}) {
  const [showFullContent, setShowFullContent] = useState(false);
  
  const plugin = props.plugin;
  
  if (!plugin) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">插件未找到</h2>
          <p className="text-muted-foreground mb-6">
            请求的插件不存在或已被删除
          </p>
          <Button onClick={props.onBack} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回插件列表
          </Button>
        </div>
      </div>
    );
  }

  const getSourceIcon = (sourceType: Plugin['sourceType']) => {
    switch (sourceType) {
      case 'inline': return <Code2 className="w-5 h-5" />;
      case 'url': return <Globe className="w-5 h-5" />;
      case 'server': return <Server className="w-5 h-5" />;
      default: return <Code2 className="w-5 h-5" />;
    }
  };

  const getSourceColor = (sourceType: Plugin['sourceType']) => {
    switch (sourceType) {
      case 'inline': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'url': return 'text-green-600 bg-green-50 border-green-200';
      case 'server': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const href = plugin.sourceType === 'url' ? 
    (typeof plugin.url === 'string' ? plugin.url : plugin.url?.href) : undefined;
  const scriptId = plugin.sourceType === 'server' ? plugin.server?.scriptId : undefined;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={props.onBack}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>插件详情</span>
        </div>
      </div>

      {/* Plugin Header */}
      <div className="bg-card border rounded-xl p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="relative">
              {plugin.iconUrl ? (
                <img 
                  src={plugin.iconUrl} 
                  className="w-16 h-16 rounded-xl shadow-md" 
                  alt="Plugin icon" 
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2">
                  {getSourceIcon(plugin.sourceType)}
                </div>
              )}
              {plugin.enabled ? (
                <div className="absolute -bottom-1 -right-1 p-1 bg-green-500 rounded-full shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div className="absolute -bottom-1 -right-1 p-1 bg-gray-400 rounded-full shadow-lg">
                  <XCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h1 className="text-2xl font-bold mb-2">{plugin.name || plugin.id}</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    {plugin.version && (
                      <span className="text-sm px-3 py-1 bg-secondary rounded-full font-mono">
                        v{plugin.version}
                      </span>
                    )}
                    <span className={`text-sm px-3 py-1 rounded-full border font-medium ${getSourceColor(plugin.sourceType)}`}>
                      {getSourceIcon(plugin.sourceType)}
                      <span className="ml-2">{plugin.sourceType}</span>
                    </span>
                    <span className={`text-sm px-3 py-1 rounded-full ${
                      plugin.enabled 
                        ? 'text-green-700 bg-green-50 border-green-200' 
                        : 'text-gray-700 bg-gray-50 border-gray-200'
                    }`}>
                      {plugin.enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                </div>
              </div>
              
              {plugin.homepageUrl && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink className="w-4 h-4" />
                  <a 
                    href={plugin.homepageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    查看主页
                  </a>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Switch 
              checked={plugin.enabled} 
              onCheckedChange={props.onToggle}
              className="data-[state=checked]:bg-green-500"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3 pt-4 border-t">
          {plugin.sourceType === 'inline' && (
            <Button asChild className="gap-2">
              <a href={`#/plugin/${encodeURIComponent(plugin.id)}/edit`}>
                <Edit3 className="w-4 h-4" />
                编辑代码
              </a>
            </Button>
          )}
          
          <Button 
            variant="outline"
            className="gap-2"
            onClick={() => chrome.runtime.sendMessage({ type: 'RUN_NOW' })}
          >
            <Play className="w-4 h-4" />
            立即运行
          </Button>
          
          {(plugin.sourceType === 'url' || plugin.sourceType === 'server') && (
            <UpdatePluginButton plugin={plugin} serverBase={props.serverBase} variant="outline" size="default" className="gap-2" />
          )}
          
          <Button 
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => copyToClipboard(plugin.id)}
          >
            <Copy className="w-4 h-4" />
          </Button>
          
          <div className="flex-1" />
          
          {!plugin.cache?.subscriptionId && (
            <Button 
              variant="destructive"
              className="gap-2"
              onClick={props.onRemove}
            >
              <Trash2 className="w-4 h-4" />
              删除插件
            </Button>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meta Information */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            基本信息
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <span className="text-muted-foreground">插件ID:</span>
              <span className="col-span-2 font-mono text-xs bg-muted px-2 py-1 rounded">
                {plugin.id}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <span className="text-muted-foreground">创建时间:</span>
              <span className="col-span-2">{formatDate(plugin.createdAt)}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <span className="text-muted-foreground">更新时间:</span>
              <span className="col-span-2">{formatDate(plugin.updatedAt)}</span>
            </div>
            
            {plugin.matches && plugin.matches.length > 0 && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <span className="text-muted-foreground">匹配规则:</span>
                <div className="col-span-2 space-y-1">
                  {plugin.matches.map((match, index) => (
                    <div key={index} className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {match}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Source Information */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {getSourceIcon(plugin.sourceType)}
            源代码信息
          </h2>
          
          <div className="space-y-4">
            {plugin.sourceType === 'inline' && plugin.inline && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    代码大小: {plugin.inline.content.length} 字符
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowFullContent(!showFullContent)}
                  >
                    {showFullContent ? '收起' : '展开'}
                  </Button>
                </div>
                <pre className={`text-xs font-mono bg-muted p-3 rounded-lg overflow-auto ${
                  showFullContent ? 'max-h-96' : 'max-h-32'
                } transition-all`}>
                  {plugin.inline.content}
                </pre>
              </div>
            )}
            
            {plugin.sourceType === 'url' && href && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <span className="text-muted-foreground">URL:</span>
                  <div className="col-span-2">
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {href}
                    </a>
                  </div>
                </div>
                
                {plugin.url && typeof plugin.url === 'object' && plugin.url.etag && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <span className="text-muted-foreground">ETag:</span>
                    <span className="col-span-2 font-mono text-xs bg-muted px-2 py-1 rounded">
                      {plugin.url.etag}
                    </span>
                  </div>
                )}
                
                {plugin.cache?.lastFetchedAt && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <span className="text-muted-foreground">最后获取:</span>
                    <span className="col-span-2">{formatDate(plugin.cache.lastFetchedAt)}</span>
                  </div>
                )}
              </div>
            )}
            
            {plugin.sourceType === 'server' && scriptId && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <span className="text-muted-foreground">服务器:</span>
                  <span className="col-span-2">{props.serverBase || '未配置'}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <span className="text-muted-foreground">脚本ID:</span>
                  <span className="col-span-2 font-mono text-xs bg-muted px-2 py-1 rounded">
                    {scriptId}
                  </span>
                </div>
                
                {plugin.server?.licenseKey && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <span className="text-muted-foreground">许可证:</span>
                    <span className="col-span-2 font-mono text-xs bg-muted px-2 py-1 rounded">
                      ••••••••••••••••
                    </span>
                  </div>
                )}
                
                {plugin.cache?.lastFetchedAt && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <span className="text-muted-foreground">最后同步:</span>
                    <span className="col-span-2">{formatDate(plugin.cache.lastFetchedAt)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cache Information (if available) */}
      {plugin.cache && (
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download className="w-5 h-5" />
            缓存信息
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plugin.cache.version && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">缓存版本</span>
                <span className="font-mono text-sm">{plugin.cache.version}</span>
              </div>
            )}
            
            {plugin.cache.sha256 && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">SHA256</span>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                  {plugin.cache.sha256.slice(0, 16)}...
                </span>
              </div>
            )}
            
            {plugin.cache.lastFetchedAt && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">获取时间</span>
                <span className="text-sm">{formatDate(plugin.cache.lastFetchedAt)}</span>
              </div>
            )}
            
            {plugin.cache.expiresAt && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">过期时间</span>
                <span className="text-sm">{formatDate(plugin.cache.expiresAt)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}