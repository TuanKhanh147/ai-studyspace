# AI StudySpace – Hệ thống học tập cá nhân hóa bằng AI

Next.js 14 (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth, Storage, pgvector, RLS) · Claude hoặc OpenAI.

## 0. Trạng thái trung thực của bản này

Bản source này được viết đầy đủ nhưng **chưa được chạy `npm install` / `npm run build` / kết nối Supabase thật** (môi trường tạo code không có mạng). Đã kiểm tra: toàn bộ file qua trình biên dịch TypeScript không có lỗi cú pháp. **Chưa kiểm chứng**: build thật, SQL trên Supabase thật, gọi API AI thật. Hãy chạy theo checklist ở mục 11 và gửi lại cho tôi chính xác thông báo lỗi nếu có.

Chức năng đã có luồng xử lý thực: đăng ký/đăng nhập, môn học (CRUD, lưu trữ, màu, biểu tượng), kho tài liệu 7 thư mục (upload nhiều file, xem trước, tải xuống, đổi tên, phân loại, xóa, tìm kiếm), đọc & lập chỉ mục tài liệu (RAG theo môn), AI tạo đề cương, AI tạo câu hỏi (6 dạng × 4 mức), làm bài + chấm điểm + phân tích điểm yếu + tạo bộ câu hỏi bổ sung, AI giải bài (nhập chữ/ảnh/file), chatbot theo môn có trích nguồn, quản lý bài tập, sổ tay, lịch thi, dashboard tiến độ, xuất sao lưu JSON.

## 1. Giới hạn đã biết (không giấu)

| Vấn đề | Chi tiết |
|---|---|
| `.doc` và `.ppt` đời cũ | Được lưu trữ, tải xuống được, nhưng **không đọc được nội dung** cho AI (trạng thái "Không đọc được"). Hãy lưu lại thành `.docx` / `.pptx`. |
| PDF scan (toàn ảnh) | Không có OCR cho PDF. Hệ thống báo rõ. Cách xử lý: dùng PDF có chữ, hoặc chụp/xuất từng trang thành JPG/PNG (ảnh được OCR bằng AI vision). |
| Số trang | PDF → "Trang N", PPTX → "Slide N". DOCX/TXT không có số trang → "Phần N". |
| Nhận diện chương | Dựa trên dòng bắt đầu bằng "Chương N" / "Chapter N". Tài liệu đặt tên khác thì không có chương (AI vẫn tự gắn chủ đề cho câu hỏi). |
| Embedding | Claude không có API embedding. Muốn tìm kiếm ngữ nghĩa chính xác cần `OPENAI_API_KEY`. Không có thì tự dùng tìm kiếm từ khóa (kém hơn với câu hỏi diễn đạt khác tài liệu). |
| Tài liệu rất lớn | Đề cương dùng map-reduce (trích ghi chú từng phần rồi tổng hợp) nên có thể mất chi tiết nhỏ. Nên tạo đề cương theo từng chương bằng ô "Phạm vi". |
| Thời gian xử lý trên Vercel | Gói Hobby giới hạn thời gian hàm. PDF/tài liệu lớn hoặc đề cương dài có thể bị timeout → dùng gói Pro, hoặc chia nhỏ file. Code đặt `maxDuration = 300`. |
| Không streaming | Câu trả lời AI hiện ra sau khi hoàn tất (chưa chạy dạng gõ từng chữ). |
| Giải bài từ file/ảnh | Tối đa 4MB (giới hạn body của Vercel). Upload tài liệu môn học đi thẳng lên Supabase nên không bị giới hạn này (tối đa 50MB/file). |
| Model mặc định | `claude-sonnet-5-5` / `gpt-4.1`. Nếu tài khoản của bạn khác, đặt `AI_MODEL`. |
| Kích thước vector | Cố định 1536 (text-embedding-3-small). Đổi model embedding khác kích thước cần sửa migration. |
| Giao diện | Dùng Tailwind thuần (không dùng shadcn CLI) để dễ cài và ít lỗi phụ thuộc. |

## 2. Cài đặt công cụ trên Windows

1. Cài **Node.js LTS** (bản 20 hoặc 22): https://nodejs.org
2. Cài **Git**: https://git-scm.com/download/win
3. Cài **VS Code** (tuỳ chọn): https://code.visualstudio.com
4. Mở PowerShell kiểm tra: `node -v`, `npm -v`, `git --version`

## 3. Tạo Supabase

1. Vào https://supabase.com → New project (chọn region gần nhất, ví dụ Singapore). Lưu mật khẩu database.
2. Vào **SQL Editor** → New query → dán toàn bộ `supabase/migrations/0001_init.sql` → **Run**. File này tạo bảng, RLS, bucket `documents` (riêng tư), policy Storage và các hàm tìm kiếm.
3. **Project Settings → API**: lấy `Project URL` và `anon public key`.
4. **Authentication → Providers → Email**: khi thử nghiệm có thể tắt "Confirm email" để đăng ký xong dùng được ngay. Khi chạy thật nên bật.
5. **Authentication → URL Configuration**: Site URL = `http://localhost:3000` (khi dev). Khi deploy, đổi thành URL Vercel và thêm `https://<domain>/auth/callback` vào Redirect URLs.

## 4. Chạy trên máy (Windows)

```powershell
cd ai-studyspace
copy .env.example .env.local
notepad .env.local      # điền các giá trị (xem mục 5)
npm install
npm run dev
```
Mở http://localhost:3000 → Đăng ký tài khoản.

## 5. Cấu hình API AI

Sửa `.env.local` (các key này **chỉ ở server**, không bao giờ vào trình duyệt):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
AI_PROVIDER=anthropic          # hoặc openai
ANTHROPIC_API_KEY=sk-ant-...   # lấy ở console.anthropic.com
OPENAI_API_KEY=sk-...          # BẮT BUỘC nếu AI_PROVIDER=openai; nên có để làm embedding
AI_MODEL=                      # để trống = mặc định
```
Đổi nhà cung cấp AI: chỉ cần đổi `AI_PROVIDER` (và key tương ứng), không sửa code. Khởi động lại `npm run dev` sau khi sửa `.env.local`.
Không cần service-role key: mọi truy vấn dùng phiên đăng nhập của người dùng nên RLS luôn có hiệu lực.

## 6. Hướng dẫn sử dụng

1. **Môn học → Tạo môn học** (tên, mã, giảng viên, học kỳ, màu, biểu tượng).
2. Vào môn → tab **Tài liệu**: chọn thư mục (Giáo trình, Slide, …) → kéo thả/chọn nhiều file. Mỗi file chuyển trạng thái *Đang đọc… → Đã đọc*. File lỗi hiện lý do và có nút "Xử lý lại".
3. Tab **Đề cương AI**: (tuỳ chọn nhập phạm vi) → Tạo đề cương. Kết quả có danh sách file đã dùng, cảnh báo file thiếu/không đọc được, nguồn (file, trang/slide) ở từng ý, và nhãn `[AI bổ sung – ngoài tài liệu]`. Tải .md hoặc In → Lưu PDF.
4. Tab **Câu hỏi ôn tập**: chọn dạng, mức độ, số lượng, chương, bật/tắt đáp án & lời giải → Tạo → làm bài → Nộp → xem điểm, thống kê chương yếu, nội dung cần ôn, nút tạo bộ bổ sung.
5. Tab **Giải bài tập**: nhập đề / ảnh / file; có thể lưu lời giải vào "Bài tập của tôi".
6. Tab **Hỏi đáp**: chatbot chỉ tra cứu tài liệu của môn đó, có mục "Nguồn tham chiếu".
7. **Lịch thi**, **Sổ tay**, **Dashboard**: ở thanh bên trái.

## 7. Đưa lên GitHub

```powershell
git init
git add .
git commit -m "AI StudySpace initial"
git branch -M main
# tạo repo trống trên github.com (Private), rồi:
git remote add origin https://github.com/<ten-ban>/ai-studyspace.git
git push -u origin main
```
`.env.local` đã nằm trong `.gitignore` – **không** đẩy key lên GitHub.

## 8. Triển khai lên internet (Vercel + Supabase)

1. https://vercel.com → Add New → Project → Import repo GitHub.
2. Environment Variables: nhập đúng các biến như `.env.local` (Production).
3. Deploy → nhận URL dạng `https://ai-studyspace-xxx.vercel.app` (có thể gắn tên miền riêng ở Settings → Domains).
4. Quay lại Supabase → Authentication → URL Configuration: đặt Site URL = URL Vercel, thêm `https://<url>/auth/callback` vào Redirect URLs.
5. Đăng ký tài khoản trên URL chính thức và thử upload.

## 9. Sao lưu

- Dữ liệu cá nhân (JSON): nút **Sao lưu dữ liệu (JSON)** ở thanh bên (`/api/export`) – gồm môn học, tài liệu (metadata), bài tập, ghi chú, lịch thi, đề cương, câu hỏi, lịch sử làm bài, chat.
- File gốc: nằm trong Supabase Storage bucket `documents`. Dùng bản backup tự động của Supabase (gói Pro) hoặc `supabase db dump` + tải thư mục Storage định kỳ.

## 10. Bảo mật

- RLS bật cho mọi bảng (`user_id = auth.uid()`), thêm policy chặn gắn dữ liệu vào môn học của người khác.
- Storage riêng tư; policy chỉ cho phép thư mục `<user_id>/…`. File mở bằng signed URL ngắn hạn.
- Truy xuất RAG luôn lọc theo `subject_id` + RLS ⇒ không lẫn tài liệu môn khác/người khác.
- API key AI chỉ nằm ở biến môi trường server; kiểm tra định dạng & dung lượng file ở client, bucket giới hạn 50MB.

## 11. Checklist kiểm thử (làm theo thứ tự)

1. Đăng ký → đăng nhập → đăng xuất → đăng nhập lại: dữ liệu còn nguyên.
2. Tạo 2 tài khoản; xác nhận tài khoản B không thấy môn/tài liệu của A.
3. Tạo môn, upload 1 PDF có chữ + 1 PPTX + 1 DOCX → cả ba "Đã đọc"; bấm "Xem" từng file.
4. Upload file `.doc` → báo "Không đọc được" nhưng vẫn tải xuống được.
5. Tạo đề cương → có danh sách file, nguồn, đủ 10 mục.
6. Tạo 5 câu trắc nghiệm → làm → nộp → có điểm, thống kê chương.
7. Chat: hỏi một nội dung có trong tài liệu và một nội dung không có (phải nói "không đề cập").
8. Giải bài bằng ảnh chụp đề.
9. Thêm bài tập, tick hoàn thành → Dashboard đổi tiến độ.

## 12. Cấu trúc thư mục

```
app/                 trang & API (App Router)
  (app)/             khu vực sau đăng nhập: dashboard, subjects/[id]/…, exams, notes
  api/documents/process   đọc + chunk + embed tài liệu
  api/ai/{outline,quiz/generate,quiz/grade,solve,chat}
  api/export         sao lưu JSON
components/          giao diện (client components)
lib/ai/              provider (Claude/OpenAI), embed, retrieve (RAG), prompts
lib/documents/       extract (PDF/DOCX/PPTX/XLSX/TXT/ảnh), chunk, process
lib/supabase/        client / server / middleware
supabase/migrations/ schema + RLS + storage + hàm tìm kiếm
```
