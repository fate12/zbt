import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审核", variant: "secondary" },
  signed: { label: "已签约", variant: "default" },
  live: { label: "直播中", variant: "default" },
  terminated: { label: "已解约", variant: "destructive" },
  paused: { label: "已暂停", variant: "outline" },
};

export function StatusTag({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
