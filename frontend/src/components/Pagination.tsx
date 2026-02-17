import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ total, offset, limit, onChange }: {
  total: number;
  offset: number;
  limit: number;
  onChange: (offset: number) => void;
}) {
  if (!total) return null;
  return <div className="pagination">
    <span>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
    <div className="actions">
      <button className="button secondary small" disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}>
        <ChevronLeft size={16} />Previous
      </button>
      <button className="button secondary small" disabled={offset + limit >= total}
        onClick={() => onChange(offset + limit)}>
        Next<ChevronRight size={16} />
      </button>
    </div>
  </div>;
}
