# 01_SECURITY_AND_ATTACKS.md — Phòng ngừa Lỗ hổng Bảo mật & Tấn công Hệ thống (Vietstar Logistics)

> **Tài liệu bắt buộc dành cho mọi AI Coding Assistant & Thành viên Team KHA trước khi viết code Backend (`vietstar-server-api`) và Frontend (`vietstar-web-internal`, `vietstar-web-customer`).**
> Mọi đoạn code sinh ra vi phạm các quy tắc trong tài liệu này đều bị từ chối khi Review PR.

---

## Tình huống 1: Tấn công SQL Injection qua Bộ lọc Tìm kiếm & Sắp xếp Động (`ORDER BY`, `IN`, `LIKE`)

#### (1) Kịch bản thực tế

- Nhân viên điều phối hoặc kẻ tấn công gửi request tìm kiếm vận đơn với tham số sắp xếp hoặc lọc bị chèn mã độc:
  `GET /api/v1/shipments?status=in_warehouse&sort=created_at;DROP TABLE shipments--&dir=DESC`
- Hoặc trên ô tìm kiếm công khai `GET /api/v1/public/tracking?codes=VS001') UNION SELECT 1,token_hash,3 FROM personal_access_tokens--`.

#### (2) Hậu quả nếu code ẩu

- Nếu bật `PDO::ATTR_EMULATE_PREPARES => true` (mặc định của PHP PDO), PHP tự ghép chuỗi tham số trước khi gửi sang MySQL, tạo kẽ hở vượt qua cơ chế escape khi dùng sai bộ mã ký tự.
- Nếu nối chuỗi trực tiếp biến `$sort`, `$dir` vào `ORDER BY $sort $dir` hoặc ghép chuỗi mảng ID vào `WHERE id IN ($ids)`, kẻ tấn công có thể trích xuất toàn bộ dữ liệu bảng `users`, `personal_access_tokens`, sửa số tiền `cod_amount` hoặc phá hủy dữ liệu vận hành.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Tắt giả lập Prepare ở cấp kết nối PDO**: Bắt buộc cấu hình `PDO::ATTR_EMULATE_PREPARES => false` để MySQL 8.0 biên dịch câu lệnh SQL và truyền tham số tách biệt hoàn toàn qua giao thức nhị phân.
2. **Whitelist 100% cho `ORDER BY` và chiều sắp xếp**: Chỉ cho phép các tên cột nằm trong mảng hằng số định nghĩa sẵn; mọi giá trị lạ tự động rơi về mặc định `created_at DESC`.
3. **Bind động từng phần tử cho mệnh đề `IN (...)`**: Tạo mảng placeholder `?` đúng bằng số phần tử của mảng đầu vào và truyền mảng giá trị vào `$stmt->execute($params)`.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

final class Database
{
    private static ?PDO $instance = null;

    public static function getConnection(array $config): PDO
    {
        if (self::$instance === null) {$dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $config['host'],
                $config['port'],$config['database']
            );

            self::$instance = new PDO($dsn, $config['username'],$config['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
        }

        return self::$instance;
    }
}
```

```php
<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Repositories;

use PDO;

final class ShipmentSearchRepository
{
    private const ALLOWED_SORT_COLUMNS = [
        'created_at' => 's.created_at',
        'cod_amount' => 's.cod_amount',
        'total_freight_amount' => 's.total_freight_amount',
        'chargeable_weight_gram' => 's.chargeable_weight_gram',
    ];

    public function __construct(private readonly PDO $pdo) {}

    /**
     * Tìm kiếm vận đơn theo danh sách mã vận đơn và sắp xếp an toàn.
     *
     * @param array<int, string> $trackingCodes
     * @param string $sortBy
     * @param string $sortDir
     * @return array<int, array<string, mixed>>
     */
    public function findByTrackingCodes(array $trackingCodes, string $sortBy, string$sortDir): array
    {
        if ($trackingCodes === []) {
            return [];
        }

        $safeColumn = self::ALLOWED_SORT_COLUMNS[$sortBy] ?? 's.created_at';
        $safeDirection = strtoupper($sortDir) === 'ASC' ? 'ASC' : 'DESC';

        $placeholders = implode(', ', array_fill(0, count($trackingCodes), '?'));$sql = "SELECT s.public_id, s.tracking_code, s.status, s.cod_amount, s.created_at
                FROM shipments s
                WHERE s.tracking_code IN ({$placeholders})
                  AND s.deleted_at IS NULL
                ORDER BY {$safeColumn} {$safeDirection}";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(array_values($trackingCodes));

        return $stmt->fetchAll();
    }
}
```

- **Quy tắc bắt buộc cho AI**: Cấm tuyệt đối nối biến `$...` trực tiếp vào chuỗi SQL. Nếu cần `ORDER BY`, `GROUP BY`, tên bảng hoặc `IN (...)`, bắt buộc dùng mảng Whitelist hoặc `array_fill` tạo dấu `?`.

---

## Tình huống 2: Lỗ hổng IDOR Vượt Phạm vi Chi nhánh / Kho (`user_branch_scopes`)

#### (1) Kịch bản thực tế

- Nhân viên tiếp tân thuộc Bưu cục Quận 1 (`branch_id = 12`) đăng nhập hợp lệ, sau đó mở DevTools sửa URL từ `GET /api/v1/shipments/10542` thành `GET /api/v1/shipments/10543` (vận đơn thuộc Chi nhánh Cần Thơ `branch_id = 45`).
- Hoặc kẻ tấn công gửi payload tạo/sửa vận đơn có kèm `"origin_branch_id": 45, "actor_id": 1` hòng giả mạo chi nhánh phát sinh đơn và đổ trách nhiệm thao tác cho người khác.

#### (2) Hậu quả nếu code ẩu

- Nếu dùng `id` tự tăng tuần tự làm tham số URL và quên lọc theo `user_branch_scopes`, nhân viên ở một bưu cục nhỏ có thể dò quét toàn bộ dữ liệu vận đơn, doanh thu COD và thông tin khách hàng của toàn quốc.
- Nếu tin tưởng `branch_id` hoặc `user_id` gửi lên từ JSON body của client, kẻ gian có thể tạo đơn khống hoặc chốt phiếu kho hộ chi nhánh khác.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Dùng `public_id` (ULID 26 ký tự) thay cho `id` tuần tự** trên toàn bộ URL và JSON Response của các thực thể nghiệp vụ (`shipments`, `pickup_requests`, `warehouse_receipts`, `manifest_bags`, `cash_collections`, `cash_remittances`, `compensations`).
2. **Xác thực `X-Branch-Id` qua `BranchScopeMiddleware`**: Đọc danh sách quyền phạm vi từ bảng `user_branch_scopes` của user đăng nhập (`hq_all`, `region_center`, `branch`, `post_office`, `warehouse`). Nếu `X-Branch-Id` không thuộc danh sách được cấp quyền -> trả ngay lỗi `403_BRANCH_SCOPE`.
3. **Tiêm điều kiện lọc tự động qua `ScopeGuard`**: Mọi truy vấn đọc/sửa dữ liệu vận hành phải gọi `ScopeGuard` để gắn điều kiện `WHERE` giới hạn đúng các chi nhánh/kho thuộc quyền user. Mọi trường `branch_id`, `warehouse_id`, `created_by`, `actor_id` khi ghi DB bắt buộc lấy từ `AuthContext` / `ScopeContext` trên Server, **bỏ qua hoàn toàn** nếu client gửi kèm trong body.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

final class ScopeGuard
{
    /**
     * Sinh đoạn điều kiện SQL và tham số lọc theo phạm vi chi nhánh/kho của user.
     *
     * @param array{scope_type: string, allowed_branch_ids: array<int, int>, allowed_warehouse_ids: array<int, int>} $scopeContext
     * @param string $branchColumn
     * @param array<string, mixed> $params
     * @return string
     */
    public static function buildBranchWhereClause(
        array $scopeContext,
        string $branchColumn,
        array &$params
    ): string {
        if ($scopeContext['scope_type'] === 'hq_all') {
            return '1 = 1';
        }

        $branchIds =$scopeContext['allowed_branch_ids'];
        if ($branchIds === []) {
            throw new RuntimeException('403_BRANCH_SCOPE');
        }

        $namedKeys = [];
        foreach ($branchIds as $index =>$branchId) {
            $key = ":scope_branch_{$index}";
            $namedKeys[] =$key;
            $params[$key] =$branchId;
        }

        return sprintf('%s IN (%s)', $branchColumn, implode(', ',$namedKeys));
    }

    /**
     * Kiểm tra quyền truy cập một bản ghi cụ thể theo branch_id của bản ghi đó.
     *
     * @param array{scope_type: string, allowed_branch_ids: array<int, int>} $scopeContext
     * @param int $targetBranchId
     * @return void
     */
    public static function assertBranchAccess(array $scopeContext, int$targetBranchId): void
    {
        if ($scopeContext['scope_type'] === 'hq_all') {
            return;
        }

        if (!in_array($targetBranchId,$scopeContext['allowed_branch_ids'], true)) {
            throw new RuntimeException('403_BRANCH_SCOPE');
        }
    }
}
```

- **Quy tắc bắt buộc cho AI**:
  - Tuyệt đối không viết endpoint nhận `/{id}` số nguyên cho các bảng có cột `public_id`.
  - Mọi câu lệnh `SELECT` danh sách trên `shipments`, `pickup_requests`, `warehouse_receipts`, `cod_transactions`, `cash_collections`, `compensations` bắt buộc gọi `ScopeGuard::buildBranchWhereClause()`.

---

## Tình huống 3: Tấn công Brute-force Đăng nhập & Thu hồi Token Tức thì Khi Khóa Tài khoản Nhân viên

#### (1) Kịch bản thực tế

- Kẻ tấn công dùng công cụ tự động thử hàng ngàn mật khẩu vào tài khoản Kế toán Trung tâm (`hq_accountant`) qua API `POST /api/v1/auth/login`.
- Một nhân viên kho hoặc kế toán bưu cục nghỉ việc đột xuất; Quản trị viên đã bấm "Khóa tài khoản" (`users.status = 'suspended'`) trên Web Nội bộ, nhưng nhân viên này vẫn đang mở sẵn phiên đăng nhập cũ chứa `Bearer Token` còn thời hạn.

#### (2) Hậu quả nếu code ẩu

- Nếu không giới hạn số lần đăng nhập sai, tài khoản nội bộ dễ bị dò ra mật khẩu.
- Nếu lưu token dạng văn bản thuần trong DB, khi lộ bản dump DB kẻ tấn công chiếm đoạt toàn bộ phiên đang hoạt động.
- Nếu chỉ kiểm tra `users.status = 'active'` lúc đăng nhập mà không kiểm tra lại ở `AuthMiddleware` hoặc không thu hồi `personal_access_tokens.revoked_at`, nhân viên đã bị khóa tài khoản vẫn có thể duyệt chi tiền, xuất kho hoặc hủy đơn cho đến khi token tự hết hạn.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Chống Brute-force qua bảng `login_attempts`**: Đếm số lần thất bại (`is_success = 0`) theo cặp `(identifier, ip_address)` trong 15 phút gần nhất. Đạt ngưỡng **5 lần sai** -> từ chối ngay với mã `429_TOO_MANY_REQUESTS` mà không chạy hàm `password_verify()` tốn CPU.
2. **Lưu Token băm SHA-256 (`token_hash`)**: Client giữ `<plain_token>`, Database chỉ lưu `hash('sha256', $plainToken)` trong `personal_access_tokens.token_hash`.
3. **Thu hồi đồng bộ & Kiểm tra kép trong `AuthMiddleware`**:
   - Ngay khi Admin khóa tài khoản hoặc đổi mật khẩu user, chạy trong cùng Transaction: `UPDATE personal_access_tokens SET revoked_at = NOW() WHERE user_id = :user_id AND revoked_at IS NULL`.
   - Trong `AuthMiddleware`, bắt buộc `INNER JOIN users u ON u.id = pat.user_id` và kiểm tra đồng thời `pat.revoked_at IS NULL`, `pat.expires_at > NOW()`, và `u.status = 'active'`.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Middleware;

use PDO;
use RuntimeException;

final class AuthMiddleware
{
    public function __construct(private readonly PDO $pdo) {}

    /**
     * Xác thực Bearer Token và kiểm tra trạng thái hoạt động tức thì của tài khoản.
     *
     * @param string|null $authorizationHeader
     * @return array<string, mixed>
     */
    public function authenticate(?string $authorizationHeader): array
    {
        if ($authorizationHeader === null \vert{}\vert{} !str_starts_with($authorizationHeader, 'Bearer ')) {
            throw new RuntimeException('401_UNAUTHORIZED');
        }

        $plainToken = trim(substr($authorizationHeader, 7));
        if ($plainToken === '') {
            throw new RuntimeException('401_UNAUTHORIZED');
        }

        $tokenHash = hash('sha256',$plainToken);

        $sql = "SELECT pat.id AS token_id, pat.client_type,
                       u.id AS user_id, u.public_id, u.full_name, u.status, u.must_change_password
                FROM personal_access_tokens pat
                INNER JOIN users u ON u.id = pat.user_id
                WHERE pat.token_hash = :token_hash
                  AND pat.revoked_at IS NULL
                  AND pat.expires_at > NOW()
                  AND u.deleted_at IS NULL
                LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':token_hash' =>$tokenHash]);
        $session =$stmt->fetch();

        if ($session === false \vert{}\vert{}$session['status'] !== 'active') {
            throw new RuntimeException('401_UNAUTHORIZED');
        }

        return $session;
    }
}
```

- **Quy tắc bắt buộc cho AI**: Mọi thao tác khóa tài khoản (`status = 'suspended'` / `'inactive'`) hoặc đổi mật khẩu bắt buộc phải cập nhật `revoked_at = NOW()` cho toàn bộ token đang hoạt động của `user_id` đó trong bảng `personal_access_tokens`.

---

## Tình huống 4: Upload File Độc hại (Web Shell Giả mạo Ảnh Biên lai & CSV/Formula Injection)

#### (1) Kịch bản thực tế

- **Kịch bản A (Upload Web Shell)**: Kẻ tấn công tải lên tệp `bien_lai.php.jpg` hoặc chèn mã `<?php system($_GET['cmd']); ?>` vào metadata EXIF của ảnh biên lai nộp tiền (`cash_remittances`) hoặc ảnh chứng từ sự cố (`shipment_incidents`).
- **Kịch bản B (CSV/Formula Injection)**: Người gửi cố tình nhập tên người nhận hoặc ghi chú hàng hóa là `=CMD|' /C powershell -w hidden ...'!A0`. Khi Kế toán hoặc Điều phối xuất danh sách vận đơn/công nợ COD ra file `.csv`/`.xlsx` và mở trên Microsoft Excel, Excel tự động thực thi công thức độc hại.

#### (2) Hậu quả nếu code ẩu

- Nếu lưu file upload với tên gốc trong thư mục `public/uploads/` mà không kiểm tra MIME thực tế hoặc không chặn thực thi PHP, kẻ tấn công chỉ cần truy cập URL ảnh là chiếm toàn quyền điều khiển máy chủ Hosting.
- Nếu xuất nguyên văn chuỗi bắt đầu bằng `=`, `+`, `-`, `@` ra CSV/Excel, máy tính nội bộ của Kế toán sẽ bị nhiễm mã độc qua tính năng DDE/Formula của Excel.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Kiểm tra MIME thực tế & Re-encode ảnh**:
   - Không tin `$_FILES['file']['type']` hay đuôi file client gửi lên. Dùng `finfo_open(FILEINFO_MIME_TYPE)` xác minh chỉ cho phép `image/jpeg`, `image/png`, `image/webp` và dung lượng tối đa `5MB`.
   - Dùng thư viện GD (`imagecreatefromjpeg` / `imagecreatefrompng`) vẽ lại ảnh mới để **xóa sạch 100% mã nhúng ẩn trong EXIF/comment**, lưu dưới tên ngẫu nhiên ULID/UUID và đặt file `.htaccess` trong `storage/uploads/` với nội dung `php_flag engine off` + `Options -ExecCGI`.
2. **Vô hiệu hóa Formula Injection khi xuất CSV/Excel**:
   - Mọi ô dữ liệu dạng chuỗi trước khi ghi vào CSV/Excel nếu bắt đầu bằng các ký tự kích hoạt công thức (`=`, `+`, `-`, `@`, `\t`, `\r`) bắt buộc chèn thêm ký tự nháy đơn `'` ở đầu chuỗi.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

final class FileSecurityHelper
{
    private const ALLOWED_IMAGE_MIMES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    /**
     * Xác thực, làm sạch metadata EXIF và lưu ảnh chứng từ an toàn.
     *
     * @param array{tmp_name: string, size: int, error: int} $uploadedFile
     * @param string $targetDirectory
     * @return string Tên file an toàn đã lưu
     */
    public static function sanitizeAndStoreImage(array $uploadedFile, string$targetDirectory): string
    {
        if (($uploadedFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        if (($uploadedFile['size'] ?? 0) > 5 * 1024 * 1024) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detectedMime =$finfo !== false ? finfo_file($finfo,$uploadedFile['tmp_name']) : false;
        if ($finfo !== false) {
            finfo_close($finfo);
        }

        if ($detectedMime === false \vert{}\vert{} !isset(self::ALLOWED_IMAGE_MIMES[$detectedMime])) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        $extension = self::ALLOWED_IMAGE_MIMES[$detectedMime];
        $safeFileName = bin2hex(random_bytes(16)) . '.' .$extension;
        $destinationPath = rtrim($targetDirectory, '/') . '/' .$safeFileName;

        $imageResource = match ($detectedMime) {
            'image/jpeg' => @imagecreatefromjpeg($uploadedFile['tmp_name']),
            'image/png' => @imagecreatefrompng($uploadedFile['tmp_name']),
            'image/webp' => @imagecreatefromwebp($uploadedFile['tmp_name']),
        };

        if ($imageResource === false) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        match ($detectedMime) {
            'image/jpeg' => imagejpeg($imageResource,$destinationPath, 88),
            'image/png' => imagepng($imageResource,$destinationPath, 6),
            'image/webp' => imagewebp($imageResource,$destinationPath, 88),
        };
        imagedestroy($imageResource);

        return $safeFileName;
    }

    /**
     * Chống CSV/Excel Formula Injection cho dữ liệu xuất báo cáo.
     *
     * @param string|int|float|null $value
     * @return string
     */
    public static function sanitizeSpreadsheetCell(string|int|float|null $value): string
    {
        if ($value === null) {
            return '';
        }

        $str = (string)$value;
        if ($str !== '' && in_array($str[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'" . $str;
        }

        return $str;
    }
}
```

- **Quy tắc bắt buộc cho AI**: Không bao giờ dùng `move_uploaded_file()` lưu trực tiếp file ảnh của người dùng với tên gốc; luôn re-encode qua GD và sanitize mọi ô text trước khi xuất CSV/Excel.

---

## Tình huống 5: Lộ lọt Dữ liệu Cá nhân Khách hàng & Vi phạm Nghị định 13/2023/NĐ-CP

#### (1) Kịch bản thực tế

- Đối thủ viết script gọi liên tục API tra cứu công khai `GET /api/v1/public/tracking?codes=...` để thu thập danh sách số điện thoại, họ tên và địa chỉ chi tiết của khách hàng gửi/nhận hàng.
- Hoặc lộ bản sao lưu cơ sở dữ liệu làm lộ toàn bộ số điện thoại khách hàng và số tài khoản ngân hàng nhận tiền hoàn COD (`customers.bank_account_no_encrypted`).

#### (2) Hậu quả nếu code ẩu

- Nếu lưu SĐT và số tài khoản ngân hàng dưới dạng văn bản thuần (`VARCHAR`) hoặc trả thẳng SĐT đầy đủ ra API tra cứu công khai, hệ thống vi phạm nghiêm trọng **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu cá nhân, đồng thời tạo điều kiện cho kẻ xấu mạo danh shipper lừa đảo thu tiền COD của khách hàng.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Mô hình lưu trữ 3 cột chuẩn cho SĐT (`*_encrypted`, `*_hash`, `*_masked`)**:
   - `phone_encrypted` (`VARBINARY(255)`): Mã hóa bằng **AES-256-GCM** kèm `iv` (12 bytes) và `tag` (16 bytes).
   - `phone_hash` (`CHAR(64)`): Băm **HMAC-SHA256** với khóa bí mật riêng (`PII_HASH_KEY`) sau khi chuẩn hóa SĐT về dạng `0xxxxxxxxx`, phục vụ truy vấn tìm kiếm `WHERE phone_hash = :hash` với tốc độ Index O(log N) mà không cần giải mã toàn bảng.
   - `phone_masked` (`VARCHAR(20)`): Chuỗi che ký tự cố định (VD: `090***6789`) lưu sẵn để hiển thị.
2. **Phân tách đầu ra theo `X-Client-Type` & Quyền hạn**:
   - API `web_public` (`/api/v1/public/*`) **chỉ được trả về `sender_phone_masked` và `recipient_phone_masked`**, đồng thời ẩn số nhà chi tiết (chỉ hiện Phường/Xã, Quận/Huyện, Tỉnh/TP).
   - Chỉ nhân viên nội bộ đang xử lý vận đơn hoặc tài xế được gán đơn mới được giải mã `*_encrypted` qua `Crypto::decrypt()`.
3. **Bắt buộc ghi nhận Consent (`user_consents`)**: API đăng ký tài khoản khách hàng bắt buộc yêu cầu trường `accepted_privacy_policy === true` và lưu bản ghi kèm `ip_address`, `user_agent`, `consent_version` vào bảng `user_consents`.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

final class Crypto
{
    private const CIPHER = 'aes-256-gcm';

    /**
     * Mã hóa dữ liệu nhạy cảm (SĐT, số tài khoản ngân hàng) bằng AES-256-GCM.
     *
     * @param string $plainText
     * @param string $binaryKey Khóa nhị phân 32 bytes
     * @return string Dữ liệu nhị phân (IV 12B + TAG 16B + Ciphertext)
     */
    public static function encrypt(string $plainText, string$binaryKey): string
    {
        $iv = random_bytes(12);$tag = '';
        $ciphertext = openssl_encrypt($plainText,
            self::CIPHER,
            $binaryKey,
            OPENSSL_RAW_DATA,
            $iv,$tag,
            '',
            16
        );

        if ($ciphertext === false) {
            throw new RuntimeException('500_INTERNAL_ERROR');
        }

        return $iv . $tag .$ciphertext;
    }

    /**
     * Giải mã dữ liệu AES-256-GCM.
     *
     * @param string $binaryPayload
     * @param string $binaryKey
     * @return string
     */
    public static function decrypt(string $binaryPayload, string$binaryKey): string
    {
        if (strlen($binaryPayload) < 29) {
            throw new RuntimeException('500_INTERNAL_ERROR');
        }

        $iv = substr($binaryPayload, 0, 12);
        $tag = substr($binaryPayload, 12, 16);
        $ciphertext = substr($binaryPayload, 28);

        $plainText = openssl_decrypt($ciphertext,
            self::CIPHER,
            $binaryKey,
            OPENSSL_RAW_DATA,
            $iv,$tag
        );

        if ($plainText === false) {
            throw new RuntimeException('500_INTERNAL_ERROR');
        }

        return $plainText;
    }

    /**
     * Tạo mã băm HMAC-SHA256 phục vụ tìm kiếm chính xác SĐT trong MySQL.
     *
     * @param string $normalizedPhone
     * @param string $hmacKey
     * @return string Chuỗi hex 64 ký tự
     */
    public static function hashPhone(string $normalizedPhone, string$hmacKey): string
    {
        return hash_hmac('sha256', trim($normalizedPhone),$hmacKey);
    }

    /**
     * Che số điện thoại hiển thị công khai (VD: 0901234567 -> 090***4567).
     *
     * @param string $normalizedPhone
     * @return string
     */
    public static function maskPhone(string $normalizedPhone): string
    {
        $clean = preg_replace('/\D+/', '',$normalizedPhone) ?? '';
        if (strlen($clean) < 7) {
            return '***';
        }

        return substr($clean, 0, 3) . '***' . substr($clean, -4);
    }
}
```

- **Quy tắc bắt buộc cho AI**:
  - Tuyệt đối không đưa các cột `*_encrypted` hoặc `*_hash` vào JSON Response.
  - Mọi truy vấn tìm kiếm khách hàng/vận đơn theo SĐT phải băm đầu vào qua `Crypto::hashPhone()` và so sánh bằng `phone_hash = :phone_hash`.
