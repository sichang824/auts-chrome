import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export type AddSubscriptionPayload = {
  subscriptionUrl: string;
  name?: string;
};

export function AddServerDialog(props: {
  open: boolean;
  serverBase?: string;
  onOpenChange(next: boolean): void;
  onSubmit(payload: AddSubscriptionPayload): Promise<void> | void;
}) {
  const { open, onOpenChange } = props;
  const [subscriptionUrl, setSubscriptionUrl] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSubscriptionUrl("");
    setName("");
  };

  const close = () => onOpenChange(false);

  const submit = async () => {
    if (!subscriptionUrl.trim()) return;
    try {
      setSubmitting(true);
      await props.onSubmit({
        subscriptionUrl: subscriptionUrl.trim(),
        name: name.trim() || undefined,
      });
      reset();
      close();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-card border rounded-xl shadow-xl w-[520px] p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">添加服务器订阅</h2>
          <p className="text-sm text-muted-foreground mt-1">
            输入包含授权密钥的订阅链接，将从服务器获取所有关联的脚本并自动更新。
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subscriptionUrl">订阅链接</Label>
            <Input 
              id="subscriptionUrl" 
              placeholder="https://api.auts.dev/subscription?license=LIC-xxxxx" 
              value={subscriptionUrl} 
              onChange={(e) => setSubscriptionUrl(e.target.value)} 
              className="h-10" 
            />
            <p className="text-xs text-muted-foreground">
              链接格式：服务器地址/subscription?license=授权密钥
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">订阅名称（可选）</Label>
            <Input 
              id="name" 
              placeholder="我的脚本订阅" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="h-10" 
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={submitting}>取消</Button>
          <Button onClick={submit} disabled={!subscriptionUrl.trim() || submitting} className="px-6">
            {submitting ? "添加中..." : "添加订阅"}
          </Button>
        </div>
      </div>
    </div>
  );
}


