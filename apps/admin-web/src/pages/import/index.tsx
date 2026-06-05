import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Upload, Download, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ImportRecord {
  id: number;
  file_name: string;
  file_type: string;
  file_path: string;
  file_size: number | null;
  status: string;
  success_count: number;
  fail_count: number;
  error_message: string | null;
  created_at: string;
}

const statusLabel: Record<string, string> = { pending: "处理中", success: "成功", failed: "失败" };
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "secondary", success: "default", failed: "destructive" };

export default function ImportPage() {
  const [list, setList] = useState<ImportRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ImportRecord | null>(null);

  const fetchList = () => {
    setLoading(true);
    fetch(`/api/import/records?page=${page}&pageSize=20`, { headers: { "Content-Type": "application/json" } })
      .then((res) => res.json())
      .then((result) => { if (result.success) { setList(result.data || []); setTotal(result.total || 0); } setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, [page]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/import/upload", { method: "POST", body: formData });
      const result = await res.json();
      if (result.success) {
        if (result.data.overwritten) {
          toast.success(`「${file.name}」已覆盖更新`);
        } else {
          toast.success("上传成功");
        }
        fetchList();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("上传失败");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = (id: number) => {
    fetch(`/api/import/records/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } })
      .then((res) => res.json())
      .then((result) => { if (result.success) { toast.success("删除成功"); fetchList(); } else toast.error(result.error); });
  };

  const handleDownload = (id: number) => {
    window.open(`/api/import/records/${id}/download`, "_blank");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据导入</h1>
        <p className="text-muted-foreground mt-1">上传文件批量导入数据，相同文件名将自动覆盖</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">上传文件</CardTitle></CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {uploading ? "上传中..." : "点击或拖拽文件到此区域上传"}
              </p>
              <p className="text-xs text-muted-foreground">支持 xlsx / xls / pdf / docx 格式</p>
            </div>
            <input type="file" className="hidden" accept=".xlsx,.xls,.pdf,.docx" onChange={handleUpload} disabled={uploading} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">导入记录</CardTitle></CardHeader>
        {loading ? (
          <CardContent className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent>
        ) : list.length === 0 ? (
          <CardContent className="py-12"><Empty title="暂无导入记录" description="上传文件后这里会显示导入历史" /></CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>成功/失败</TableHead>
                <TableHead>文件大小</TableHead>
                <TableHead>上传时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.file_name}</TableCell>
                  <TableCell><Badge variant="outline">{r.file_type}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant[r.status] || "outline"}>{statusLabel[r.status] || r.status}</Badge></TableCell>
                  <TableCell className="tabular-nums">{r.success_count} / {r.fail_count}</TableCell>
                  <TableCell className="text-sm">{formatSize(r.file_size)}</TableCell>
                  <TableCell className="text-sm">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(r.id)} title="下载"><Download className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { setDetail(r); setDetailOpen(true); }} title="详情"><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} title="删除"><Trash2 className="size-4 text-destructive" /></Button>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>导入详情</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">文件名</p><p className="font-medium mt-1">{detail.file_name}</p></div>
                <div><p className="text-muted-foreground">文件类型</p><p className="font-medium mt-1">{detail.file_type}</p></div>
                <div><p className="text-muted-foreground">状态</p><Badge variant={statusVariant[detail.status] || "outline"} className="mt-1">{statusLabel[detail.status] || detail.status}</Badge></div>
                <div><p className="text-muted-foreground">文件大小</p><p className="font-medium mt-1">{formatSize(detail.file_size)}</p></div>
                <div><p className="text-muted-foreground">成功数</p><p className="font-medium mt-1 tabular-nums">{detail.success_count}</p></div>
                <div><p className="text-muted-foreground">失败数</p><p className="font-medium mt-1 tabular-nums">{detail.fail_count}</p></div>
                <div><p className="text-muted-foreground">上传时间</p><p className="font-medium mt-1">{detail.created_at ? new Date(detail.created_at).toLocaleString() : "-"}</p></div>
              </div>
              {detail.error_message && (
                <div><p className="text-muted-foreground text-sm">错误信息</p><p className="text-sm text-destructive mt-1">{detail.error_message}</p></div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleDownload(detail.id)}><Download className="mr-2 size-4" />下载文件</Button>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>关闭</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
