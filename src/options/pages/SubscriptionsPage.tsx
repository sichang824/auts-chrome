import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Server,
  RefreshCw,
  Trash2,
  Calendar,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Plus
} from "lucide-react";
import { useEffect, useState } from "react";
import { AddServerDialog, type AddSubscriptionPayload } from "./AddServerDialog";
import type { ServerSubscription } from "@/lib/types";
import { toast } from "sonner";

export function SubscriptionsPage(props: {
  serverBase?: string;
  onBack(): void;
}) {
  const [subscriptions, setSubscriptions] = useState<ServerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    subscription: ServerSubscription | null;
  }>({ open: false, subscription: null });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const { getAllSubscriptions } = await import("@/extension/subscription_storage");
      const subs = await getAllSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubscription = async (payload: AddSubscriptionPayload) => {
    try {
      const { addSubscription } = await import("@/extension/subscription_storage");
      await addSubscription(payload.subscriptionUrl, payload.name);
      await loadSubscriptions();
      // Notify other parts of the extension
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    } catch (error) {
      console.error("Failed to add subscription:", error);
      toast.error(`添加订阅失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleToggleSubscription = async (subscriptionId: string) => {
    try {
      const { toggleSubscription } = await import("@/extension/subscription_storage");
      await toggleSubscription(subscriptionId);
      await loadSubscriptions();
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
    } catch (error) {
      console.error("Failed to toggle subscription:", error);
      toast.error(`切换订阅状态失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleUpdateSubscription = async (subscriptionId: string) => {
    try {
      const { updateSubscription } = await import("@/extension/subscription_storage");
      await updateSubscription(subscriptionId);
      await loadSubscriptions();
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
      toast.success("订阅更新成功！");
    } catch (error) {
      console.error("Failed to update subscription:", error);
      toast.error(`更新订阅失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDeleteSubscription = (subscription: ServerSubscription) => {
    setDeleteDialog({ open: true, subscription });
  };

  const confirmDeleteSubscription = async () => {
    if (!deleteDialog.subscription) return;

    try {
      const { deleteSubscription } = await import("@/extension/subscription_storage");
      await deleteSubscription(deleteDialog.subscription.id);
      await loadSubscriptions();
      chrome.runtime.sendMessage({ type: "STATE_CHANGED", source: "options" });
      toast.success(`订阅 "${deleteDialog.subscription.name}" 已删除`);
      setDeleteDialog({ open: false, subscription: null });
    } catch (error) {
      console.error("Failed to delete subscription:", error);
      toast.error(`删除订阅失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const copySubscriptionLink = async (subscription: ServerSubscription) => {
    try {
      const subscriptionUrl = `${subscription.serverBase}/subscription?license=${subscription.licenseKey}`;
      await navigator.clipboard.writeText(subscriptionUrl);
      toast.success("订阅链接已复制到剪贴板", {
        description: subscription.name
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      try {
        const textArea = document.createElement('textarea');
        textArea.value = `${subscription.serverBase}/subscription?license=${subscription.licenseKey}`;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success("订阅链接已复制到剪贴板", {
          description: subscription.name
        });
      } catch (fallbackError) {
        toast.error("复制链接失败，请手动复制");
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const SubscriptionCard = ({ subscription }: { subscription: ServerSubscription }) => (
    <Card className="group hover:shadow-lg hover:border-ring/50 transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center border">
              <Server className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate mb-1">{subscription.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span className="font-mono text-xs">{subscription.licenseKey}</span>
                <Badge variant={subscription.enabled ? "default" : "secondary"}>
                  {subscription.enabled ? "已启用" : "已禁用"}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={subscription.enabled}
            onCheckedChange={() => handleToggleSubscription(subscription.id)}
            className="data-[state=checked]:bg-purple-500"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Server Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ExternalLink className="w-3 h-3" />
          <span className="truncate">{subscription.serverBase}</span>
        </div>

        {/* Scripts Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">关联脚本</span>
            <span className="text-muted-foreground">
              {subscription.scripts.length} 个 
              ({subscription.scripts.filter(s => s.enabled).length} 已启用)
            </span>
          </div>
          
          {subscription.scripts.length > 0 && (
            <div className="grid grid-cols-1 gap-1 max-h-24 overflow-y-auto">
              {subscription.scripts.slice(0, 5).map((script) => (
                <div key={script.id} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                  <span className="font-mono truncate flex-1">{script.id}</span>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-muted-foreground">v{script.version}</span>
                    {script.enabled ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </div>
              ))}
              {subscription.scripts.length > 5 && (
                <div className="text-xs text-muted-foreground text-center py-1">
                  还有 {subscription.scripts.length - 5} 个脚本...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Last Updated */}
        {subscription.lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>最后更新: {formatDate(subscription.lastUpdated)}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            size="sm"
            variant="outline"
            onClick={() => copySubscriptionLink(subscription)}
            className="h-8 px-3 text-xs"
          >
            <Copy className="w-3 h-3 mr-1.5" />
            复制链接
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUpdateSubscription(subscription.id)}
            className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            更新
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDeleteSubscription(subscription)}
            className="h-8 px-3 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3 mr-1.5" />
            删除
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">
            订阅管理
          </h1>
          <p className="text-muted-foreground">
            管理您的脚本订阅源，集中控制多个脚本
          </p>
        </div>
        <Button onClick={() => setOpenAddDialog(true)} className="gap-2 px-6 h-11 shadow-lg bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4" />
          添加订阅
        </Button>
      </div>

      {/* Stats */}
      {subscriptions.length > 0 && (
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>共 {subscriptions.length} 个订阅</span>
          <span>已启用 {subscriptions.filter(s => s.enabled).length} 个</span>
          <span>
            总计 {subscriptions.reduce((total, s) => total + s.scripts.length, 0)} 个脚本
          </span>
        </div>
      )}

      {/* Content */}
      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center mb-6">
            <Server className="w-10 h-10 text-purple-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">还没有订阅</h3>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            添加您的第一个脚本订阅，集中管理多个脚本源
          </p>
          <Button onClick={() => setOpenAddDialog(true)} className="gap-2 px-6 h-11 bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4" />
            添加订阅
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {subscriptions.map((subscription) => (
            <SubscriptionCard key={subscription.id} subscription={subscription} />
          ))}
        </div>
      )}

      {/* Add Subscription Dialog */}
      <AddServerDialog
        open={openAddDialog}
        serverBase={props.serverBase}
        onOpenChange={setOpenAddDialog}
        onSubmit={handleAddSubscription}
      />

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ open, subscription: open ? deleteDialog.subscription : null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除订阅</DialogTitle>
            <DialogDescription>
              确定要删除订阅
              {" "}
              {deleteDialog.subscription ? `"${deleteDialog.subscription.name}"` : ""}
              {" "}
              吗？这将删除该订阅下的所有脚本。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, subscription: null })}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSubscription}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}