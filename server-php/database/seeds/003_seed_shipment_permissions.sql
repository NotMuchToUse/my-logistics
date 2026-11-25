INSERT INTO permissions (code, module, name, description)
VALUES
    ('shipments.read', 'shipments', 'Xem vận đơn', 'Xem danh sách và chi tiết vận đơn trong phạm vi chi nhánh.'),
    ('shipments.create', 'shipments', 'Tạo vận đơn', 'Tạo vận đơn mới trong phạm vi chi nhánh.'),
    ('shipments.priority', 'shipments', 'Cập nhật ưu tiên vận đơn', 'Đánh dấu hoặc bỏ đánh dấu ưu tiên vận đơn.'),
    ('shipments.cancel', 'shipments', 'Hủy vận đơn', 'Hủy vận đơn đủ điều kiện nghiệp vụ.'),
    ('shipments.forward', 'shipments', 'Tạo vận đơn chuyển tiếp', 'Tạo vận đơn chuyển tiếp từ vận đơn giao thất bại.'),
    ('shipments.print', 'shipments', 'Ghi lịch sử in vận đơn', 'Ghi nhận lịch sử in phiếu gửi và tem vận đơn.')
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    updated_at = NOW();

INSERT INTO role_has_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM (
    SELECT 'receptionist' AS role_code, 'shipments.read' AS permission_code
    UNION ALL SELECT 'receptionist', 'shipments.create'
    UNION ALL SELECT 'receptionist', 'shipments.priority'
    UNION ALL SELECT 'receptionist', 'shipments.cancel'
    UNION ALL SELECT 'receptionist', 'shipments.print'
    UNION ALL SELECT 'coordinator', 'shipments.read'
    UNION ALL SELECT 'coordinator', 'shipments.create'
    UNION ALL SELECT 'coordinator', 'shipments.priority'
    UNION ALL SELECT 'coordinator', 'shipments.cancel'
    UNION ALL SELECT 'coordinator', 'shipments.forward'
    UNION ALL SELECT 'coordinator', 'shipments.print'
    UNION ALL SELECT 'warehouse_staff', 'shipments.print'
    UNION ALL SELECT 'branch_manager', 'shipments.priority'
    UNION ALL SELECT 'branch_manager', 'shipments.cancel'
    UNION ALL SELECT 'branch_manager', 'shipments.forward'
    UNION ALL SELECT 'branch_manager', 'shipments.print'
    UNION ALL SELECT 'system_admin', 'shipments.read'
    UNION ALL SELECT 'system_admin', 'shipments.create'
    UNION ALL SELECT 'system_admin', 'shipments.priority'
    UNION ALL SELECT 'system_admin', 'shipments.cancel'
    UNION ALL SELECT 'system_admin', 'shipments.forward'
    UNION ALL SELECT 'system_admin', 'shipments.print'
    UNION ALL SELECT 'system_dev', 'shipments.read'
    UNION ALL SELECT 'system_dev', 'shipments.create'
    UNION ALL SELECT 'system_dev', 'shipments.priority'
    UNION ALL SELECT 'system_dev', 'shipments.cancel'
    UNION ALL SELECT 'system_dev', 'shipments.forward'
    UNION ALL SELECT 'system_dev', 'shipments.print'
) AS shipment_role_permissions
INNER JOIN roles ON roles.code = shipment_role_permissions.role_code
INNER JOIN permissions ON permissions.code = shipment_role_permissions.permission_code
ON DUPLICATE KEY UPDATE created_at = role_has_permissions.created_at;
