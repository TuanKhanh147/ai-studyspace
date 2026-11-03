// Tiến độ môn học = trung bình của (a) % bài tập đã xong và (b) điểm trung bình 5 lần làm bài gần nhất.
// Thành phần nào chưa có dữ liệu thì không tính. Chưa có dữ liệu nào => 0.
export function subjectProgress(
  assignments: { done: boolean }[],
  attempts: { percent?: number; score?: number; total?: number }[]
) {
  const parts: number[] = [];
  if (assignments.length) parts.push((assignments.filter((a) => a.done).length / assignments.length) * 100);
  const recent = attempts.slice(0, 5);
  if (recent.length) {
    const avg = recent.reduce((s, a) => s + (a.percent ?? (a.total ? ((a.score || 0) / a.total) * 100 : 0)), 0) / recent.length;
    parts.push(avg);
  }
  return parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
}
