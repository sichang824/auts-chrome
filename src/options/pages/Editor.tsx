import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Plugin } from "../store";
import { nowMs } from "../store";
import { parseUserScriptMeta } from "@/lib/userscript_parser";
import { normalizePatterns } from "@/lib/url_matcher";
import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Code2, 
  Settings, 
  Play,
  RotateCcw,
  FileText,
  Hash,
  Globe,
  AlertCircle,
  Copy,
  Download
} from "lucide-react";

export function EditorPage(props: {
  plugin: Plugin | undefined;
  onSave(next: Plugin): void;
  onBack(): void;
}) {
  const plugin = props.plugin;
  const [name, setName] = useState<string>(plugin?.name || "");
  const [version, setVersion] = useState<string>(plugin?.version || "");
  const [content, setContent] = useState<string>(plugin?.inline?.content || "");
  const [matches, setMatches] = useState<string>((plugin?.matches || []).join("\n"));
  const [homepageUrl, setHomepageUrl] = useState<string>(plugin?.homepageUrl || "");
  const [hasChanges, setHasChanges] = useState(false);
  const [hasInlineMatches, setHasInlineMatches] = useState<boolean>(false);
  const [parsedInlineMatches, setParsedInlineMatches] = useState<string[]>([]);

  useEffect(() => {
    if (plugin) {
      setName(plugin.name || "");
      setVersion(plugin.version || "");
      setContent(plugin.inline?.content || "");
      setMatches((plugin.matches || []).join("\n"));
      setHomepageUrl(plugin.homepageUrl || "");
      setHasChanges(false);
      const meta = parseUserScriptMeta(plugin.inline?.content || "");
      setHasInlineMatches(meta.matches.length > 0);
      setParsedInlineMatches(meta.matches);
    }
  }, [plugin?.id]);

  useEffect(() => {
    if (plugin) {
      const hasNameChange = name !== (plugin.name || "");
      const hasVersionChange = version !== (plugin.version || "");
      const hasContentChange = content !== (plugin.inline?.content || "");
      const hasMatchesChange = matches !== (plugin.matches || []).join("\n");
      const hasHomepageChange = homepageUrl !== (plugin.homepageUrl || "");
      
      setHasChanges(hasNameChange || hasVersionChange || hasContentChange || hasMatchesChange || hasHomepageChange);
    }
  }, [name, version, content, matches, homepageUrl, plugin]);

  useEffect(() => {
    // Re-parse inline metadata when content changes
    const meta = parseUserScriptMeta(content || "");
    setHasInlineMatches(meta.matches.length > 0);
    setParsedInlineMatches(meta.matches);
  }, [content]);

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

  if (plugin.sourceType !== 'inline') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">无法编辑此插件</h2>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            只有内联插件支持在线编辑。此插件的源代码类型为 {plugin.sourceType}
          </p>
          <div className="flex gap-3">
            <Button onClick={props.onBack} variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
            <Button asChild className="gap-2">
              <a href={`#/plugin/${encodeURIComponent(plugin.id)}`}>
                <Eye className="w-4 h-4" />
                查看详情
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const save = () => {
    // Prefer inline @match values when present; otherwise use manual matches input
    const effectiveMatchesRaw = (hasInlineMatches ? parsedInlineMatches : matches
      .split(/\n/g)
      .map((s) => s.trim())
      .filter(Boolean));
    const effectiveMatches = normalizePatterns(effectiveMatchesRaw);
    const next: Plugin = {
      ...plugin,
      name: name.trim() || plugin.name,
      version: version.trim() || undefined,
      homepageUrl: homepageUrl.trim() || undefined,
      inline: { content },
      matches: effectiveMatches,
      updatedAt: nowMs(),
      createdAt: plugin.createdAt || nowMs(),
    };
    props.onSave(next);
  };

  const reset = () => {
    setName(plugin?.name || "");
    setVersion(plugin?.version || "");
    setContent(plugin?.inline?.content || "");
    setMatches((plugin?.matches || []).join("\n"));
    setHomepageUrl(plugin?.homepageUrl || "");
  };

  const previewCode = () => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>代码预览 - ${name || plugin.name || plugin.id}</title>
            <style>
              body { 
                font-family: 'Monaco', 'Consolas', monospace; 
                background: #1e1e1e; 
                color: #d4d4d4; 
                margin: 20px; 
                line-height: 1.4;
              }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <h2>${name || plugin.name || plugin.id}</h2>
            <pre>${content}</pre>
          </body>
        </html>
      `);
    }
  };

  const downloadCode = () => {
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || plugin.name || plugin.id}.user.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Code2 className="w-6 h-6" />
              编辑插件
              {hasChanges && <span className="text-orange-600 text-lg">●</span>}
            </h1>
            <p className="text-muted-foreground">
              {plugin.name || plugin.id}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={previewCode}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            预览
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={downloadCode}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            下载
          </Button>
        </div>
      </div>

      {/* Warning about unsaved changes */}
      {hasChanges && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-orange-800 font-medium">您有未保存的更改</p>
              <p className="text-orange-700 text-sm">记得保存您的修改，否则更改将会丢失</p>
            </div>
            <Button 
              size="sm" 
              onClick={reset} 
              variant="ghost"
              className="text-orange-600 hover:text-orange-700 gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metadata Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              插件配置
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">插件名称</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入插件名称"
                  className="h-10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="version" className="text-sm font-medium">版本号</Label>
                <Input
                  id="version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="例如: 1.0.0"
                  className="h-10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="homepage" className="text-sm font-medium">主页链接</Label>
                <Input
                  id="homepage"
                  value={homepageUrl}
                  onChange={(e) => setHomepageUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="h-10"
                />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              匹配规则
            </h2>
            
            <div className="space-y-2">
              <Label htmlFor="matches" className="text-sm font-medium">
                URL 匹配模式（每行一个）
              </Label>
              <textarea
                id="matches"
                className="w-full h-32 px-3 py-2 border rounded-md bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={matches}
                onChange={(e) => setMatches(e.target.value)}
                disabled={hasInlineMatches}
                placeholder={`例如:\n*://*.example.com/*\nhttps://github.com/*\n*://localhost:*/*`}
              />
              <p className="text-xs text-muted-foreground">
                支持通配符 * 匹配任意字符
              </p>
              {hasInlineMatches && (
                <p className="text-xs text-muted-foreground">
                  检测到代码头部包含 @match，已优先使用内联匹配规则并禁用此输入框。
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" />
              代码统计
            </h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">字符数:</span>
                <span className="font-mono">{content.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">行数:</span>
                <span className="font-mono">{content.split('\n').length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">匹配规则:</span>
                <span className="font-mono">{matches.split('\n').filter(Boolean).length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Code Editor */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="border-b bg-muted/30 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">JavaScript 代码</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => navigator.clipboard?.writeText(content)}
                    className="gap-2 h-8"
                  >
                    <Copy className="w-3 h-3" />
                    复制
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <textarea
                className="w-full h-[500px] px-4 py-3 border rounded-lg bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`// 在这里编写您的用户脚本代码
// 示例:
(function() {
    'use strict';
    
    console.log('Hello from ${name || 'Userscript'}!');
    
    // 您的代码...
})();`}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t p-4 -mx-8 px-8">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            {hasChanges && (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">有未保存的更改</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={props.onBack}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              取消
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => chrome.runtime.sendMessage({ type: 'RUN_NOW' })}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              测试运行
            </Button>
            
            <Button 
              onClick={save}
              disabled={!hasChanges}
              className="gap-2 px-6"
            >
              <Save className="w-4 h-4" />
              保存修改
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// parseUserScriptMeta is imported from lib/userscript_parser