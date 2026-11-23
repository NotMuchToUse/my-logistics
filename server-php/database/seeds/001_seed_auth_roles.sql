INSERT INTO roles (code, name, description, is_system)
VALUES
    ('receptionist', 'Nhân viên tiếp nhận', 'Tiếp nhận yêu cầu gửi hàng tại quầy.', 1),
    ('coordinator', 'Điều phối viên', 'Điều phối lấy hàng và vận chuyển.', 1),
    ('warehouse_staff', 'Nhân viên kho', 'Xử lý nghiệp vụ nhập xuất kho.', 1),
    ('branch_accountant', 'Kế toán chi nhánh', 'Quản lý nghiệp vụ tài chính tại chi nhánh.', 1),
    ('hq_accountant', 'Kế toán trung tâm', 'Quản lý nghiệp vụ tài chính toàn hệ thống.', 1),
    ('branch_manager', 'Quản lý chi nhánh', 'Quản lý hoạt động tại chi nhánh.', 1),
    ('board_director', 'Ban giám đốc', 'Theo dõi và điều hành toàn hệ thống.', 1),
    ('system_admin', 'Quản trị hệ thống', 'Quản trị cấu hình và người dùng hệ thống.', 1),
    ('system_dev', 'Phát triển hệ thống', 'Theo dõi cấu hình và lỗi hệ thống.', 1),
    ('pickup_delivery_driver', 'Tài xế lấy giao', 'Thực hiện lấy hàng và giao hàng.', 1),
    ('linehaul_driver', 'Tài xế trung chuyển', 'Thực hiện vận chuyển trung chuyển.', 1),
    ('customer_individual', 'Khách hàng cá nhân', 'Tài khoản khách hàng cá nhân.', 1),
    ('customer_corporate', 'Khách hàng doanh nghiệp', 'Tài khoản khách hàng doanh nghiệp trả sau.', 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_system = VALUES(is_system),
    updated_at = NOW();
