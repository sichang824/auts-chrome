import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Box,
  Clock,
  Code2,
  Edit3,
  Eye,
  Globe,
  Play,
  Plus,
  Search,
  Server,
  Trash2,
  FolderOpen,
  ChevronDown,
  RefreshCw,
  Link,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Plugin } from "../store";
import { sortByUpdatedAtDesc } from "../store";
import { UpdatePluginButton } from "../components/UpdatePluginButton";
import { toast } from "sonner";

type SortOption = "updated-desc" | "name-asc" | "enabled-first";

export function PluginsPage(props: {
  scripts: Plugin[];
  onToggle(id: string, enabled: boolean): void;
  onRemove(id: string): void;
  onCreate(): void;
  onCreateLocal(): void;
  onOpenCreateUrl?(): void;
  onOpenCreateServer?(): void;
  onRefreshLocal?(plugin: Plugin): void;
  serverBase?: string;
}) {
  const [sortBy, setSortBy] = useState<SortOption>("updated-desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEnabled, setFilterEnabled] = useState<
    "all" | "enabled" | "disabled"
  >("all");

  const filteredAndSortedItems = useMemo(() => {
    let filtered = props.scripts;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (plugin) =>
          plugin.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          plugin.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by enabled status
    if (filterEnabled !== "all") {
      filtered = filtered.filter((plugin) =>
        filterEnabled === "enabled" ? plugin.enabled : !plugin.enabled
      );
    }

    // Sort
    switch (sortBy) {
      case "name-asc":
        return [...filtered].sort((a, b) =>
          (a.name || a.id).localeCompare(b.name || b.id)
        );
      case "enabled-first":
        return [...filtered].sort(
          (a, b) => (b.enabled ? 1 : 0) - (a.enabled ? 1 : 0)
        );
      default:
        return sortByUpdatedAtDesc(filtered);
    }
  }, [props.scripts, searchQuery, filterEnabled, sortBy]);

  const getSourceIcon = (sourceType: Plugin["sourceType"]) => {
    switch (sourceType) {
      case "inline":
        return <Code2 className="w-4 h-4" />;
      case "url":
        return <Globe className="w-4 h-4" />;
      case "server":
        return <Server className="w-4 h-4" />;
      case "local":
        return <FolderOpen className="w-4 h-4" />;
      default:
        return <Code2 className="w-4 h-4" />;
    }
  };

  const getSourceColor = (sourceType: Plugin["sourceType"]) => {
    switch (sourceType) {
      case "inline":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "url":
        return "text-green-600 bg-green-50 border-green-200";
      case "server":
        return "text-purple-600 bg-purple-50 border-purple-200";
      case "local":
        return "text-orange-600 bg-orange-50 border-orange-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const PluginCard = ({ plugin }: { plugin: Plugin }) => (
    <div className="group bg-card border rounded-xl p-6 hover:shadow-lg hover:border-ring/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative">
            {plugin.iconUrl ? (
              <img
                src={plugin.iconUrl}
                className="w-10 h-10 rounded-lg shadow-sm"
                alt="Plugin icon"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border">
                {getSourceIcon(plugin.sourceType)}
              </div>
            )}
            {plugin.enabled && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg truncate mb-1">
              {plugin.name || plugin.id}
            </h3>
            <div className="flex items-center gap-2">
              {plugin.version && (
                <span className="text-xs px-2 py-1 bg-secondary rounded-full font-mono">
                  v{plugin.version}
                </span>
              )}
              <span
                className={`text-xs px-2 py-1 rounded-full border font-medium ${getSourceColor(
                  plugin.sourceType
                )}`}
              >
                {plugin.sourceType}
              </span>
            </div>
          </div>
        </div>
        <Switch
          checked={plugin.enabled}
          onCheckedChange={(v) => props.onToggle(plugin.id, v)}
          className="data-[state=checked]:bg-green-500"
        />
      </div>

      {/* Meta info */}
      <div className="space-y-2 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>
            Updated {formatDate(plugin.updatedAt || plugin.createdAt)}
          </span>
        </div>

        {plugin.sourceType === "url" && plugin.url && (
          <div className="flex items-center gap-2 truncate">
            <Globe className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {typeof plugin.url === "string" ? plugin.url : plugin.url.href}
            </span>
          </div>
        )}

        {plugin.sourceType === "server" && plugin.server?.scriptId && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-3 h-3" />
              <span>Script ID: {plugin.server.scriptId}</span>
            </div>
            {plugin.cache?.subscriptionName && (
              <div className="flex items-center gap-2 text-purple-600">
                <Server className="w-3 h-3" />
                <span>订阅: {plugin.cache.subscriptionName}</span>
              </div>
            )}
          </div>
        )}

        {plugin.sourceType === "local" && plugin.local && (
          <div className="flex items-center gap-2">
            {plugin.local.isLinked ? (
              <>
                <Link className="w-3 h-3 text-green-600" />
                <span className="text-green-600">
                  已关联 - {plugin.local.isDirectory ? "目录" : "文件"}: {plugin.local.linkedPath || plugin.local.entryFile}
                </span>
              </>
            ) : (
              <>
                <FolderOpen className="w-3 h-3" />
                <span>
                  {plugin.local.isDirectory ? "目录" : "单文件"}: {plugin.local.entryFile}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button size="sm" variant="ghost" asChild className="h-8 px-3 text-xs">
          <a
            href={`#/plugin/${encodeURIComponent(plugin.id)}`}
            className="flex items-center gap-1.5"
          >
            <Eye className="w-3 h-3" />
            查看
          </a>
        </Button>

        {(plugin.sourceType === "inline" || plugin.sourceType === "local") && (
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="h-8 px-3 text-xs"
          >
            <a
              href={`#/plugin/${encodeURIComponent(plugin.id)}/edit`}
              className="flex items-center gap-1.5"
            >
              <Edit3 className="w-3 h-3" />
              编辑
            </a>
          </Button>
        )}

        {(plugin.sourceType === "url" || plugin.sourceType === "server") && !plugin.cache?.subscriptionId && (
          <UpdatePluginButton plugin={plugin} serverBase={props.serverBase} />
        )}

        {plugin.cache?.subscriptionId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs text-purple-600 hover:text-purple-700"
            onClick={async () => {
              try {
                const { updateSubscription } = await import("@/extension/subscription_storage");
                await updateSubscription(plugin.cache!.subscriptionId!);
                // Reload page to show updates
                window.location.reload();
              } catch (error) {
                toast.error(`更新订阅失败：${error instanceof Error ? error.message : '未知错误'}`);
              }
            }}
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            更新订阅
          </Button>
        )}

        {plugin.sourceType === "local" && plugin.local?.isLinked && props.onRefreshLocal && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs text-green-600 hover:text-green-700"
            onClick={() => props.onRefreshLocal!(plugin)}
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            刷新
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-3 text-xs"
          onClick={() => chrome.runtime.sendMessage({ type: "RUN_NOW" })}
        >
          <Play className="w-3 h-3 mr-1.5" />
          运行
        </Button>

        {!plugin.cache?.subscriptionId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs text-destructive hover:text-destructive"
            onClick={() => props.onRemove(plugin.id)}
          >
            <Trash2 className="w-3 h-3 mr-1.5" />
            删除
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              插件管理
            </h1>
            <p className="text-muted-foreground">
              管理您的用户脚本和自动化插件
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 px-6 h-11 shadow-lg" size="lg">
                <Plus className="w-4 h-4" />
                新建插件
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={props.onCreate}>
                <Code2 className="w-4 h-4 mr-2" />
                内联脚本
              </DropdownMenuItem>
              <DropdownMenuItem onClick={props.onCreateLocal}>
                <FolderOpen className="w-4 h-4 mr-2" />
                本地插件
              </DropdownMenuItem>
              {props.onOpenCreateUrl && (
                <DropdownMenuItem onClick={props.onOpenCreateUrl}>
                  <Globe className="w-4 h-4 mr-2" />
                  URL 脚本
                </DropdownMenuItem>
              )}
              {props.onOpenCreateServer && (
                <DropdownMenuItem onClick={props.onOpenCreateServer}>
                  <Server className="w-4 h-4 mr-2" />
                  Server 脚本
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索插件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterEnabled}
              onChange={(e) => setFilterEnabled(e.target.value as any)}
              className="h-10 px-3 border rounded-md bg-background text-sm min-w-[120px]"
            >
              <option value="all">全部状态</option>
              <option value="enabled">已启用</option>
              <option value="disabled">已禁用</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 px-3 border rounded-md bg-background text-sm min-w-[120px]"
            >
              <option value="updated-desc">最近更新</option>
              <option value="name-asc">名称排序</option>
              <option value="enabled-first">启用优先</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        {props.scripts.length > 0 && (
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>共 {filteredAndSortedItems.length} 个插件</span>
            <span>
              已启用 {props.scripts.filter((p) => p.enabled).length} 个
            </span>
            <span>
              已禁用 {props.scripts.filter((p) => !p.enabled).length} 个
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      {filteredAndSortedItems.length === 0 && props.scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <Box className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">还没有插件</h3>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            创建您的第一个用户脚本，开始自动化您的浏览体验
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 px-6 h-11" size="lg">
                <Plus className="w-4 h-4" />
                创建插件
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={props.onCreate}>
                <Code2 className="w-4 h-4 mr-2" />
                内联脚本
              </DropdownMenuItem>
              <DropdownMenuItem onClick={props.onCreateLocal}>
                <FolderOpen className="w-4 h-4 mr-2" />
                本地插件
              </DropdownMenuItem>
              {props.onOpenCreateUrl && (
                <DropdownMenuItem onClick={props.onOpenCreateUrl}>
                  <Globe className="w-4 h-4 mr-2" />
                  URL 脚本
                </DropdownMenuItem>
              )}
              {props.onOpenCreateServer && (
                <DropdownMenuItem onClick={props.onOpenCreateServer}>
                  <Server className="w-4 h-4 mr-2" />
                  Server 脚本
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">未找到匹配的插件</h3>
          <p className="text-muted-foreground">尝试修改搜索条件或筛选选项</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedItems.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </div>
      )}
    </div>
  );
}
