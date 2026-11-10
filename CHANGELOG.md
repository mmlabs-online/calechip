# Changelog

Mỗi dòng dưới đây tương ứng một tag đã deploy. **Tag là đơn vị deploy, không phải branch** — branch
`release/v<MAJOR>.<MINOR>` mang các tag patch của nó, và production luôn được dựng từ một tag.

Quy trình cắt release, và lý do của từng bước, nằm trong
[.ai/standards/git-conventions.md](.ai/standards/git-conventions.md).

## v1.0.0 — 2026-09-20

Bản release đầu tiên. Cắt từ `main` tại `5ce3e22`, trên branch `release/v1.0`.

**Triển khai bằng tay:** `pnpm install && pnpm build`, rồi copy `dist/` lên host. `dist` nằm trong
`.gitignore` nên không có artifact nào trong git — mọi lần deploy đều dựng lại từ nguồn. Bundle cần
`VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` tại thời điểm **build**, không phải lúc chạy: Vite
inline chúng vào bundle. Xem [.env.example](.env.example).

### Có gì trong bản này

35 ticket đã đi hết vòng loop và merge vào `main`:

- **TEA-02 … TEA-05** — thành viên, vai trò, danh sách team.
- **CAL-01 … CAL-10** — lịch tuần, tháng, năm; tạo và sửa entry PTO/WFH.
- **ADM-01 … ADM-06** — ngưỡng quá tải, lịch nghỉ lễ quốc gia, hàng chờ duyệt, quyết định entry.
- **UIE-01 … UIE-10** — vỏ giao diện, sidebar, top bar, admin hub.
- **BUG-001, BUG-002, OPS-001, OPS-002, OPS-004** — sửa lỗi và hạ tầng.

Sau `UIE-10` còn năm commit đẩy thẳng lên `main`, ngoài loop và không qua CI, viết lại sidebar,
top bar, admin tabs và thêm avatar cùng tooltip entry. Chúng nằm trong bản release này.

### ⚠️ Bản này được cắt với gate ĐỎ, có chủ ý

Quyết định của operator ngày 2026-09-20: cắt ngay và ghi nhận, thay vì chặn release.
**`vite build`, `tsc --noEmit` và unit test đều PASS** — ứng dụng dựng và chạy được. Đỏ ở những chỗ sau:

| Kiểm tra | Trạng thái | Nguyên nhân |
|---|---|---|
| `playwright test` | 20 fail / 267 pass | Năm commit ngoài loop đổi giao diện mà không cập nhật acceptance suite của các ticket đã ship |
| `eslint .` | 1 lỗi | `NAV_LINK` không dùng tới ở `src/components/Sidebar.tsx:103` — phần sót lại của cùng đợt sửa đó |
| `check-docs.mjs` | 11 lỗi | Drift trong `.ai/registry/**` và `.ai/steward/context.md` |
| hook/script tests | 4 fail / 229 | Toàn bộ là meta-test khẳng định repo tự pass audit của nó; hệ quả của dòng trên, không phải defect riêng |

Hai hỏng hóc cụ thể trong giao diện, đã xác minh chứ không suy đoán:

- `home-month-link` **không còn tồn tại** trong `src`.
- `home-week-link` có trong `Sidebar.tsx` nhưng render **0 node** cho một member trên `/week` — nó
  đã bị đưa vào sau một điều kiện role mới trong `src/lib/roles.ts`.

Hai defect trong registry, cần một con người xử lý dưới RULE-01:

- **Hai file cùng mang số ADR-033** — `a-person-joins-by-signing-up…` và `review-check-r9-compares…`.
- **ADR-034 không có front-matter.**

### Owed — nợ lại, không phải quên

- **Branch protection vẫn TẮT** trên `main` và `release/*`. Cố ý: `verify` chưa từng xanh, và bật một
  required check chưa bao giờ pass sẽ chặn mọi PR kể cả của operator —
  `.ai/standards/git-conventions.md` § Branch protection.
- **`verify.yml` chưa chạy trên `release/**`** — nó mới chỉ trigger trên `pull_request` và
  `push: main`. Thêm trigger khi bộ kiểm tra đã xanh, chứ không phải bây giờ.
- **`git-conventions.md` § The four names chưa có hàng `release/`.** Là plane human-only, cần một ADR.
- **Deploy target chưa được ghi vào chuẩn** — `.ai/standards/tech-stack.md:157` vẫn là `TODO(project)`.
  Quyết định thực tế là build thủ công rồi copy `dist`.
