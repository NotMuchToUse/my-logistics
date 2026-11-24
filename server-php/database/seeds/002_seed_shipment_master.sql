START TRANSACTION;

INSERT INTO provinces (id, code, name, region, is_active)
VALUES
    (1, 'TEST-HN', 'Hà Nội (dữ liệu kiểm thử)', 'north', 1),
    (2, 'TEST-DN', 'Đà Nẵng (dữ liệu kiểm thử)', 'central', 1),
    (3, 'TEST-HCM', 'Thành phố Hồ Chí Minh (dữ liệu kiểm thử)', 'south', 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    region = VALUES(region),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO districts (id, province_id, code, name, is_remote_area, is_active)
VALUES
    (101, 1, 'TEST-HN-01', 'Hoàn Kiếm (dữ liệu kiểm thử)', 0, 1),
    (201, 2, 'TEST-DN-01', 'Hải Châu (dữ liệu kiểm thử)', 0, 1),
    (301, 3, 'TEST-HCM-01', 'Quận 1 (dữ liệu kiểm thử)', 0, 1),
    (302, 3, 'TEST-HCM-REMOTE', 'Khu vực vùng xa (dữ liệu kiểm thử)', 1, 1)
ON DUPLICATE KEY UPDATE
    province_id = VALUES(province_id),
    name = VALUES(name),
    is_remote_area = VALUES(is_remote_area),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO wards (id, district_id, code, name, is_active)
VALUES
    (1001, 101, 'TEST-HN-W01', 'Hàng Trống (dữ liệu kiểm thử)', 1),
    (2001, 201, 'TEST-DN-W01', 'Thạch Thang (dữ liệu kiểm thử)', 1),
    (3001, 301, 'TEST-HCM-W01', 'Bến Nghé (dữ liệu kiểm thử)', 1),
    (3002, 302, 'TEST-HCM-W02', 'Xã vùng xa (dữ liệu kiểm thử)', 1)
ON DUPLICATE KEY UPDATE
    district_id = VALUES(district_id),
    name = VALUES(name),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO branches
    (id, public_id, parent_branch_id, code, name, branch_type,
     province_id, district_id, ward_id, address_line, latitude, longitude,
     accepts_counter_dropoff, is_active)
VALUES
    (1, '01M86J6YFA9VD3JEMDFTQDCA0A', NULL, 'TEST-HQ', 'Trụ sở kiểm thử', 'hq',
     1, 101, 1001, '1 Lê Thánh Tông', 21.0285110, 105.8544440, 1, 1),
    (2, '01M86J6YFA9VD3JEMDFTQDCA0B', 1, 'TEST-REGION-NORTH', 'Trung tâm vùng Bắc kiểm thử', 'regional_hub',
     1, 101, 1001, '2 Lê Thánh Tông', 21.0287000, 105.8545000, 1, 1),
    (3, '01M86J6YFA9VD3JEMDFTQDCA0C', 2, 'TEST-BRANCH-HN', 'Chi nhánh Hà Nội kiểm thử', 'branch',
     1, 101, 1001, '10 Hàng Trống', 21.0280000, 105.8500000, 1, 1),
    (4, '01M86J6YFA9VD3JEMDFTQDCA0D', 1, 'TEST-BRANCH-DN', 'Chi nhánh Đà Nẵng kiểm thử', 'branch',
     2, 201, 2001, '20 Bạch Đằng', 16.0678000, 108.2208000, 1, 1),
    (5, '01M86J6YFA9VD3JEMDFTQDCA0E', 1, 'TEST-BRANCH-HCM', 'Chi nhánh TP Hồ Chí Minh kiểm thử', 'branch',
     3, 301, 3001, '30 Nguyễn Huệ', 10.7769000, 106.7009000, 1, 1)
ON DUPLICATE KEY UPDATE
    public_id = VALUES(public_id),
    parent_branch_id = VALUES(parent_branch_id),
    name = VALUES(name),
    branch_type = VALUES(branch_type),
    province_id = VALUES(province_id),
    district_id = VALUES(district_id),
    ward_id = VALUES(ward_id),
    address_line = VALUES(address_line),
    latitude = VALUES(latitude),
    longitude = VALUES(longitude),
    accepts_counter_dropoff = VALUES(accepts_counter_dropoff),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO cargo_categories (id, code, name, description, requires_special_handling, is_active)
VALUES
    (1, 'TEST-DOCUMENT', 'Tài liệu', 'Hồ sơ, chứng từ không chứa hàng hóa nguy hiểm.', 0, 1),
    (2, 'TEST-GENERAL', 'Hàng hóa thông thường', 'Hàng hóa được phép vận chuyển theo quy định.', 0, 1),
    (3, 'TEST-FRAGILE', 'Hàng dễ vỡ', 'Hàng cần được đóng gói và xử lý cẩn thận.', 1, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    requires_special_handling = VALUES(requires_special_handling),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO service_types (id, code, name, description, estimated_days_min, estimated_days_max, is_active)
VALUES
    (1, 'TEST-EXPRESS', 'Hỏa tốc kiểm thử', 'Dịch vụ hỏa tốc mẫu.', 1, 1, 1),
    (2, 'TEST-STANDARD', 'Nhanh kiểm thử', 'Dịch vụ chuyển phát nhanh mẫu.', 1, 3, 1),
    (3, 'TEST-ECONOMY', 'Tiết kiệm kiểm thử', 'Dịch vụ tiết kiệm mẫu.', 2, 5, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    estimated_days_min = VALUES(estimated_days_min),
    estimated_days_max = VALUES(estimated_days_max),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO value_added_services
    (id, code, name, fee_type, fee_value, min_fee, max_fee, is_active)
VALUES
    (1, 'TEST-INSURANCE', 'Bảo hiểm hàng hóa kiểm thử', 'percentage', 0.50, 5000.00, 500000.00, 1),
    (2, 'TEST-INSPECTION', 'Đồng kiểm kiểm thử', 'fixed', 10000.00, 0.00, NULL, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    fee_type = VALUES(fee_type),
    fee_value = VALUES(fee_value),
    min_fee = VALUES(min_fee),
    max_fee = VALUES(max_fee),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO surcharges
    (id, code, name, fee_type, fee_value, is_auto_applied, is_active)
VALUES
    (1, 'REMOTE_AREA', 'Phụ phí vùng sâu vùng xa kiểm thử', 'fixed', 15000.00, 1, 1),
    (2, 'TEST-FUEL', 'Phụ phí nhiên liệu kiểm thử', 'fixed', 5000.00, 0, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    fee_type = VALUES(fee_type),
    fee_value = VALUES(fee_value),
    is_auto_applied = VALUES(is_auto_applied),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO weight_conversion_rules
    (id, service_type_id, divisor, min_chargeable_gram, effective_from, effective_to, is_active)
VALUES
    (1, 1, 6000, 500, '2026-01-01', NULL, 1),
    (2, 2, 6000, 500, '2026-01-01', NULL, 1),
    (3, 3, 6000, 500, '2026-01-01', NULL, 1)
ON DUPLICATE KEY UPDATE
    divisor = VALUES(divisor),
    min_chargeable_gram = VALUES(min_chargeable_gram),
    effective_from = VALUES(effective_from),
    effective_to = VALUES(effective_to),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO pricing_tariffs
    (id, service_type_id, zone_type, min_weight_gram, max_weight_gram, base_price,
     step_weight_gram, step_price, effective_from, effective_to, is_active)
VALUES
    (1, 1, 'intra_province', 0, 500000, 35000.00, 500, 3000.00, '2026-01-01', NULL, 1),
    (2, 1, 'intra_region', 0, 500000, 45000.00, 500, 4000.00, '2026-01-01', NULL, 1),
    (3, 1, 'inter_region_near', 0, 500000, 55000.00, 500, 5000.00, '2026-01-01', NULL, 1),
    (4, 1, 'inter_region_far', 0, 500000, 65000.00, 500, 6000.00, '2026-01-01', NULL, 1),
    (5, 2, 'intra_province', 0, 500000, 25000.00, 500, 2000.00, '2026-01-01', NULL, 1),
    (6, 2, 'intra_region', 0, 500000, 35000.00, 500, 3000.00, '2026-01-01', NULL, 1),
    (7, 2, 'inter_region_near', 0, 500000, 45000.00, 500, 4000.00, '2026-01-01', NULL, 1),
    (8, 2, 'inter_region_far', 0, 500000, 55000.00, 500, 5000.00, '2026-01-01', NULL, 1),
    (9, 3, 'intra_province', 0, 500000, 18000.00, 500, 1500.00, '2026-01-01', NULL, 1),
    (10, 3, 'intra_region', 0, 500000, 28000.00, 500, 2500.00, '2026-01-01', NULL, 1),
    (11, 3, 'inter_region_near', 0, 500000, 38000.00, 500, 3500.00, '2026-01-01', NULL, 1),
    (12, 3, 'inter_region_far', 0, 500000, 48000.00, 500, 4500.00, '2026-01-01', NULL, 1)
ON DUPLICATE KEY UPDATE
    base_price = VALUES(base_price),
    step_weight_gram = VALUES(step_weight_gram),
    step_price = VALUES(step_price),
    effective_from = VALUES(effective_from),
    effective_to = VALUES(effective_to),
    is_active = VALUES(is_active),
    updated_at = NOW();

INSERT INTO tracking_number_ranges
    (id, branch_id, prefix, range_start, range_end, current_number, status)
VALUES
    (1, 1, 'VSHQ', 0, 99999999, 0, 'active'),
    (2, 2, 'VSNR', 0, 99999999, 0, 'active'),
    (3, 3, 'VSHN', 0, 99999999, 0, 'active'),
    (4, 4, 'VSDN', 0, 99999999, 0, 'active'),
    (5, 5, 'VSHCM', 0, 99999999, 0, 'active')
ON DUPLICATE KEY UPDATE
    prefix = VALUES(prefix),
    range_start = VALUES(range_start),
    range_end = VALUES(range_end),
    current_number = GREATEST(current_number, VALUES(current_number)),
    status = IF(current_number >= range_end, 'exhausted', VALUES(status)),
    updated_at = NOW();

COMMIT;
