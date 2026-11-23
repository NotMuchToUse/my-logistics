# 04_LOGISTICS_OPERATIONS_AND_COD_FRAUD.md — Phòng ngừa Sai sót Vận hành Kho & Gian lận / Lệch Quỹ COD (Vietstar Logistics)

> **Tài liệu bắt buộc dành cho mọi AI Coding Assistant & Thành viên Team KHA trước khi code các phân hệ Kho bãi (`Warehouse`), Điều phối (`Pickup/Shipment`), Kế toán Bưu cục/Trung tâm (`Finance`) và Đền bù (`IncidentCompensation`).**

---

## Tình huống 1: Quét Trùng 1 Vận Đơn Vào 2 Phiếu Xuất Kho Khác Nhau hoặc Quên Bấm "Chốt Phiếu Xuất Kho" Làm Treo Đơn

#### (1) Kịch bản thực tế

- **Kịch bản A (Quét trùng phiếu nháp)**: Nhân viên kho 1 lập phiếu xuất giao hàng (`outbound_delivery`, trạng thái `draft`) và quét vận đơn `VS26112300105` vào phiếu; cùng lúc nhân viên kho 2 lập phiếu xuất trung chuyển (`outbound_linehaul`, trạng thái `draft`) và cũng quét mã `VS26112300105` vào phiếu của mình.
- **Kịch bản B (Quên chốt phiếu)**: Nhân viên kho quét xong 35 vận đơn lên xe giao hàng nhưng quên bấm nút **"Chốt phiếu xuất kho"**, khiến phiếu mãi nằm ở trạng thái `draft` và 35 vận đơn vẫn giữ trạng thái `in_warehouse`.

#### (2) Hậu quả nếu code ẩu

- Nếu cho phép 1 vận đơn nằm đồng thời trong nhiều phiếu xuất kho `draft`: Khi phiếu 1 bấm chốt trước, phiếu 2 sau đó bấm chốt sẽ cướp quyền giao hàng (`assigned_driver_id`) hoặc gây lỗi trạng thái hàng loạt.
- Nếu không cảnh báo phiếu `draft` treo quá hạn: Hàng thực tế đã lên xe tài xế chạy ngoài đường nhưng trên App Tài xế không có đơn `out_for_delivery` để giao và thu tiền COD.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Khóa độc quyền vận đơn trong phiếu xuất kho `draft`**:
   - Khi API `POST /api/v1/warehouse-receipts/{public_id}/scan` quét mã vận đơn (hoặc túi Seal), bắt buộc khóa dòng `shipments ... FOR UPDATE` và kiểm tra xem `shipment_id` (hoặc `bag_id`) đã nằm trong bất kỳ `warehouse_receipts` nào đang ở trạng thái `draft` (và chưa bị gỡ `removed_at IS NULL`) hay chưa.
   - Nếu đã tồn tại trong phiếu `draft` khác -> từ chối ngay với **`422_VALIDATION_ERROR`** kèm thông báo rõ: _"Vận đơn này đang nằm trong phiếu xuất kho nháp [Mã phiếu], vui lòng gỡ khỏi phiếu cũ trước khi quét mới"_.
2. **Cảnh báo chủ động phiếu xuất kho `draft` treo quá 30 phút**:
   - API danh sách phiếu kho và Dashboard Kho trả về cờ cảnh báo `is_stale_draft = true` đối với các phiếu `status = 'draft'` tạo quá 30 phút chưa chốt. Trên `vietstar-web-internal`, hiển thị Banner cảnh báo đỏ cố định yêu cầu nhân viên kho chốt hoặc hủy phiếu nháp trước khi kết thúc ca.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Modules\Warehouse\Repositories;

use PDO;
use RuntimeException;

final class WarehouseScanGuardRepository
{
    public function __construct(private readonly PDO $pdo) {}

    /**
     * Kiểm tra vận đơn có đang bị khóa trong một phiếu kho nháp (draft) khác hay không.
     * Bắt buộc gọi bên trong PDO Transaction sau khi đã khóa dòng shipments FOR UPDATE.
     *
     * @param int $shipmentId
     * @param int $currentReceiptId
     * @return void
     */
    public function assertNotInOtherDraftReceipt(int $shipmentId, int $currentReceiptId): void
    {
        $sql = "SELECT wr.receipt_code
                FROM warehouse_receipt_items wri
                INNER JOIN warehouse_receipts wr ON wr.id = wri.receipt_id
                WHERE wri.shipment_id = :shipment_id
                  AND wri.removed_at IS NULL
                  AND wr.status = 'draft'
                  AND wr.id <> :current_receipt_id
                LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':shipment_id' => $shipmentId,
            ':current_receipt_id' => $currentReceiptId,
        ]);

        $conflictReceipt = $stmt->fetch();
        if ($conflictReceipt !== false) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }
    }
}
```

- **Quy tắc bắt buộc cho AI**: Mọi thao tác quét barcode thêm hàng vào phiếu xuất kho (`outbound_linehaul` hoặc `outbound_delivery`) bắt buộc kiểm tra trùng lặp cả trong cùng phiếu hiện tại lẫn các phiếu `draft` khác đang mở.

---

## Tình huống 2: Hàng Trung Chuyển Rời Kho A Nhưng Kho B Chưa Xác Nhận Nhập (Trách Nhiệm Bàn Giao Chain of Custody)

#### (1) Kịch bản thực tế

- Kho Cần Thơ (`Kho A`) chốt phiếu xuất trung chuyển (`outbound_linehaul`) gồm 40 vận đơn bàn giao cho Tài xế trung chuyển (`linehaul_driver`) chạy lên Trung tâm khai thác TP.HCM (`Kho B`).
- Khi xe cập bến Kho B, nhân viên Kho B mới quét nhập kho (`inbound`) được 38 đơn, thiếu 2 đơn (hoặc Kho B chưa bấm xác nhận nhập kho) thì hai kho xảy ra tranh chấp trách nhiệm làm mất hàng.

#### (2) Hậu quả nếu code ẩu

- Nếu khi Kho A bấm "Chốt phiếu xuất trung chuyển" mà code cập nhật thẳng `shipments.current_warehouse_id = Kho B` và `status = 'in_warehouse'` ngay lập tức:
  - Sổ sách ghi hàng đã nằm an toàn trong Kho B trong khi xe vẫn đang chạy trên cao tốc.
  - Nếu hàng mất dọc đường, Kho B bị quy trách nhiệm oan và không truy vết được tài xế trung chuyển nào đã nhận hàng từ Kho A.

#### (3) Cách xử lý chuẩn kỹ thuật (Chain of Custody 3 Chặng)

Thiết kế chuỗi giám sát trách nhiệm vật lý (**Chain of Custody**) tách bạch 3 mốc bàn giao rõ ràng:

1. **Mốc 1 — Kho A chốt xuất trung chuyển (`outbound_linehaul` -> `confirmed`)**:
   - Toàn bộ vận đơn và túi hàng (`manifest_bags`) trong phiếu chuyển sang `status = 'in_transit'`.
   - Cột `shipments.current_warehouse_id` được đặt về **`NULL`** (hàng không nằm trong kho nào mà đang trên đường vận chuyển), đồng thời ghi nhận `assigned_driver_id` (tài xế trung chuyển) và `vehicle_id` từ phiếu `warehouse_receipts`. Trách nhiệm lúc này thuộc 100% về Tài xế trung chuyển.
2. **Mốc 2 — Kho B quét nhập kho (`inbound` -> `confirmed`)**:
   - Nhân viên Kho B quét từng mã vận đơn hoặc mã Seal túi hàng thực tế nhận được. Chỉ những mã được quét thực tế tại Kho B mới chuyển sang `status = 'in_warehouse'`, `current_warehouse_id = Kho B`, `current_branch_id = Chi nhánh B`.
3. **Mốc 3 — Tự động phát hiện thiếu hụt khi đối chiếu phiếu xuất & phiếu nhập**:
   - Các vận đơn thuộc phiếu xuất trung chuyển của Kho A đã quá thời gian hành trình SLA hoặc đã chốt phiếu nhập tại Kho B nhưng vẫn kẹt ở `in_transit` sẽ được gắn cờ cảnh báo thiếu hụt để lập hồ sơ `shipment_incidents` quy trách nhiệm chính xác cho chuyến trung chuyển.

#### (4) Quy tắc bắt buộc cho AI

- **CẤM** cập nhật `current_warehouse_id` sang kho đích khi mới chốt phiếu xuất trung chuyển (`outbound_linehaul`); chỉ được gán `current_warehouse_id` của kho đích khi kho đích thực hiện thao tác **Nhập kho (`inbound`)**.

---

## Tình huống 3: Tài Xế Thu Thiếu COD Hoặc Giữ Tiền Quá Hạn Không Nộp Về Bưu Cục

#### (1) Kịch bản thực tế

- Tài xế giao hàng (`pickup_delivery_driver`) giao thành công 10 đơn hàng thu hộ COD tổng cộng `9.800.000đ` (`cod_transactions.status = 'driver_holding'`).
- Cuối ca làm việc, tài xế cố tình giữ lại `3.500.000đ` của 2 đơn lớn suốt 3 ngày không nộp cho Kế toán Bưu cục, hoặc trên Mobile App tài xế cố tình sửa số tiền thực thu thấp hơn `cod_amount` của vận đơn.

#### (2) Hậu quả nếu code ẩu

- Nếu cho phép Mobile gửi trường `collected_cod_amount` do tài xế tự nhập để ghi đè vào sổ cái `cod_transactions`, tài xế có thể khai khống thu thiếu tiền của khách.
- Nếu không giới hạn hạn mức tiền mặt hoặc số ngày tài xế được phép giữ (`driver_holding`), rủi ro tài xế ôm tiền COD rồi nghỉ việc gây thiệt hại trực tiếp cho doanh nghiệp.

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Khóa cứng số tiền Sổ cái từ Snapshot Vận đơn (`shipments`)**:
   - Khi vận đơn chuyển sang `delivered`, Backend tự động cập nhật `cod_transactions` sang `status = 'driver_holding'` với số tiền phải thu bằng đúng tổng **`shipments.cod_amount`** + cước phí người nhận trả (`ngttn` nếu chưa thu). **Tuyệt đối bỏ qua** mọi con số tiền mặt do Mobile gửi lên.
2. **Chặn xuất kho giao hàng mới khi tài xế nợ COD quá hạn / vượt hạn mức**:
   - Tại API chốt phiếu xuất kho giao hàng (`outbound_delivery`), Backend kiểm tra tổng dư nợ `status = 'driver_holding'` của tài xế được phân công:
     - Nếu tổng tiền đang giữ vượt hạn mức tối đa (VD: `10.000.000đ` cấu hình trong `system_settings`) HOẶC có đơn đã giao thành công quá **24 giờ** (`delivered_at < NOW() - INTERVAL 24 HOUR`) mà chưa được Kế toán Bưu cục thu tiền (`collected_by_branch`) -> hệ thống chặn không cho xuất thêm đơn mới (`422_VALIDATION_ERROR`: _"Tài xế đang có công nợ COD quá hạn chưa nộp về bưu cục"_).

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Modules\Finance\Repositories;

use PDO;
use RuntimeException;

final class DriverCodLimitGuard
{
    public function __construct(private readonly PDO $pdo) {}

    /**
     * Kiểm tra tài xế có vi phạm hạn mức giữ tiền COD hoặc quá hạn 24h chưa nộp tiền hay không.
     *
     * @param int $driverId
     * @param float $maxHoldingAmount Hạn mức từ system_settings (VD: 10000000.00)
     * @param int $maxHoldingHours Thời gian giữ tối đa (VD: 24 giờ)
     * @return void
     */
    public function assertDriverEligibleForDelivery(
        int $driverId,
        float $maxHoldingAmount = 10000000.00,
        int $maxHoldingHours = 24
    ): void {
        $sql = "SELECT
                    COALESCE(SUM(ct.cod_amount + ct.freight_collect_amount), 0) AS total_holding,
                    SUM(CASE WHEN s.delivered_at < DATE_SUB(NOW(), INTERVAL :max_hours HOUR) THEN 1 ELSE 0 END) AS overdue_count
                FROM cod_transactions ct
                INNER JOIN shipments s ON s.id = ct.shipment_id
                WHERE ct.driver_id = :driver_id
                  AND ct.status = 'driver_holding'";

        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(':max_hours', $maxHoldingHours, PDO::PARAM_INT);
        $stmt->bindValue(':driver_id', $driverId, PDO::PARAM_INT);
        $stmt->execute();

        $summary = $stmt->fetch();
        $totalHolding = (float) ($summary['total_holding'] ?? 0);
        $overdueCount = (int) ($summary['overdue_count'] ?? 0);

        if ($overdueCount > 0 || $totalHolding >= $maxHoldingAmount) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }
    }
}
```

- **Quy tắc bắt buộc cho AI**: Số tiền ghi nhận vào `cod_transactions` luôn lấy từ cột `cod_amount` của bảng `shipments`; không bao giờ nhận số tiền từ request của tài xế.

---

## Tình huống 4: Kế Toán Bưu Cục Khóa Nhầm Bảng Kê hoặc Quản Lý Chi Nhánh Bấm "Hủy Giao Thành Công" Cho Đơn Đã Chốt Tiền COD

#### (1) Kịch bản thực tế

- **Kịch bản A**: Tài xế bấm nhầm "Giao thành công" cho đơn `VS26112300200` (`cod_transactions.status = 'driver_holding'`). Sau đó Quản lý chi nhánh duyệt yêu cầu **Hủy giao thành công** (`shipment_approval_requests`) để đưa đơn về kho đi giao lại.
- **Kịch bản B**: Nghiêm trọng hơn — đơn `VS26112300200` đã được Kế toán Bưu cục quét vào bảng kê thu tiền và bấm **Khóa bảng kê** (`cash_collections.status = 'locked'`, `cod_transactions.status = 'collected_by_branch'`), sau đó mới phát hiện sai sót và yêu cầu hủy giao thành công.

#### (2) Hậu quả nếu code ẩu

- Nếu cho phép xóa cứng (`DELETE`) bản ghi trong `cod_transactions` hoặc `cash_collections`, hay cho phép sửa ngược trực tiếp bảng kê đã khóa:
  - Dấu vết kế toán bị mất hoàn toàn, vi phạm nguyên tắc kiểm toán tài chính.
  - Tổng tiền trên phiếu nộp về Trung tâm (`cash_remittances`) bị sai lệch so với danh sách vận đơn chi tiết.

#### (3) Cách xử lý chuẩn kỹ thuật (Bất biến Sổ cái & Không Xóa Cứng Dòng Tiền)

1. **Cấm tuyệt đối `DELETE` trên các bảng tài chính (`cod_transactions`, `cash_collections`, `cash_remittances`, `customer_invoices`)**.
2. **Xử lý theo đúng trạng thái khóa sổ của `cod_transactions`**:
   - **Nếu `cod_transactions.status === 'driver_holding'` (Chưa khóa bảng kê thu tiền)**:
     - Khi Quản lý chi nhánh phê duyệt `shipment_approval_requests` (`request_type = 'cancel_delivered'`), trong cùng 1 Transaction:
       - Chuyển `shipments.status` từ `delivered` -> `in_warehouse`.
       - Chuyển bản ghi `cod_transactions` hiện tại sang `status = 'cancelled'` (giữ nguyên lịch sử bản ghi cũ), đồng thời tạo mới 1 dòng `cod_transactions` ở trạng thái `pending` để phục vụ lượt đi giao lại tiếp theo.
       - Ghi nhận hành động `CANCEL_DELIVERED` vào `audit_logs` kèm lý do và người duyệt.
   - **Nếu `cod_transactions.status` đã là `collected_by_branch`, `remitted_to_hq` hoặc `settled_to_customer`**:
     - Hệ thống **CHẶN CỨNG** thao tác hủy giao thành công (`422_VALIDATION_ERROR`: _"Vận đơn đã được khóa sổ kế toán COD, không thể hủy giao trực tiếp. Vui lòng lập phiếu điều chỉnh hoàn trả qua Kế toán Trung tâm"_).

#### (4) Quy tắc bắt buộc cho AI

- Trong toàn bộ mã nguồn PHP của `App\Modules\Finance` và `App\Modules\Shipment`, **CẤM** viết câu lệnh `DELETE FROM cod_transactions` hoặc `DELETE FROM cash_collections`. Mọi hủy bỏ/đảo ngược đều phải dùng trạng thái `cancelled` + bản ghi bù trừ mới + `audit_logs`.

---

## Tình huống 5: Phê Duyệt Đền Bù Mất Hàng — Phân Bổ Chi Phí Nhân Viên / Công Ty Không Khớp Tổng Tiền Duyệt

#### (1) Kịch bản thực tế

- Vận đơn `VS26112300310` bị làm mất tại kho (`shipment_incidents.incident_type = 'lost'`).
- Sau khi xác minh giá trị khai giá, Quản lý chi nhánh phê duyệt mức đền bù cho khách hàng là **`approved_amount = 4.500.000đ`** (`compensations`).
- Khi nhập số tiền phân bổ trách nhiệm bồi thường giữa Công ty (`company_liability_amount`) và Nhân viên gây mất hàng (`staff_liability_amount`), người thao tác nhập `company_liability_amount = 3.000.000đ` và `staff_liability_amount = 1.000.000đ` (tổng chỉ đạt `4.000.000đ`, thiếu `500.000đ`), hoặc nhập `staff_liability_amount > 0` nhưng bỏ trống người chịu trách nhiệm (`responsible_user_id = NULL`).

#### (2) Hậu quả nếu code ẩu

- Nếu không ràng buộc phương trình cân bằng chi phí:
  - Báo cáo tài chính bị lệch `500.000đ` giữa khoản chi trả khách hàng và nguồn hạch toán nội bộ.
  - Khoản khấu trừ lương/trách nhiệm nhân viên không gắn được cho cá nhân cụ thể nào.
  - Nếu dùng phép cộng số thực `float` thông thường trong PHP (`$a + $b === $total`), dễ gặp lỗi làm tròn dấu phẩy động (`0.1 + 0.2 !== 0.3`).

#### (3) Cách xử lý chuẩn kỹ thuật

1. **Ràng buộc 3 điều kiện bất biến khi duyệt đền bù (`compensations`)**:
   - Tất cả các số tiền (`approved_amount`, `company_liability_amount`, `staff_liability_amount`) phải `>= 0`.
   - Dùng thư viện số học chính xác **`BCMath`** (`bcadd`, `bccomp`) kiểm tra tuyệt đối:
     `bccomp(bcadd($companyAmount, $staffAmount, 2), $approvedAmount, 2) === 0`
   - Nếu `bccomp($staffAmount, '0.00', 2) > 0`, bắt buộc `responsible_user_id` phải được chỉ định hợp lệ (tồn tại trong bảng `users`).
2. **Bảo vệ toàn vẹn luồng duyệt -> chi trả**:
   - Chỉ cho phép Kế toán Trung tâm bấm xác nhận chi trả (`status = 'paid'`) khi phiếu đền bù đang ở trạng thái `approved`, kiểm tra `version` Optimistic Locking và ghi nhận `audit_logs`.

#### (4) Code mẫu / Quy tắc bắt buộc cho AI

```php
<?php

declare(strict_types=1);

namespace App\Modules\IncidentCompensation\Validators;

use RuntimeException;

final class CompensationApprovalValidator
{
    /**
     * Kiểm tra tính hợp lệ và cân bằng phân bổ chi phí phê duyệt đền bù.
     *
     * @param array<string, mixed> $input
     * @return array{approved_amount: string, company_liability_amount: string, staff_liability_amount: string, responsible_user_id: int|null}
     */
    public static function validateApprovalPayload(array $input): array
    {
        $approved = number_format((float) ($input['approved_amount'] ?? -1), 2, '.', '');
        $company = number_format((float) ($input['company_liability_amount'] ?? -1), 2, '.', '');
        $staff = number_format((float) ($input['staff_liability_amount'] ?? -1), 2, '.', '');
        $responsibleUserId = isset($input['responsible_user_id']) ? (int) $input['responsible_user_id'] : null;

        if (bccomp($approved, '0.00', 2) <= 0
            || bccomp($company, '0.00', 2) < 0
            || bccomp($staff, '0.00', 2) < 0
        ) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        $sumLiability = bcadd($company, $staff, 2);
        if (bccomp($sumLiability, $approved, 2) !== 0) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        if (bccomp($staff, '0.00', 2) > 0 && ($responsibleUserId === null || $responsibleUserId <= 0)) {
            throw new RuntimeException('422_VALIDATION_ERROR');
        }

        return [
            'approved_amount' => $approved,
            'company_liability_amount' => $company,
            'staff_liability_amount' => $staff,
            'responsible_user_id' => $responsibleUserId,
        ];
    }
}
```

- **Quy tắc bắt buộc cho AI**: Mọi tính toán so sánh tiền tệ trong PHP (cước phí, đối soát COD, phân bổ đền bù) bắt buộc dùng `BCMath` (`bcadd`, `bcsub`, `bcmul`, `bccomp`) với độ chính xác 2 chữ số thập phân khớp với `DECIMAL(12,2)` trong MySQL 8.0.
