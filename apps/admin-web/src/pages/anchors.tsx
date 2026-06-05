import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface Anchor {
  id: number;
  account_name: string;
  account_password: string | null;
  track_description: string | null;
  tags: string;
  interests: string;
  status: string;
  created_at: string;
}

const statusLabel: Record<string, string> = { active: "正常", paused: "暂停", disabled: "禁用" };
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  paused: "secondary",
  disabled: "destructive",
};

function parseJsonArray(jsonStr: string | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatJsonArray(jsonStr: string | null): string {
  const arr = parseJsonArray(jsonStr);
  return arr.join(", ");
}

export default function AnchorPage() {
  const [list, setList] = useState<Anchor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Anchor | null>(null);
  const [form, setForm] = useState({
    account_name: "",
    account_password: "",
    track_description: "",
    tags: [] as string[],
    interests: [] as string[],
    status: "active",
  });

  const fetchList = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (keyword) params.set("keyword", keyword);
    if (status !== "all") params.set("status", status);
    fetch(`/api/anchors?${params}`, { headers: { "Content-Type": "application/json" } })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setList(result.data.list || []);
          setTotal(result.data.total || 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, [page, status]);

  const handleCreate = () => {
    setEditing(null);
    setForm({ account_name: "", account_password: "", track_description: "", tags: [], interests: [], status: "active" });
    setDialogOpen(true);
  };

  const handleEdit = (a: Anchor) => {
    setEditing(a);
    setForm({
      account_name: a.account_name,
      account_password: a.account_password || "",
      track_description: a.track_description || "",
      tags: parseJsonArray(a.tags),
      interests: parseJsonArray(a.interests),
      status: a.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    fetch(`/api/anchors/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          toast.success("删除成功");
          fetchList();
        } else {
          toast.error(result.error);
        }
      });
  };

  const handleSave = () => {
    if (!form.account_name) {
      toast.error("请输入主播账号");
      return;
    }
    const url = editing ? `/api/anchors/${editing.id}` : "/api/anchors";
    const method = editing ? "PUT" : "POST";
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          toast.success(editing ? "更新成功" : "创建成功");
          setDialogOpen(false);
          fetchList();
        } else {
          toast.error(result.error);
        }
      });
  };

  const addTag = (tag: string) => {
    if (tag && !form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    }
  };

  const removeTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  const addInterest = (interest: string) => {
    if (interest && !form.interests.includes(interest)) {
      setForm(f => ({ ...f, interests: [...f.interests, interest] }));
    }
  };

  const removeInterest = (interest: string) => {
    setForm(f => ({ ...f, interests: f.interests.filter(i => i !== interest) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">主播管理</h1>
          <p className="text-muted-foreground mt-1">管理主播账号信息、赛道、标签与兴趣偏好</p>
        </div>
        <Button onClick={handleCreate}><Plus className="mr-2 size-4" />新建主播</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="搜索主播账号..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8"
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="paused">暂停</SelectItem>
                <SelectItem value="disabled">禁用</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchList}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        {loading ? (
          <div className="space-y-3 p-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : list.length === 0 ? (
          <CardContent className="py-12"><Empty title="暂无主播数据" description="点击「新建主播」添加第一个主播" /></CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>主播账号</TableHead>
                <TableHead>赛道描述</TableHead>
                <TableHead>标签</TableHead>
                <TableHead>兴趣偏好</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{a.account_name}</p>
                      {a.account_password && <p className="text-xs text-muted-foreground">密码: {a.account_password}</p>}
                    </div>
                  </TableCell>
                  <TableCell><span className="text-sm">{a.track_description || "-"}</span></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {parseJsonArray(a.tags).slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                      {parseJsonArray(a.tags).length > 3 && (
                        <Badge variant="outline" className="text-xs">+{parseJsonArray(a.tags).length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {parseJsonArray(a.interests).slice(0, 2).map((int, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{int}</Badge>
                      ))}
                      {parseJsonArray(a.interests).length > 2 && (
                        <Badge variant="secondary" className="text-xs">+{parseJsonArray(a.interests).length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant[a.status] || "outline"}>{statusLabel[a.status] || a.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(a)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">共 {total} 条</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>下一页</Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "编辑主播" : "新建主播"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">主播账号 *</label>
              <Input value={form.account_name} onChange={(e) => setForm(f => ({ ...f, account_name: e.target.value }))} className="mt-1" placeholder="请输入主播账号" />
            </div>
            <div>
              <label className="text-sm font-medium">密码</label>
              <Input value={form.account_password} onChange={(e) => setForm(f => ({ ...f, account_password: e.target.value }))} className="mt-1" placeholder="选填" />
            </div>
            <div>
              <label className="text-sm font-medium">赛道描述</label>
              <Input value={form.track_description} onChange={(e) => setForm(f => ({ ...f, track_description: e.target.value }))} className="mt-1" placeholder="例如：美妆护肤、游戏直播" />
            </div>
            <div>
              <label className="text-sm font-medium">标签</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="flex items-center gap-1">
                    {tag}
                    <X className="size-3 cursor-pointer" onClick={() => removeTag(tag)} />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="输入标签后按回车"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addTag(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">兴趣偏好</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {form.interests.map((int) => (
                  <Badge key={int} variant="secondary" className="flex items-center gap-1">
                    {int}
                    <X className="size-3 cursor-pointer" onClick={() => removeInterest(int)} />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="输入兴趣后按回车"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addInterest(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">状态</label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="paused">暂停</SelectItem>
                  <SelectItem value="disabled">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSave}>{editing ? "保存" : "创建"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
