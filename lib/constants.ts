export const CATEGORIES = [
  { value: 'textbook', label: 'Giáo trình' },
  { value: 'slide', label: 'Slide bài giảng' },
  { value: 'reference', label: 'Tài liệu tham khảo' },
  { value: 'assignment', label: 'Bài tập' },
  { value: 'exam', label: 'Đề kiểm tra & đề thi' },
  { value: 'solution', label: 'Đáp án & lời giải' },
  { value: 'note', label: 'Ghi chú cá nhân' },
];
export const CAT_ORDER: Record<string, number> = Object.fromEntries(CATEGORIES.map((c, i) => [c.value, i]));
export const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label || v;

export const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg'];
export const MAX_FILE_MB = 50;

export const SUBJECT_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
export const SUBJECT_ICONS = ['📘', '📐', '🧪', '💻', '📊', '🌍', '⚖️', '🎨', '🧬', '📝', '🏛️', '🔬'];

export const QUESTION_TYPES = [
  { value: 'mcq', label: 'Trắc nghiệm ABCD' },
  { value: 'tf', label: 'Đúng/Sai' },
  { value: 'fill', label: 'Điền khuyết' },
  { value: 'essay', label: 'Tự luận' },
  { value: 'calc', label: 'Bài tập tính toán' },
  { value: 'scenario', label: 'Câu hỏi tình huống' },
];
export const LEVELS = [
  { value: 'recognize', label: 'Nhận biết' },
  { value: 'understand', label: 'Thông hiểu' },
  { value: 'apply', label: 'Vận dụng' },
  { value: 'advanced', label: 'Vận dụng cao' },
];
export const typeLabel = (v: string) => QUESTION_TYPES.find((t) => t.value === v)?.label || v;
export const levelLabel = (v: string) => LEVELS.find((t) => t.value === v)?.label || v;
