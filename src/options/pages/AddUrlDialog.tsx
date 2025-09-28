import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type AddUrlPayload = {
  href: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  matchesText?: string; // one per line
};

export function AddUrlDialog(props: {
  open: boolean;
  onOpenChange(next: boolean): void;
  onSubmit(payload: AddUrlPayload): Promise<void> | void;
}) {
  const { open, onOpenChange } = props;
  const [href, setHref] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [matchesText, setMatchesText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const reset = () => {
    setHref("");
    setName("");
    setVersion("");
    setDescription("");
    setAuthor("");
    setMatchesText("");
  };

  const close = () => onOpenChange(false);

  const submit = async () => {
    if (!href.trim()) return;
    try {
      setSubmitting(true);
      await props.onSubmit({
        href: href.trim(),
        name: name.trim() || undefined,
        version: version.trim() || undefined,
        description: description.trim() || undefined,
        author: author.trim() || undefined,
        matchesText: matchesText.trim() || undefined,
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
          <h2 className="text-lg font-semibold">通过 URL 新建脚本</h2>
          <p className="text-sm text-muted-foreground mt-1">
            仅保存链接，不支持编辑代码。创建时会尝试抓取并解析元数据。
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="href">脚本链接</Label>
            <Input id="href" placeholder="https://example.com/your.user.js" value={href} onChange={(e) => setHref(e.target.value)} className="h-10" />
          </div>

          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="font-medium">其他信息</span>
              {showAdvanced ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {showAdvanced && (
              <div className="p-4 pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">名称（可选）</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="version">版本（可选）</Label>
                    <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} className="h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="author">作者（可选）</Label>
                    <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">描述（可选）</Label>
                    <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matches">URL 匹配（可选，每行一个）</Label>
                  <textarea id="matches" className="w-full h-24 px-3 py-2 border rounded-md bg-background text-sm font-mono resize-none" value={matchesText} onChange={(e) => setMatchesText(e.target.value)} placeholder={`*://*.example.com/*\nhttps://github.com/*`} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={submitting}>取消</Button>
          <Button onClick={submit} disabled={!href.trim() || submitting} className="px-6">
            {submitting ? "创建中..." : "创建"}
          </Button>
        </div>
      </div>
    </div>
  );
}


