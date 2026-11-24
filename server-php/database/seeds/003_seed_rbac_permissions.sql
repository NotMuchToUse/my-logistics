INSERT INTO permissions (code, module, name, description)
VALUES
    ('network.read', 'network', 'Xem mạng lưới', 'Xem chi nhánh, bưu cục và kho theo phạm vi được cấp.'),
    ('network.manage', 'network', 'Quản lý mạng lưới', 'Tạo và cập nhật chi nhánh, bưu cục và kho.'),
    ('users.read', 'users', 'Xem nhân sự', 'Xem hồ sơ nhân sự theo phạm vi được cấp.'),
    ('users.manage', 'users', 'Quản lý nhân sự', 'Tạo và cập nhật hồ sơ nhân sự.'),
    ('users.assign_role', 'users', 'Gán vai trò', 'Gán hoặc thu hồi vai trò người dùng.'),
    ('users.assign_branch_scope', 'users', 'Gán phạm vi chi nhánh', 'Gán hoặc thu hồi phạm vi chi nhánh và kho.'),
    ('pricing.read', 'pricing', 'Xem bảng giá', 'Xem dịch vụ và bảng giá hiện hành.'),
    ('pricing.manage', 'pricing', 'Quản lý bảng giá', 'Tạo và cập nhật dịch vụ, phụ phí và bảng giá.'),
    ('ops.read', 'ops', 'Xem điều hành', 'Xem thông tin điều hành vận chuyển.'),
    ('ops.read_assigned', 'ops', 'Xem chuyến được giao', 'Xem chuyến trung chuyển được phân công cho tài xế.'),
    ('ops.dispatch', 'ops', 'Điều phối vận chuyển', 'Điều phối chuyến và nhân sự vận hành.'),
    ('ops.update_status', 'ops', 'Cập nhật trạng thái vận hành', 'Cập nhật trạng thái nghiệp vụ vận hành.'),
    ('ops.update_assigned', 'ops', 'Cập nhật chuyến được giao', 'Cập nhật chuyến trung chuyển được phân công.'),
    ('pickup.read', 'pickup', 'Xem yêu cầu lấy hàng', 'Xem yêu cầu lấy hàng trong phạm vi được cấp.'),
    ('pickup.create', 'pickup', 'Tạo yêu cầu lấy hàng', 'Tạo yêu cầu lấy hàng cho khách hàng.'),
    ('pickup.assign', 'pickup', 'Phân công lấy hàng', 'Phân công tài xế cho yêu cầu lấy hàng.'),
    ('pickup.update', 'pickup', 'Cập nhật yêu cầu lấy hàng', 'Cập nhật yêu cầu lấy hàng trong phạm vi được cấp.'),
    ('pickup.cancel', 'pickup', 'Hủy yêu cầu lấy hàng', 'Hủy yêu cầu lấy hàng đủ điều kiện.'),
    ('pickup.read_assigned', 'pickup', 'Xem yêu cầu được giao', 'Xem yêu cầu lấy hàng đã phân công cho tài xế.'),
    ('pickup.update_assigned', 'pickup', 'Cập nhật yêu cầu được giao', 'Cập nhật kết quả lấy hàng đã phân công.'),
    ('pickup.read_own', 'pickup', 'Xem yêu cầu của khách hàng', 'Xem yêu cầu lấy hàng thuộc tài khoản khách hàng hiện tại.'),
    ('pickup.create_own', 'pickup', 'Tạo yêu cầu của khách hàng', 'Tạo yêu cầu lấy hàng cho tài khoản khách hàng hiện tại.'),
    ('shipment.read', 'shipment', 'Xem vận đơn', 'Xem vận đơn trong phạm vi được cấp.'),
    ('shipment.create', 'shipment', 'Tạo vận đơn', 'Tạo vận đơn trong phạm vi được cấp.'),
    ('shipment.update_status', 'shipment', 'Cập nhật trạng thái vận đơn', 'Cập nhật trạng thái vận đơn theo nghiệp vụ.'),
    ('shipment.priority', 'shipment', 'Cập nhật ưu tiên vận đơn', 'Đánh dấu hoặc bỏ đánh dấu ưu tiên vận đơn.'),
    ('shipment.cancel', 'shipment', 'Hủy vận đơn', 'Hủy vận đơn đủ điều kiện nghiệp vụ.'),
    ('shipment.forward', 'shipment', 'Tạo vận đơn chuyển tiếp', 'Tạo vận đơn chuyển tiếp từ vận đơn giao thất bại.'),
    ('shipment.print', 'shipment', 'Ghi lịch sử in vận đơn', 'Ghi nhận lịch sử in phiếu gửi và tem vận đơn.'),
    ('shipment.read_assigned', 'shipment', 'Xem vận đơn được giao', 'Xem vận đơn đã phân công cho tài xế.'),
    ('shipment.update_status_assigned', 'shipment', 'Cập nhật vận đơn được giao', 'Cập nhật trạng thái vận đơn đã phân công cho tài xế.'),
    ('shipment.read_own', 'shipment', 'Xem vận đơn của khách hàng', 'Xem vận đơn thuộc tài khoản khách hàng hiện tại.'),
    ('shipment.create_own', 'shipment', 'Tạo vận đơn của khách hàng', 'Tạo vận đơn cho tài khoản khách hàng hiện tại.'),
    ('warehouse.read', 'warehouse', 'Xem nghiệp vụ kho', 'Xem phiếu và tồn kho trong phạm vi được cấp.'),
    ('warehouse.receive', 'warehouse', 'Nhập kho', 'Thực hiện nghiệp vụ nhập kho.'),
    ('warehouse.dispatch', 'warehouse', 'Xuất kho', 'Thực hiện nghiệp vụ xuất kho và bàn giao.'),
    ('warehouse.manage_bags', 'warehouse', 'Quản lý túi hàng', 'Đóng, mở và quản lý túi hàng niêm phong.'),
    ('warehouse.inventory', 'warehouse', 'Kiểm kê kho', 'Thực hiện và xem kết quả kiểm kê kho.'),
    ('warehouse.read_assigned', 'warehouse', 'Xem kho được giao', 'Xem thông tin kho được phân công cho tài xế trung chuyển.'),
    ('warehouse.update_assigned', 'warehouse', 'Cập nhật kho được giao', 'Cập nhật nghiệp vụ tại kho được phân công.'),
    ('finance.read', 'finance', 'Xem tài chính', 'Xem COD, thu chi và đối soát theo phạm vi được cấp.'),
    ('finance.read_own', 'finance', 'Xem công nợ khách hàng', 'Xem công nợ thuộc tài khoản khách hàng hiện tại.'),
    ('finance.collect', 'finance', 'Thu tiền COD', 'Ghi nhận và đối soát tiền COD tại chi nhánh.'),
    ('finance.remit', 'finance', 'Nộp tiền về trung tâm', 'Lập và gửi bảng kê nộp tiền về trung tâm.'),
    ('finance.verify', 'finance', 'Đối soát tài chính', 'Xác minh và chốt đối soát tài chính.'),
    ('compensation.read', 'compensation', 'Xem bồi thường', 'Xem hồ sơ sự cố và bồi thường trong phạm vi được cấp.'),
    ('compensation.create', 'compensation', 'Tạo đề xuất bồi thường', 'Tạo hồ sơ đề xuất bồi thường.'),
    ('compensation.approve', 'compensation', 'Phê duyệt bồi thường', 'Phê duyệt hồ sơ bồi thường theo thẩm quyền.'),
    ('compensation.pay', 'compensation', 'Chi trả bồi thường', 'Ghi nhận chi trả bồi thường đã được duyệt.'),
    ('reports.read', 'reports', 'Xem báo cáo', 'Xem báo cáo theo phạm vi được cấp.'),
    ('reports.export', 'reports', 'Xuất báo cáo', 'Xuất báo cáo theo phạm vi được cấp.'),
    ('system.read', 'system', 'Xem cấu hình hệ thống', 'Xem cấu hình và trạng thái hệ thống.'),
    ('system.manage_settings', 'system', 'Quản lý cấu hình hệ thống', 'Cập nhật cấu hình vận hành hệ thống.'),
    ('system.read_errors', 'system', 'Xem nhật ký lỗi', 'Xem nhật ký lỗi và chẩn đoán hệ thống.')
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    updated_at = NOW();

INSERT IGNORE INTO role_has_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM (
    SELECT 'receptionist' AS role_code, 'network.read' AS permission_code
    UNION ALL SELECT 'receptionist', 'pricing.read'
    UNION ALL SELECT 'receptionist', 'pickup.read'
    UNION ALL SELECT 'receptionist', 'pickup.create'
    UNION ALL SELECT 'receptionist', 'pickup.update'
    UNION ALL SELECT 'receptionist', 'pickup.cancel'
    UNION ALL SELECT 'receptionist', 'shipment.read'
    UNION ALL SELECT 'receptionist', 'shipment.create'
    UNION ALL SELECT 'receptionist', 'shipment.priority'
    UNION ALL SELECT 'receptionist', 'shipment.cancel'
    UNION ALL SELECT 'receptionist', 'shipment.print'
    UNION ALL SELECT 'coordinator', 'network.read'
    UNION ALL SELECT 'coordinator', 'users.read'
    UNION ALL SELECT 'coordinator', 'pricing.read'
    UNION ALL SELECT 'coordinator', 'ops.read'
    UNION ALL SELECT 'coordinator', 'ops.dispatch'
    UNION ALL SELECT 'coordinator', 'ops.update_status'
    UNION ALL SELECT 'coordinator', 'pickup.read'
    UNION ALL SELECT 'coordinator', 'pickup.create'
    UNION ALL SELECT 'coordinator', 'pickup.assign'
    UNION ALL SELECT 'coordinator', 'pickup.update'
    UNION ALL SELECT 'coordinator', 'pickup.cancel'
    UNION ALL SELECT 'coordinator', 'shipment.read'
    UNION ALL SELECT 'coordinator', 'shipment.create'
    UNION ALL SELECT 'coordinator', 'shipment.update_status'
    UNION ALL SELECT 'coordinator', 'shipment.priority'
    UNION ALL SELECT 'coordinator', 'shipment.cancel'
    UNION ALL SELECT 'coordinator', 'shipment.forward'
    UNION ALL SELECT 'coordinator', 'shipment.print'
    UNION ALL SELECT 'coordinator', 'warehouse.read'
    UNION ALL SELECT 'coordinator', 'warehouse.dispatch'
    UNION ALL SELECT 'coordinator', 'reports.read'
    UNION ALL SELECT 'warehouse_staff', 'ops.read'
    UNION ALL SELECT 'warehouse_staff', 'ops.update_status'
    UNION ALL SELECT 'warehouse_staff', 'shipment.read'
    UNION ALL SELECT 'warehouse_staff', 'shipment.update_status'
    UNION ALL SELECT 'warehouse_staff', 'shipment.print'
    UNION ALL SELECT 'warehouse_staff', 'warehouse.read'
    UNION ALL SELECT 'warehouse_staff', 'warehouse.receive'
    UNION ALL SELECT 'warehouse_staff', 'warehouse.dispatch'
    UNION ALL SELECT 'warehouse_staff', 'warehouse.manage_bags'
    UNION ALL SELECT 'warehouse_staff', 'warehouse.inventory'
    UNION ALL SELECT 'branch_accountant', 'network.read'
    UNION ALL SELECT 'branch_accountant', 'shipment.read'
    UNION ALL SELECT 'branch_accountant', 'finance.read'
    UNION ALL SELECT 'branch_accountant', 'finance.collect'
    UNION ALL SELECT 'branch_accountant', 'finance.remit'
    UNION ALL SELECT 'branch_accountant', 'reports.read'
    UNION ALL SELECT 'branch_accountant', 'reports.export'
    UNION ALL SELECT 'hq_accountant', 'network.read'
    UNION ALL SELECT 'hq_accountant', 'shipment.read'
    UNION ALL SELECT 'hq_accountant', 'finance.read'
    UNION ALL SELECT 'hq_accountant', 'finance.remit'
    UNION ALL SELECT 'hq_accountant', 'finance.verify'
    UNION ALL SELECT 'hq_accountant', 'reports.read'
    UNION ALL SELECT 'hq_accountant', 'reports.export'
    UNION ALL SELECT 'branch_manager', 'network.read'
    UNION ALL SELECT 'branch_manager', 'users.read'
    UNION ALL SELECT 'branch_manager', 'users.assign_branch_scope'
    UNION ALL SELECT 'branch_manager', 'pricing.read'
    UNION ALL SELECT 'branch_manager', 'ops.read'
    UNION ALL SELECT 'branch_manager', 'ops.dispatch'
    UNION ALL SELECT 'branch_manager', 'ops.update_status'
    UNION ALL SELECT 'branch_manager', 'pickup.read'
    UNION ALL SELECT 'branch_manager', 'pickup.create'
    UNION ALL SELECT 'branch_manager', 'pickup.assign'
    UNION ALL SELECT 'branch_manager', 'pickup.update'
    UNION ALL SELECT 'branch_manager', 'pickup.cancel'
    UNION ALL SELECT 'branch_manager', 'shipment.read'
    UNION ALL SELECT 'branch_manager', 'shipment.create'
    UNION ALL SELECT 'branch_manager', 'shipment.update_status'
    UNION ALL SELECT 'branch_manager', 'shipment.priority'
    UNION ALL SELECT 'branch_manager', 'shipment.cancel'
    UNION ALL SELECT 'branch_manager', 'shipment.forward'
    UNION ALL SELECT 'branch_manager', 'shipment.print'
    UNION ALL SELECT 'branch_manager', 'warehouse.read'
    UNION ALL SELECT 'branch_manager', 'warehouse.receive'
    UNION ALL SELECT 'branch_manager', 'warehouse.dispatch'
    UNION ALL SELECT 'branch_manager', 'warehouse.manage_bags'
    UNION ALL SELECT 'branch_manager', 'warehouse.inventory'
    UNION ALL SELECT 'branch_manager', 'finance.read'
    UNION ALL SELECT 'branch_manager', 'finance.collect'
    UNION ALL SELECT 'branch_manager', 'compensation.read'
    UNION ALL SELECT 'branch_manager', 'compensation.create'
    UNION ALL SELECT 'branch_manager', 'compensation.approve'
    UNION ALL SELECT 'branch_manager', 'reports.read'
    UNION ALL SELECT 'branch_manager', 'reports.export'
    UNION ALL SELECT 'board_director', 'network.read'
    UNION ALL SELECT 'board_director', 'users.read'
    UNION ALL SELECT 'board_director', 'pricing.read'
    UNION ALL SELECT 'board_director', 'ops.read'
    UNION ALL SELECT 'board_director', 'pickup.read'
    UNION ALL SELECT 'board_director', 'shipment.read'
    UNION ALL SELECT 'board_director', 'warehouse.read'
    UNION ALL SELECT 'board_director', 'finance.read'
    UNION ALL SELECT 'board_director', 'compensation.read'
    UNION ALL SELECT 'board_director', 'reports.read'
    UNION ALL SELECT 'board_director', 'reports.export'
    UNION ALL SELECT 'board_director', 'system.read'
    UNION ALL SELECT 'system_dev', 'system.read'
    UNION ALL SELECT 'system_dev', 'system.read_errors'
    UNION ALL SELECT 'system_dev', 'reports.read'
    UNION ALL SELECT 'pickup_delivery_driver', 'pickup.read_assigned'
    UNION ALL SELECT 'pickup_delivery_driver', 'pickup.update_assigned'
    UNION ALL SELECT 'pickup_delivery_driver', 'shipment.read_assigned'
    UNION ALL SELECT 'pickup_delivery_driver', 'shipment.update_status_assigned'
    UNION ALL SELECT 'pickup_delivery_driver', 'ops.update_status'
    UNION ALL SELECT 'linehaul_driver', 'ops.read_assigned'
    UNION ALL SELECT 'linehaul_driver', 'ops.update_assigned'
    UNION ALL SELECT 'linehaul_driver', 'warehouse.read_assigned'
    UNION ALL SELECT 'linehaul_driver', 'warehouse.update_assigned'
    UNION ALL SELECT 'linehaul_driver', 'shipment.read_assigned'
    UNION ALL SELECT 'linehaul_driver', 'shipment.update_status_assigned'
    UNION ALL SELECT 'customer_individual', 'pricing.read'
    UNION ALL SELECT 'customer_individual', 'pickup.read_own'
    UNION ALL SELECT 'customer_individual', 'pickup.create_own'
    UNION ALL SELECT 'customer_individual', 'shipment.read_own'
    UNION ALL SELECT 'customer_individual', 'shipment.create_own'
    UNION ALL SELECT 'customer_individual', 'finance.read_own'
    UNION ALL SELECT 'customer_corporate', 'pricing.read'
    UNION ALL SELECT 'customer_corporate', 'pickup.read_own'
    UNION ALL SELECT 'customer_corporate', 'pickup.create_own'
    UNION ALL SELECT 'customer_corporate', 'shipment.read_own'
    UNION ALL SELECT 'customer_corporate', 'shipment.create_own'
    UNION ALL SELECT 'customer_corporate', 'finance.read_own'
) AS role_permission_matrix
INNER JOIN roles ON roles.code = role_permission_matrix.role_code
INNER JOIN permissions ON permissions.code = role_permission_matrix.permission_code;

INSERT IGNORE INTO role_has_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.code = 'system_admin';

INSERT INTO user_branch_scopes
    (user_id, scope_type, branch_id, warehouse_id, is_primary, assigned_by, created_at, updated_at)
SELECT users.id, 'hq_all', NULL, NULL, 1, users.id, NOW(), NOW()
FROM users
WHERE users.email = 'admin@vietstar.vn'
  AND users.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM user_branch_scopes
      WHERE user_branch_scopes.user_id = users.id
        AND user_branch_scopes.scope_type = 'hq_all'
  );
