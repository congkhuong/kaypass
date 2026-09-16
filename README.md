# 🔐 KayPass - Chrome Extension Quản lý Mật khẩu Mã hóa & Đồng bộ Google Drive

**KayPass** là tiện ích mở rộng trên Google Chrome (Manifest V3) hỗ trợ lưu trữ tài khoản/mật khẩu an toàn với cơ chế **Mã hóa Client-Side Zero-Knowledge (AES-256-GCM)**, tự động điền form đăng nhập, cùng khả năng sao lưu dữ liệu đã mã hóa trực tiếp lên **Google Drive** và **Server Bên Thứ Ba**.

---

## 🌟 Tính năng Nổi bật

- 🛡️ **Mã hóa Zero-Knowledge (AES-256-GCM)**: Dữ liệu mật khẩu của bạn được mã hóa hoàn toàn trên trình duyệt trước khi lưu trữ hoặc đẩy lên mây. Phía Google Drive / Server bên thứ 3 chỉ lưu giữ bản mã hóa (Ciphertext ngẫu nhiên), không bao giờ có thể đọc được mật khẩu gốc.
- 🔑 **Ràng buộc Duy nhất Cặp (URL + Username)**: Đảm bảo không trùng lặp tài khoản cho cùng một trang web. Mỗi tài khoản theo URL và tên đăng nhập luôn duy nhất.
- ⚡ **Tự động điền (Autofill 1-Click)**: Tự động phát hiện ô đăng nhập trên trang web hiện tại và điền chính xác tài khoản/mật khẩu, hỗ trợ tốt các SPA framework (React, Vue, Angular).
- ☁️ **Đồng bộ Google Drive An toàn (`drive.appdata`)**: Sao lưu và khôi phục bản mã hóa trực tiếp trên thư mục ứng dụng riêng biệt (AppData) trên Google Drive của bạn.
- 🌐 **Lưu trữ Server / Webhook Bên Thứ Ba**: Hỗ trợ đẩy bản mã hóa qua HTTP POST đến API / Webhook tùy chỉnh.
- 📥 **Xuất & Nhập tệp JSON Mã hóa**: Tải bản sao lưu mã hóa về máy hoặc nhập khôi phục dễ dàng với đối soát chống trùng lặp.
- 🎲 **Trình tạo Mật khẩu Ngẫu nhiên An toàn**: Sinh mật khẩu mạnh với đầy đủ tùy chọn độ dài, chữ hoa/thường, số và ký tự đặc biệt.
- 🎨 **Giao diện Hiện đại Glassmorphism (Dark Mode)**: Sắc nét, tối ưu trải nghiệm người dùng.

---

## 🏗️ Cấu trúc Dự án

```
kaypass/
├── manifest.json         # Cấu hình Chrome Extension Manifest V3 & OAuth2
├── background.js          # Service Worker xử lý Session, Crypto & Google Drive REST API
├── js/
│   └── crypto.js          # Thư viện Crypto (Web Crypto API: PBKDF2 + AES-256-GCM)
├── content/
│   └── content.js         # Content Script tự động nhận diện & điền form đăng nhập
├── popup/
│   ├── popup.html         # Giao diện chính của tiện ích
│   ├── popup.css          # Styling Dark Mode Glassmorphism
│   └── popup.js           # Logic điều khiển Vault, tìm kiếm, Autofill & Password Generator
├── options/
│   ├── options.html       # Trang Cài đặt, Đồng bộ Google Drive, Webhook & File Backup
│   ├── options.css        # Styling cho trang Cài đặt
│   └── options.js         # Logic kết nối Google OAuth2, Google Drive & Export/Import
└── icons/                 # Bộ icon tiện ích (16x16, 48x48, 128x128)
```

---

## 🚀 Hướng dẫn Cài đặt vào Google Chrome

1. Tải hoặc clone thư mục dự án `kaypass` về máy.
2. Mở trình duyệt Chrome và truy cập: `chrome://extensions/`
3. Bật **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)**.
5. Trỏ tới thư mục `kaypass`.

---

## ☁️ Hướng dẫn Cấu hình Đồng bộ Google Drive

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) và tạo Project mới (Ví dụ: `KayPass`).
2. Vào **APIs & Services** > **Library** > Tìm `Google Drive API` > Bấm **Enable**.
3. Vào **Google Auth Platform** / **OAuth consent screen**:
   - Vào mục **Audience** > Thêm email Gmail của bạn vào mục **Test users** (hoặc bấm **Publish App** để xuất bản).
4. Vào **Credentials** > **Create Credentials** > **OAuth client ID**:
   - Chọn loại **Chrome Extension**.
   - Dán **Item ID** (Mã Extension ID hiển thị tại `chrome://extensions/` trên máy bạn).
   - Nhận mã **Client ID** được tạo (dạng: `xxxxxx.apps.googleusercontent.com`).
5. Điền mã Client ID vừa tạo vào file `manifest.json` tại mục `"oauth2.client_id"`.
6. Mở Chrome `chrome://extensions/` > Bấm **Reload** 🔄 trên KayPass.
7. Mở trang Cài đặt KayPass > Bấm **"Kết nối Tài khoản Google"** để hoàn tất!

---

## 🔒 Cơ chế Bảo mật (Security Architecture)

1. **Khóa Master (Master Password)**: Mật khẩu Master không bao giờ lưu trữ trên disk hay gửi qua mạng.
2. **PBKDF2 Key Derivation**: Tạo khóa giải mã AES-256 từ Master Password với 100,000 vòng lặp và Salt ngẫu nhiên 16-byte.
3. **Mã hóa AES-256-GCM**: Dữ liệu lưu trữ được mã hóa với IV ngẫu nhiên 12-byte, đảm bảo tính toàn vẹn và bảo mật cao nhất.
4. **Session Auto-Lock**: Tự động khóa Vault và xóa Master Key khỏi RAM sau 15 phút không hoạt động.

---

## 📄 Giấy phép (License)

Dự án được phát hành theo giấy phép MIT.
