# Product Brief — Team Leave & WFH Planner

*(tên tạm; gợi ý: **Vắng Mặt**, **DayOff**, **Nghỉ Gì Ta**, **Bunny Days**)*

**Phiên bản:** Draft v1
**Người soạn:** Min
**Trạng thái:** Đang định hình phạm vi

---

## 1. Tóm tắt

Một webapp nhẹ để mỗi thành viên trong team **khai báo trước** kế hoạch nghỉ phép (PTO) và làm việc từ xa (WFH) trong năm. Mục tiêu duy nhất: cả team nhìn thấy lịch của nhau đủ sớm để tự sắp xếp, tránh tình trạng quá nhiều người vắng mặt cùng lúc — đặc biệt quanh các dịp lễ.

Đây **không phải** hệ thống HR. Nó là bảng khai báo minh bạch, dùng để phối hợp công việc.

---

## 2. Vấn đề

Hiện tại kế hoạch vắng mặt nằm rải rác trong chat, trong đầu từng người, hoặc chỉ xuất hiện khi đơn xin nghỉ đã được gửi lên HR — tức là **quá muộn để điều chỉnh**.

Hệ quả:

- Sát ngày mới phát hiện 4–5 người cùng nghỉ một hôm, không kịp bàn giao.
- Quanh ngày lễ, ai cũng có xu hướng xin nghỉ/WFH "ngày cầu" để kéo dài kỳ nghỉ. Tất cả nhắm cùng một ngày, nhưng không ai biết người khác cũng đang nhắm.
- Kế hoạch du lịch cá nhân thường được đặt trước 3–6 tháng, nhưng team chỉ biết vào phút chót.
- Lead không có cách nào nhìn tổng thể quý tới để cảnh báo sớm.

Chi phí của việc không giải quyết: bàn giao gấp, deadline trượt, và những cuộc thương lượng khó chịu kiểu "em đặt vé rồi anh ơi".

---

## 3. Mục tiêu

1. **Khai báo sớm trở thành thói quen** — kế hoạch được nhập trung bình trước ít nhất 3–4 tuần, thay vì vài ngày.
2. **Không còn ngày "quá tải"** ngoài dự kiến — mọi ngày vượt ngưỡng 50% đều được phát hiện *tại thời điểm đăng ký*, không phải sau đó.
3. **Nhìn cả quý trong một màn hình** — lead trả lời được "tháng sau team mình thế nào?" trong dưới 10 giây.
4. **Ma sát nhập liệu gần bằng không** — đăng ký một khoảng nghỉ mất dưới 15 giây, không cần điền form dài.

---

## 4. Không làm (Non-goals)

| Không làm | Lý do |
|---|---|
| Quản lý quota ngày phép còn lại | Số liệu thuộc về HR system. Nếu lệch là mất niềm tin vào toàn bộ app. |
| Thay thế quy trình xin nghỉ chính thức | App này là lớp *lập kế hoạch*, đứng trước quy trình HR chứ không thay nó. |
| Chấm công, tính lương, theo dõi giờ làm | Bài toán khác hẳn, độ phức tạp và rủi ro cao. |
| Feature nhóm / rủ nhau đi chơi | Mỗi người đăng ký độc lập. Việc đi chung là chuyện ngoài app. |
| Book slot / gửi lời mời cho nhau | Không đúng use case. Đây là bảng thông tin, không phải công cụ đặt lịch. |

---

## 5. Người dùng

**Thành viên (Member)** — người khai báo. Cần nhập nhanh, xem được người khác, và biết ngay mình có đang chọn ngày "đông" hay không.

**Quản trị (Admin/Lead)** — người duyệt và giám sát. Cần nhìn tổng thể, phát hiện xung đột, và đánh dấu những đăng ký đã được chấp thuận.

Quy mô mục tiêu: team 5–30 người.

---

## 6. Khái niệm cốt lõi

### Đăng ký (Entry)
Một khoảng thời gian một người sẽ vắng mặt hoặc làm việc từ xa.

- **Loại:** `PTO` (nghỉ) hoặc `WFH`
- **Thời lượng:** cả ngày / nửa ngày (sáng hoặc chiều)
- **Khoảng:** một ngày hoặc nhiều ngày liên tiếp
- **Ghi chú:** tự do, không bắt buộc

### Tag "Chưa chốt" (Tentative)
Đánh dấu kế hoạch còn có thể thay đổi. Vẫn hiển thị đầy đủ cho cả team, vẫn tính vào cảnh báo — chỉ khác về mặt thị giác (viền nét đứt, màu nhạt hơn).

Đây là cơ chế quan trọng nhất để khuyến khích khai báo sớm: người ta chỉ dám nhập trước 4 tháng nếu biết mình được phép đổi ý.

### Trạng thái duyệt
`Chờ duyệt` → `Đã duyệt` (⭐ sao vàng) hoặc `Từ chối`.

Sao vàng là tín hiệu "cái này chắc chắn rồi" — vừa để người khác yên tâm né, vừa là động lực nhẹ để member chốt kế hoạch sớm.

### Ngưỡng cảnh báo
Một ngày được coi là **quá tải** khi tổng số người `PTO + WFH` vượt **50% quân số team**. Nửa ngày tính 0.5.

Cảnh báo là **mềm** — hiện cảnh báo, không chặn thao tác. Ngưỡng cấu hình được.

### Ngày cầu (Bridge Day)
Ngày làm việc bị kẹp giữa ngày lễ và cuối tuần. App tự tính từ lịch lễ Việt Nam và đánh dấu sẵn, kèm số người đã đăng ký ngày đó.

---

## 7. Yêu cầu

### P0 — Bắt buộc có

**7.1. Ba chế độ xem**

| View | Dùng khi | Hiển thị |
|---|---|---|
| **Tuần** | Điều phối công việc hằng ngày | Chi tiết từng người, có phân biệt nửa ngày, ghi chú, ai duyệt |
| **Tháng** | Xem mặc định | Lưới ngày, avatar/mascot của người vắng trong mỗi ô, ngày quá tải nổi bật |
| **Năm** | Lập kế hoạch dài hạn | Mỗi người một hàng, 365 cột nhỏ. Nhìn phát biết ai nghỉ nhiều, cụm nào chồng nhau |

*Acceptance:*
- [ ] Chuyển view giữ nguyên mốc thời gian đang xem
- [ ] Cả 3 view đều phân biệt rõ PTO / WFH / tentative / đã duyệt
- [ ] View năm chịu được 30 người mà vẫn cuộn mượt

**7.2. Tạo và sửa đăng ký**
- Kéo chọn nhiều ngày liên tiếp trên lịch, hoặc chọn khoảng ngày bằng date picker
- Chọn loại (PTO/WFH), thời lượng (cả ngày/nửa ngày), bật tag tentative
- Sửa/xoá đăng ký của chính mình bất cứ lúc nào
- Đăng ký đã duyệt mà bị sửa → tự động quay về trạng thái chờ duyệt

*Acceptance:*
- [ ] Given tôi kéo chọn 5 ngày → When chọn PTO và lưu → Then tạo ra một đăng ký duy nhất, không phải 5 bản ghi rời
- [ ] Không tạo được đăng ký chồng lấn với đăng ký khác của cùng người

**7.3. Cảnh báo quá tải**
- Hiện cảnh báo **ngay trong lúc người dùng đang chọn ngày**, trước khi bấm lưu
- Nội dung cụ thể: ngày nào, hiện có bao nhiêu người, là những ai
- Ngày quá tải được đánh dấu rõ trên cả 3 view
- Không chặn — người dùng vẫn lưu được

*Acceptance:*
- [ ] Given team 10 người, ngày 30/4 đã có 5 người đăng ký → When tôi chọn ngày đó → Then hiện cảnh báo kèm danh sách 5 người, nút Lưu vẫn hoạt động

**7.4. Duyệt (Admin)**
- Danh sách chờ duyệt, duyệt/từ chối được hàng loạt
- Đăng ký đã duyệt hiển thị ⭐ ở mọi view
- Admin duyệt được cả đăng ký đang có tag tentative
- Từ chối phải kèm lý do

**7.5. Lịch lễ Việt Nam & ngày cầu**
- Bộ lịch lễ dựng sẵn theo năm: Tết Dương lịch, Tết Âm lịch, Giỗ Tổ Hùng Vương, 30/4 – 1/5, Quốc khánh 2/9
- Admin nhập được lịch nghỉ bù / hoán đổi do nhà nước công bố hằng năm
- Ngày cầu được tự động phát hiện và highlight

**7.6. Quản lý team**
- Admin mời thành viên qua email hoặc link
- Hai vai trò: Member, Admin
- Ai cũng xem được lịch của mọi người trong team (minh bạch là chủ đích thiết kế)

---

### P1 — Nên có, làm ngay sau khi ra mắt

- **Nhắc nhở** — thông báo cho lead khi có ngày quá tải mới; nhắc member "tháng sau có 3 ngày cầu, đăng ký chưa?"
- **Tích hợp Slack/Teams/Zalo** — bản tin đầu tuần: ai vắng tuần này
- **Xuất file** — CSV/Excel để đối chiếu với HR
- **Lịch lặp** — "thứ Sáu nào tôi cũng WFH", set một lần cho cả quý
- **Feed thay đổi** — ai vừa đăng ký/huỷ gì, để không ai bị bất ngờ
- **Lịch chỉ-đọc (iCal)** — subscribe vào Google Calendar

### P2 — Ngoài phạm vi v1, nhưng thiết kế nên chừa chỗ

- Nhiều team / nhiều phòng ban trong một workspace
- Ràng buộc theo vai trò ("hai người này không được nghỉ cùng ngày")
- Ngưỡng cảnh báo riêng theo từng giai đoạn (ví dụ tuần release chỉ cho 20%)
- Đồng bộ hai chiều với HR system
- Recap cuối năm

---

## 8. Hướng thiết kế

**Nguyên tắc:** giao diện dễ thương ở phần vỏ, chặt chẽ ở phần lõi. Lưới lịch là màn hình dùng nhiều nhất — nó phải dày đặc và dễ đọc. Chất "cute" dồn vào những chỗ không ảnh hưởng mật độ thông tin.

| Yếu tố | Hướng xử lý |
|---|---|
| Bảng màu | Pastel — PTO tông cam/đào, WFH tông xanh mint, ngày lễ tông tím lavender, ngày quá tải tông hồng cảnh báo (không dùng đỏ gắt) |
| Nhận diện người | Avatar bo tròn hoặc mascot thú nhỏ ở đầu mỗi hàng — đây là nơi chính để tạo cảm giác thân thiện |
| Tentative | Viền nét đứt + độ mờ giảm. Không dùng icon riêng, tránh làm rối ô ngày |
| Đã duyệt | ⭐ nhỏ ở góc, có animation nhẹ lúc được duyệt |
| Chữ | Font bo tròn có dấu tiếng Việt chuẩn — Nunito hoặc Baloo 2. Tránh Quicksand (dấu xấu) |
| Chuyển động | Nhẹ và ngắn. Confetti khi được duyệt, hiệu ứng kéo chọn ngày mượt. Không animation trên lưới năm |
| Empty state | Minh hoạ dễ thương — đây là nơi an toàn nhất để "cute" thoải mái |

**Cân nhắc quan trọng:** giao diện dễ thương dễ làm mất mật độ thông tin. Nên có công tắc chuyển giữa chế độ **Vui** (mascot, màu đầy đủ) và chế độ **Gọn** (compact, phù hợp cho lead xem view năm).

---

## 9. Đo lường thành công

**Chỉ số sớm (2–4 tuần):**
- Tỷ lệ thành viên đã nhập ít nhất một đăng ký: mục tiêu > 80%
- Thời gian trung bình từ lúc nhập đến ngày nghỉ: mục tiêu > 21 ngày
- Số đăng ký được tạo mỗi tuần

**Chỉ số muộn (1 quý):**
- Số ngày quá tải thực tế xảy ra: mục tiêu giảm rõ rệt so với quý trước
- Tỷ lệ đăng ký được tạo trước ngày lễ ≥ 30 ngày
- Tỷ lệ đăng ký tentative sau đó được chuyển thành đã duyệt — cho biết tag tentative có thực sự khuyến khích khai báo sớm hay không
- Đánh giá định tính từ lead: "có dễ sắp xếp công việc hơn không?"

**Tín hiệu thất bại cần theo dõi:** nếu tỷ lệ nhập liệu tụt dưới 50% sau tháng đầu, vấn đề nằm ở thói quen chứ không phải tính năng — cần giải quyết bằng nhắc nhở và tích hợp chat, không phải bằng cách thêm feature.

---

