<?php

declare(strict_types=1);

namespace App\Modules\ReportsAdmin\Services;

use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\BranchScopeMiddleware;
use App\Middleware\IdempotencyMiddleware;
use App\Middleware\PermissionMiddleware;
use ReflectionClass;

final class ApiDocsCatalog
{
    /**
     * @return array<string, mixed>
     */
    public function build(Router $router): array
    {
        $definitions = $this->endpointDefinitions();
        $endpoints = [];

        foreach ($router->allRoutes() as $route) {
            $method = $route['method'];
            $path = $route['path'];
            if ($path === '/api/v1/docs/spec') {
                continue;
            }

            $key = $method . ' ' . $path;
            $mwMeta = $this->inspectMiddlewares($route['middleware']);
            $def = $definitions[$key] ?? $this->fallbackDefinition($method, $path, $mwMeta);

            $endpoints[] = [
                'id' => md5($key),
                'method' => $method,
                'path' => $path,
                'module' => $def['module'] ?? $this->detectModule($path),
                'client_target' => $def['client_target'] ?? ($mwMeta['requires_auth'] ? 'web_internal' : 'public'),
                'summary' => $def['summary'],
                'description' => $def['description'],
                'status' => 'LIVE',
                'auth' => [
                    'requires_bearer' => $mwMeta['requires_auth'],
                    'permission' => $mwMeta['permission'],
                    'requires_branch_id' => $mwMeta['requires_branch_scope'],
                    'requires_idempotency_key' => $mwMeta['requires_idempotency'],
                ],
                'path_params' => $this->extractPathParams($path, $def['path_params'] ?? []),
                'query_params' => $def['query_params'] ?? [],
                'sample_body' => $def['sample_body'] ?? null,
                'response_schema' => $def['response_schema'],
                'sample_response' => $def['sample_response'],
            ];
        }

        return [
            'service' => 'Vietstar Express / My-Logistics Core API',
            'version' => 'v1',
            'total_live_endpoints' => count($endpoints),
            'standard_envelope' => [
                'success' => [
                    'success' => true,
                    'message' => 'Thông báo kết quả tiếng Việt',
                    'data' => 'Object | Array<Object> (chi tiết bên dưới từng API)',
                    'meta' => [
                        'pagination' => ['page' => 1, 'per_page' => 20, 'total' => 100, 'total_pages' => 5],
                        'timestamp' => '2026-11-26T21:45:00+07:00',
                    ],
                ],
                'error' => [
                    'success' => false,
                    'error' => [
                        'code' => '422_VALIDATION_ERROR | 401_UNAUTHORIZED | 403_FORBIDDEN | 404_NOT_FOUND | 409_VERSION_CONFLICT',
                        'message' => 'Mô tả lỗi cụ thể',
                        'details' => ['field_name' => ['Chi tiết lỗi theo trường']],
                    ],
                ],
            ],
            'endpoints' => $endpoints,
        ];
    }

    /**
     * @param array<int, object> $middlewares
     * @return array{requires_auth: bool, permission: ?string, requires_branch_scope: bool, requires_idempotency: bool}
     */
    private function inspectMiddlewares(array $middlewares): array
    {
        $requiresAuth = false;
        $permission = null;
        $requiresBranch = false;
        $requiresIdempotency = false;

        foreach ($middlewares as $mw) {
            if ($mw instanceof AuthMiddleware) {
                $requiresAuth = true;
            } elseif ($mw instanceof BranchScopeMiddleware) {
                $requiresBranch = true;
            } elseif ($mw instanceof IdempotencyMiddleware) {
                $requiresIdempotency = true;
            } elseif ($mw instanceof PermissionMiddleware) {
                $ref = new ReflectionClass($mw);
                foreach ($ref->getProperties() as $prop) {
                    $prop->setAccessible(true);
                    $val = $prop->getValue($mw);
                    if (is_string($val) and ($val !== '')) {
                        $permission = $val;
                        break;
                    }
                }
            }
        }

        return [
            'requires_auth' => $requiresAuth,
            'permission' => $permission,
            'requires_branch_scope' => $requiresBranch,
            'requires_idempotency' => $requiresIdempotency,
        ];
    }

    /**
     * @param array<string, string> $customDescriptions
     * @return list<array{name: string, example: string, description: string}>
     */
    private function extractPathParams(string $path, array $customDescriptions): array
    {
        preg_match_all('/\{([A-Za-z_][A-Za-z0-9_]*)\}/', $path, $matches);
        $params = [];
        foreach ($matches[1] ?? [] as $name) {
            $example = match ($name) {
                'tracking_code' => 'VSHN00000011',
                'id' => '1',
                default => '01M88EEYFKP5V9GHCYGS39XCT4',
            };
            $params[] = [
                'name' => $name,
                'example' => $example,
                'description' => $customDescriptions[$name] ?? "Tham số đường dẫn {$name}",
            ];
        }

        return $params;
    }

    private function detectModule(string $path): string
    {
        return match (true) {
            str_starts_with($path, '/api/v1/auth') => 'Auth',
            str_starts_with($path, '/api/v1/public/provinces'),
            str_starts_with($path, '/api/v1/public/districts'),
            str_starts_with($path, '/api/v1/public/wards'),
            str_starts_with($path, '/api/v1/master-data') => 'MasterData',
            str_starts_with($path, '/api/v1/branches'),
            str_starts_with($path, '/api/v1/warehouses'),
            str_starts_with($path, '/api/v1/roles'),
            str_starts_with($path, '/api/v1/users') => 'NetworkOrg',
            str_starts_with($path, '/api/v1/public/'),
            str_starts_with($path, '/api/v1/customer/') => 'CustomerPortal',
            str_starts_with($path, '/api/v1/pickup-requests') => 'Pickup',
            str_starts_with($path, '/api/v1/shipment-incidents'),
            str_starts_with($path, '/api/v1/shipment-returns'),
            str_starts_with($path, '/api/v1/shipment-approval-requests'),
            str_contains($path, '/return-process') => 'IncidentCompensation',
            str_starts_with($path, '/api/v1/warehouse') => 'Warehouse',
            str_starts_with($path, '/api/v1/shipments') => 'Shipment',
            default => 'System',
        };
    }

    /**
     * @param array<string, mixed> $mwMeta
     * @return array<string, mixed>
     */
    private function fallbackDefinition(string $method, string $path, array $mwMeta): array
    {
        $isList = ($method === 'GET') and !str_contains($path, '{');
        return [
            'summary' => "{$method} {$path}",
            'description' => 'Endpoint đã đăng ký trên server. Bấm Test API để kiểm tra trực tiếp response.',
            'query_params' => $isList ? [
                ['name' => 'page', 'type' => 'int', 'example' => '1', 'description' => 'Số trang hiện tại'],
                ['name' => 'per_page', 'type' => 'int', 'example' => '20', 'description' => 'Số bản ghi mỗi trang (tối đa 100)'],
            ] : [],
            'sample_body' => in_array($method, ['POST', 'PUT', 'PATCH'], true) ? new \stdClass() : null,
            'response_schema' => [
                ['field' => 'success', 'type' => 'boolean', 'description' => 'Trạng thái thành công (true/false)'],
                ['field' => 'message', 'type' => 'string', 'description' => 'Thông báo kết quả'],
                ['field' => 'data', 'type' => $isList ? 'array<object>' : 'object', 'description' => 'Dữ liệu trả về chính từ hệ thống'],
            ],
            'sample_response' => [
                'success' => true,
                'message' => 'Thao tác thành công.',
                'data' => $isList ? [] : ['public_id' => '01M88EEYFKP5V9GHCYGS39XCT4'],
            ],
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function endpointDefinitions(): array
    {
        return [
                        'GET /api/v1/warehouse/routing-check' => [
                'module' => 'Warehouse',
                'client_target' => 'web_internal',
                'summary' => 'Kiểm tra định tuyến vận đơn & Cảnh báo sai tuyến (is_wrong_route)',
                'description' => 'Đối chiếu kho hiện tại và chi nhánh đích với bảng branch_routing_rules để trả về cờ is_wrong_route và kho trung chuyển dự kiến.',
                'query_params' => [
                    ['name' => 'tracking_code', 'type' => 'string', 'example' => 'VSHN00000011', 'description' => 'Mã vận đơn cần kiểm tra'],
                    ['name' => 'origin_warehouse_id', 'type' => 'int', 'example' => '1', 'description' => 'ID kho hiện tại'],
                    ['name' => 'destination_branch_id', 'type' => 'int', 'example' => '1', 'description' => 'ID chi nhánh đích'],
                    ['name' => 'next_hop_warehouse_id', 'type' => 'int', 'example' => '2', 'description' => 'ID kho trung chuyển dự định gửi tới (tùy chọn)'],
                ],
                'response_schema' => [
                    ['field' => 'data.is_wrong_route', 'type' => 'boolean', 'description' => 'true nếu lệch tuyến hoặc chưa cấu hình tuyến, false nếu hợp lệ'],
                    ['field' => 'data.warning', 'type' => 'string|null', 'description' => 'Nội dung cảnh báo sai tuyến tiếng Việt'],
                    ['field' => 'data.expected_next_hop', 'type' => 'object|null', 'description' => 'Kho trung chuyển đúng tuyến theo branch_routing_rules'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Định tuyến vận đơn hợp lệ.',
                    'data' => ['is_wrong_route' => false, 'warning' => null, 'expected_next_hop' => ['warehouse_code' => 'WH-HQ-01']],
                ],
            ],
            'POST /api/v1/warehouse/receipts' => [
                'module' => 'Warehouse',
                'client_target' => 'web_internal',
                'summary' => 'Tạo phiếu nhập kho (inbound) & Quét vận đơn vào kho',
                'description' => 'Tạo phiếu nhập kho và tự động cập nhật shipments (status = in_warehouse, current_branch_id, current_warehouse_id) kèm lịch sử hành trình.',
                'sample_body' => [
                    'warehouse_id' => 1,
                    'inbound_source_type' => 'new_pickup',
                    'note' => 'Nhập kho ca tối',
                    'auto_confirm' => false,
                    'tracking_codes' => ['VSHN00000011'],
                ],
                'response_schema' => [
                    ['field' => 'data.public_id', 'type' => 'string (ULID)', 'description' => 'ID công khai phiếu nhập kho'],
                    ['field' => 'data.receipt_code', 'type' => 'string', 'description' => 'Mã phiếu nhập kho (WHIN-YYYYMMDD-XXXXXX)'],
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'draft hoặc confirmed'],
                    ['field' => 'data.wrong_route_count', 'type' => 'int', 'description' => 'Số vận đơn bị gắn cờ sai tuyến trong phiếu'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tạo phiếu nhập kho thành công.',
                    'data' => ['receipt_code' => 'WHIN-20261127-A1B2C3', 'status' => 'draft', 'wrong_route_count' => 0],
                ],
            ],
            'POST /api/v1/warehouse/receipts/{public_id}/scan' => [
                'module' => 'Warehouse',
                'client_target' => 'web_internal',
                'summary' => 'Quét thêm vận đơn vào phiếu nhập kho',
                'description' => 'Quét mã vận đơn vào phiếu nhập kho đang mở, cập nhật status = in_warehouse và cảnh báo nếu is_wrong_route = true.',
                'sample_body' => [
                    'inbound_source_type' => 'linehaul_in',
                    'tracking_codes' => ['VSHN00000013'],
                ],
                'response_schema' => [
                    ['field' => 'data.scanned_items[]', 'type' => 'array<object>', 'description' => 'Danh sách vận đơn vừa quét kèm cờ is_wrong_route'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Quét vận đơn nhập kho thành công.',
                    'data' => ['total_shipments' => 2, 'wrong_route_count' => 0],
                ],
            ],
            'POST /api/v1/warehouse/receipts/{public_id}/confirm' => [
                'module' => 'Warehouse',
                'client_target' => 'web_internal',
                'summary' => 'Chốt phiếu nhập kho (confirmed)',
                'description' => 'Khóa phiếu nhập kho sau khi hoàn tất kiểm đếm.',
                'sample_body' => [
                    'version' => 1,
                    'note' => 'Đã kiểm đủ số lượng kiện thực tế',
                ],
                'response_schema' => [
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái mới: confirmed'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Chốt phiếu nhập kho thành công.',
                    'data' => ['status' => 'confirmed', 'version' => 2],
                ],
            ],
            'POST /api/v1/warehouse/bags' => [
                'module' => 'Warehouse',
                'client_target' => 'web_internal',
                'summary' => 'Tạo túi hàng Seal (manifest_bags) & Đóng vận đơn vào túi',
                'description' => 'Tạo túi hàng trung chuyển mới (status = open) và chuyển trạng thái vận đơn quét vào sang bagged.',
                'sample_body' => [
                    'origin_warehouse_id' => 1,
                    'destination_warehouse_id' => 2,
                    'strict_routing' => false,
                    'tracking_codes' => ['VSHN00000011'],
                ],
                'response_schema' => [
                    ['field' => 'data.public_id', 'type' => 'string (ULID)', 'description' => 'ID công khai túi hàng'],
                    ['field' => 'data.bag_code', 'type' => 'string', 'description' => 'Mã túi hàng (BAG-YYYYMMDD-XXXXXX)'],
                    ['field' => 'data.seal_number', 'type' => 'string', 'description' => 'Mã niêm phong Seal'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tạo túi hàng Seal thành công.',
                    'data' => ['bag_code' => 'BAG-20261127-112233', 'status' => 'open'],
                ],
            ],
            'POST /api/v1/warehouse/bags/{public_id}/seal' => [
                'module' => 'Warehouse',
                'client_target' => 'web_internal',
                'summary' => 'Niêm phong túi hàng Seal (open -> sealed)',
                'description' => 'Chốt niêm phong Seal túi hàng trước khi xuất tuyến vận chuyển.',
                'sample_body' => [
                    'version' => 1,
                ],
                'response_schema' => [
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái mới: sealed'],
                    ['field' => 'data.sealed_at', 'type' => 'datetime', 'description' => 'Thời điểm niêm phong'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Niêm phong túi hàng Seal thành công.',
                    'data' => ['status' => 'sealed', 'version' => 2],
                ],
            ],
            'POST /api/v1/warehouse/bags/{public_id}/open' => [
                'module' => 'Warehouse',
                'client_target' => 'web_internal',
                'summary' => 'Mở niêm phong túi hàng Seal (sealed -> opened) & Nhập kho các vận đơn bên trong',
                'description' => 'Đối chiếu mã Seal, mở túi tại kho nhận và tự động cập nhật toàn bộ vận đơn trong túi về status = in_warehouse tại kho nhận.',
                'sample_body' => [
                    'warehouse_id' => 2,
                    'version' => 2,
                ],
                'response_schema' => [
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái mới: opened'],
                    ['field' => 'data.unpacked_shipments[]', 'type' => 'array<object>', 'description' => 'Danh sách vận đơn đã bung túi và nhập kho'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Mở niêm phong túi hàng và nhập kho thành công.',
                    'data' => ['status' => 'opened', 'unpacked_shipments' => [['tracking_code' => 'VSHN00000011', 'status' => 'in_warehouse']]],
                ],
            ],
            'GET /api/v1/health' => [
                'module' => 'System',
                'client_target' => 'public',
                'summary' => 'Kiểm tra trạng thái hoạt động của API Server',
                'description' => 'Dùng để kiểm tra kết nối từ frontend/mobile tới server PHP và múi giờ cấu hình.',
                'response_schema' => [
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái server ("ok")'],
                    ['field' => 'data.timezone', 'type' => 'string', 'description' => 'Múi giờ chuẩn (+07:00)'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'OK',
                    'data' => ['status' => 'ok', 'timezone' => '+07:00'],
                ],
            ],
            'POST /api/v1/auth/login' => [
                'module' => 'Auth',
                'client_target' => 'all_clients',
                'summary' => 'Đăng nhập hệ thống (Nhân viên / Tài xế / Khách hàng)',
                'description' => 'Trả về access_token (Bearer), thông tin user, danh sách roles, permissions và branch_scopes.',
                'sample_body' => [
                    'identifier' => 'admin@vietstar.vn',
                    'password' => 'Vietstar123!',
                ],
                'response_schema' => [
                    ['field' => 'data.access_token', 'type' => 'string', 'description' => 'Token gắn vào header Authorization: Bearer <token>'],
                    ['field' => 'data.token_type', 'type' => 'string', 'description' => 'Luôn là "Bearer"'],
                    ['field' => 'data.expires_at', 'type' => 'datetime', 'description' => 'Thời điểm hết hạn token'],
                    ['field' => 'data.user', 'type' => 'object', 'description' => 'Hồ sơ người dùng (public_id, full_name, email, user_type, must_change_password)'],
                    ['field' => 'data.roles', 'type' => 'array<string>', 'description' => 'Danh sách mã vai trò (vd: system_admin, branch_manager)'],
                    ['field' => 'data.permissions', 'type' => 'array<string>', 'description' => 'Danh sách quyền RBAC được cấp'],
                    ['field' => 'data.branch_scopes', 'type' => 'array<object>', 'description' => 'Phạm vi chi nhánh/kho được phép thao tác'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Đăng nhập thành công.',
                    'data' => [
                        'access_token' => 'fc582174f1290abc1ba41bd681e3c452...',
                        'token_type' => 'Bearer',
                        'expires_at' => '2026-11-27T21:40:03+07:00',
                        'user' => [
                            'public_id' => '01M83TEMJHSR6SQXP98Z8PEP6D',
                            'full_name' => 'Quản trị hệ thống',
                            'email' => 'admin@vietstar.vn',
                            'user_type' => 'staff',
                        ],
                        'roles' => ['system_admin'],
                        'permissions' => ['shipment.read', 'shipment.create', 'shipment.cancel'],
                    ],
                ],
            ],
            'POST /api/v1/auth/register' => [
                'module' => 'Auth',
                'client_target' => 'web_customer',
                'summary' => 'Đăng ký tài khoản khách hàng (Shop / Cá nhân)',
                'description' => 'Tạo tài khoản khách hàng mới kèm bản ghi đồng ý điều khoản bảo mật.',
                'sample_body' => [
                    'full_name' => 'Shop Thời Trang Cần Thơ',
                    'phone' => '0912345679',
                    'email' => 'shopcantho@example.com',
                    'password' => 'ShopCanTho123!',
                    'customer_type' => 'business',
                    'consent_accepted' => true,
                ],
                'response_schema' => [
                    ['field' => 'data.access_token', 'type' => 'string', 'description' => 'Bearer token đăng nhập ngay sau khi đăng ký'],
                    ['field' => 'data.user.public_id', 'type' => 'string (ULID)', 'description' => 'Mã công khai của khách hàng'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Đăng ký tài khoản thành công.',
                    'data' => ['access_token' => '...', 'token_type' => 'Bearer'],
                ],
            ],
            'GET /api/v1/auth/me' => [
                'module' => 'Auth',
                'client_target' => 'all_clients',
                'summary' => 'Lấy hồ sơ phiên đăng nhập hiện tại',
                'description' => 'Dùng khi F5 tải lại trang React/Vue để khôi phục thông tin user, quyền và branch_scopes.',
                'response_schema' => [
                    ['field' => 'data.user', 'type' => 'object', 'description' => 'Thông tin tài khoản hiện tại'],
                    ['field' => 'data.roles', 'type' => 'array<string>', 'description' => 'Danh sách role'],
                    ['field' => 'data.permissions', 'type' => 'array<string>', 'description' => 'Danh sách permission'],
                    ['field' => 'data.branch_scopes', 'type' => 'array<object>', 'description' => 'Phạm vi chi nhánh'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Lấy thông tin người dùng thành công.',
                    'data' => ['user' => ['full_name' => 'Quản trị hệ thống'], 'roles' => ['system_admin']],
                ],
            ],
            'GET /api/v1/public/tracking/{tracking_code}' => [
                'module' => 'CustomerPortal',
                'client_target' => 'public',
                'summary' => 'Tra cứu hành trình vận đơn công khai (Không cần đăng nhập)',
                'description' => 'Trả về thông tin vận đơn đã che SĐT (masked) và lịch sử trạng thái public.',
                'path_params' => ['tracking_code' => 'Mã vận đơn (vd: VSHN00000011)'],
                'response_schema' => [
                    ['field' => 'data.tracking_code', 'type' => 'string', 'description' => 'Mã vận đơn'],
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái hiện tại (pending_pickup, in_transit, delivered, returning...)'],
                    ['field' => 'data.sender_phone_masked', 'type' => 'string', 'description' => 'SĐT người gửi đã ẩn giữa (090***3456)'],
                    ['field' => 'data.recipient_phone_masked', 'type' => 'string', 'description' => 'SĐT người nhận đã ẩn giữa'],
                    ['field' => 'data.history', 'type' => 'array<object>', 'description' => 'Mốc lịch sử hành trình công khai'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tra cứu hành trình thành công.',
                    'data' => [
                        'tracking_code' => 'VSHN00000011',
                        'status' => 'delivery_failed',
                        'history' => [['to_status' => 'pending_pickup', 'description' => 'Tạo vận đơn thành công']],
                    ],
                ],
            ],
            'POST /api/v1/public/calculate-rate' => [
                'module' => 'CustomerPortal',
                'client_target' => 'public',
                'summary' => 'Ước tính cước vận chuyển công khai',
                'description' => 'Tính cước tự động theo tỉnh/thành gửi - nhận, gói dịch vụ và trọng lượng thực/quy đổi.',
                'sample_body' => [
                    'sender_province_id' => 1,
                    'recipient_province_id' => 79,
                    'service_type_id' => 1,
                    'actual_weight_gram' => 1200,
                    'length_cm' => 30,
                    'width_cm' => 20,
                    'height_cm' => 15,
                    'cod_amount' => 350000,
                ],
                'response_schema' => [
                    ['field' => 'data.chargeable_weight_gram', 'type' => 'int', 'description' => 'Trọng lượng tính cước (gram)'],
                    ['field' => 'data.base_freight_amount', 'type' => 'string (decimal)', 'description' => 'Cước chính (VNĐ)'],
                    ['field' => 'data.vat_amount', 'type' => 'string (decimal)', 'description' => 'Thuế VAT'],
                    ['field' => 'data.total_freight_amount', 'type' => 'string (decimal)', 'description' => 'Tổng cước thanh toán'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tính cước thành công.',
                    'data' => ['chargeable_weight_gram' => 1500, 'total_freight_amount' => '41800.00'],
                ],
            ],
            'GET /api/v1/shipments' => [
                'module' => 'Shipment',
                'client_target' => 'web_internal',
                'summary' => 'Danh sách vận đơn có phân trang & bộ lọc đa điều kiện',
                'description' => 'Lọc vận đơn theo chi nhánh làm việc (X-Branch-Id), trạng thái, mã vận đơn, SĐT hoặc khoảng ngày.',
                'query_params' => [
                    ['name' => 'page', 'type' => 'int', 'example' => '1', 'description' => 'Số trang'],
                    ['name' => 'per_page', 'type' => 'int', 'example' => '20', 'description' => 'Số dòng/trang'],
                    ['name' => 'status', 'type' => 'string', 'example' => 'pending_pickup', 'description' => 'Lọc theo trạng thái'],
                    ['name' => 'tracking_code', 'type' => 'string', 'example' => 'VSHN00000011', 'description' => 'Tìm chính xác mã vận đơn'],
                    ['name' => 'phone', 'type' => 'string', 'example' => '0912345678', 'description' => 'Tìm theo SĐT gửi/nhận'],
                ],
                'response_schema' => [
                    ['field' => 'data[]', 'type' => 'array<object>', 'description' => 'Mảng danh sách vận đơn'],
                    ['field' => 'data[].public_id', 'type' => 'string (ULID)', 'description' => 'ID công khai của vận đơn'],
                    ['field' => 'data[].tracking_code', 'type' => 'string', 'description' => 'Mã vận đơn (vd: VSHN00000011)'],
                    ['field' => 'data[].status', 'type' => 'string', 'description' => 'Trạng thái vận đơn'],
                    ['field' => 'data[].cod_amount', 'type' => 'string (decimal)', 'description' => 'Tiền thu hộ COD'],
                    ['field' => 'data[].total_freight_amount', 'type' => 'string (decimal)', 'description' => 'Tổng tiền cước'],
                    ['field' => 'data[].version', 'type' => 'int', 'description' => 'Số phiên bản dùng cho Optimistic Lock'],
                    ['field' => 'meta.pagination', 'type' => 'object', 'description' => 'Thông tin phân trang (page, per_page, total, total_pages)'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Lấy danh sách vận đơn thành công.',
                    'data' => [
                        [
                            'public_id' => '01M88EEYFKP5V9GHCYGS39XCT4',
                            'tracking_code' => 'VSHN00000011',
                            'status' => 'pending_pickup',
                            'cod_amount' => '150000.00',
                            'total_freight_amount' => '41800.00',
                            'version' => 1,
                        ],
                    ],
                    'meta' => ['pagination' => ['page' => 1, 'per_page' => 20, 'total' => 1, 'total_pages' => 1]],
                ],
            ],
            'POST /api/v1/shipments' => [
                'module' => 'Shipment',
                'client_target' => 'web_internal',
                'summary' => 'Tạo vận đơn mới (Tự sinh mã vận đơn, tính cước, kiện hàng & phiếu COD)',
                'description' => 'Tạo vận đơn đơn lẻ kèm danh sách kiện hàng (parcels), dịch vụ gia tăng (vas_ids) và tự sinh bản ghi cod_transactions.',
                'sample_body' => [
                    'sender_name' => 'Shop Vietstar',
                    'sender_phone' => '0905123456',
                    'sender_address' => '100 Phố Huế',
                    'sender_province_id' => 1,
                    'sender_district_id' => 1,
                    'sender_ward_id' => 1,
                    'recipient_name' => 'Nguyễn Văn An',
                    'recipient_phone' => '0912345678',
                    'recipient_address' => '20 Bạch Đằng',
                    'recipient_province_id' => 1,
                    'recipient_district_id' => 1,
                    'recipient_ward_id' => 1,
                    'destination_branch_id' => 3,
                    'service_type_id' => 1,
                    'cargo_category_id' => 1,
                    'payment_method' => 'ngttn',
                    'cod_amount' => 250000,
                    'declared_value' => 250000,
                    'parcels' => [
                        [
                            'actual_weight_gram' => 800,
                            'length_cm' => 25,
                            'width_cm' => 20,
                            'height_cm' => 10,
                            'description' => 'Quần áo đóng hộp',
                        ],
                    ],
                ],
                'response_schema' => [
                    ['field' => 'data.public_id', 'type' => 'string (ULID)', 'description' => 'Mã định danh vận đơn vừa tạo'],
                    ['field' => 'data.tracking_code', 'type' => 'string', 'description' => 'Mã vận đơn tự sinh từ dải số chi nhánh'],
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái khởi tạo (pending_pickup)'],
                    ['field' => 'data.total_freight_amount', 'type' => 'string (decimal)', 'description' => 'Tổng cước đã tính'],
                    ['field' => 'data.cod_amount', 'type' => 'string (decimal)', 'description' => 'Số tiền thu hộ COD'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tạo vận đơn thành công.',
                    'data' => [
                        'public_id' => '01M88EEYFKP5V9GHCYGS39XCT4',
                        'tracking_code' => 'VSHN00000014',
                        'status' => 'pending_pickup',
                        'total_freight_amount' => '41800.00',
                        'cod_amount' => '250000.00',
                    ],
                ],
            ],
            'POST /api/v1/shipments/bulk-import' => [
                'module' => 'Shipment',
                'client_target' => 'web_internal',
                'summary' => 'Import vận đơn hàng loạt từ Excel (Tối đa 500 dòng / lần)',
                'description' => 'Validate toàn bộ từng dòng trước khi cấp mã. Nếu có bất kỳ dòng nào lỗi sẽ trả về HTTP 422 kèm row_errors theo row_index và không làm thất thoát dải số.',
                'sample_body' => [
                    'default_sender' => [
                        'sender_name' => 'Shop Vietstar',
                        'sender_phone' => '0905123456',
                        'sender_address' => '100 Phố Huế',
                        'sender_province_id' => 1,
                        'sender_district_id' => 1,
                        'sender_ward_id' => 1,
                    ],
                    'rows' => [
                        [
                            'row_index' => 1,
                            'recipient_name' => 'Nguyễn Văn A',
                            'recipient_phone' => '0912345678',
                            'recipient_address' => '20 Bạch Đằng',
                            'recipient_province_id' => 1,
                            'recipient_district_id' => 1,
                            'recipient_ward_id' => 1,
                            'destination_branch_id' => 3,
                            'service_type_id' => 1,
                            'cargo_category_id' => 1,
                            'payment_method' => 'ngttn',
                            'cod_amount' => 150000,
                            'actual_weight_gram' => 500,
                        ],
                    ],
                ],
                'response_schema' => [
                    ['field' => 'data.total_imported', 'type' => 'int', 'description' => 'Tổng số vận đơn đã tạo thành công'],
                    ['field' => 'data.tracking_code_from', 'type' => 'string', 'description' => 'Mã vận đơn đầu tiên trong lô'],
                    ['field' => 'data.tracking_code_to', 'type' => 'string', 'description' => 'Mã vận đơn cuối cùng trong lô'],
                    ['field' => 'data.total_freight_amount', 'type' => 'string (decimal)', 'description' => 'Tổng cước cả lô'],
                    ['field' => 'data.items[]', 'type' => 'array<object>', 'description' => 'Danh sách vận đơn kèm row_index tương ứng dòng Excel'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Import danh sách vận đơn hàng loạt thành công.',
                    'data' => [
                        'total_imported' => 1,
                        'tracking_code_from' => 'VSHN00000014',
                        'tracking_code_to' => 'VSHN00000014',
                        'items' => [['row_index' => 1, 'tracking_code' => 'VSHN00000014']],
                    ],
                ],
            ],
            'GET /api/v1/shipment-incidents' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Danh sách báo cáo sự cố vận đơn',
                'description' => 'Liệt kê các sự cố (hư hỏng, thất lạc, ẩm ướt, trễ hẹn, giao nhầm...) thuộc chi nhánh.',
                'query_params' => [
                    ['name' => 'status', 'type' => 'string', 'example' => 'reported', 'description' => 'reported | investigating | resolved | closed'],
                    ['name' => 'incident_type', 'type' => 'string', 'example' => 'damaged', 'description' => 'damaged | lost | wet_contaminated | delayed | wrong_delivery | other'],
                    ['name' => 'severity', 'type' => 'string', 'example' => 'high', 'description' => 'low | medium | high | critical'],
                ],
                'response_schema' => [
                    ['field' => 'data[].public_id', 'type' => 'string (ULID)', 'description' => 'ID công khai báo cáo sự cố'],
                    ['field' => 'data[].incident_code', 'type' => 'string', 'description' => 'Mã sự cố (INC-YYYYMMDD-XXXXXX)'],
                    ['field' => 'data[].tracking_code', 'type' => 'string', 'description' => 'Mã vận đơn gặp sự cố'],
                    ['field' => 'data[].incident_type', 'type' => 'string', 'description' => 'Loại sự cố'],
                    ['field' => 'data[].severity', 'type' => 'string', 'description' => 'Mức độ nghiêm trọng'],
                    ['field' => 'data[].status', 'type' => 'string', 'description' => 'Trạng thái xử lý sự cố'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Lấy danh sách sự cố vận đơn thành công.',
                    'data' => [['incident_code' => 'INC-20261126-639466', 'status' => 'reported']],
                ],
            ],
            'POST /api/v1/shipment-incidents' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Tạo báo cáo sự cố vận đơn mới',
                'description' => 'Tạo biên bản sự cố và tự động chuyển trạng thái vận đơn sang incident (nếu mark_shipment_incident = true).',
                'sample_body' => [
                    'tracking_code' => 'VSHN00000012',
                    'incident_type' => 'damaged',
                    'severity' => 'high',
                    'description' => 'Hộp hàng bị móp góc khi trung chuyển',
                    'evidence_urls' => ['https://cdn.vietstar.vn/incidents/ev1.jpg'],
                    'mark_shipment_incident' => true,
                ],
                'response_schema' => [
                    ['field' => 'data.public_id', 'type' => 'string (ULID)', 'description' => 'ID sự cố'],
                    ['field' => 'data.incident_code', 'type' => 'string', 'description' => 'Mã sự cố tự sinh'],
                    ['field' => 'data.shipment_status', 'type' => 'string', 'description' => 'Trạng thái vận đơn sau khi ghi nhận sự cố'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tạo báo cáo sự cố vận đơn thành công.',
                    'data' => ['incident_code' => 'INC-20261126-639466', 'shipment_status' => 'incident'],
                ],
            ],
            'PATCH /api/v1/shipment-incidents/{public_id}' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Cập nhật tiến độ / đóng sự cố & khôi phục trạng thái vận đơn',
                'description' => 'Cập nhật status sang investigating/resolved/closed. Khi đóng hết sự cố mở, có thể truyền restore_shipment_status để đưa vận đơn về luồng xử lý.',
                'sample_body' => [
                    'status' => 'resolved',
                    'resolution_note' => 'Đã gia cố lại kiện hàng và xác nhận với shop',
                    'restore_shipment_status' => 'pending_return',
                ],
                'response_schema' => [
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái sự cố mới'],
                    ['field' => 'data.resolved_at', 'type' => 'datetime', 'description' => 'Thời điểm hoàn tất xử lý'],
                    ['field' => 'data.shipment_status', 'type' => 'string', 'description' => 'Trạng thái vận đơn hiện tại'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Cập nhật sự cố vận đơn thành công.',
                    'data' => ['status' => 'resolved', 'shipment_status' => 'pending_return'],
                ],
            ],
            'GET /api/v1/shipment-returns/pending' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Danh sách vận đơn chờ chuyển hoàn (pending_return)',
                'description' => 'Trả về các vận đơn đang chờ điều phối giao lại hoặc tạo vận đơn chuyển hoàn về người gửi.',
                'query_params' => [
                    ['name' => 'include_failed', 'type' => 'boolean', 'example' => 'true', 'description' => 'Lấy kèm các đơn delivery_failed'],
                    ['name' => 'tracking_code', 'type' => 'string', 'example' => '', 'description' => 'Lọc theo mã vận đơn'],
                ],
                'response_schema' => [
                    ['field' => 'data[].public_id', 'type' => 'string (ULID)', 'description' => 'ID vận đơn chờ hoàn'],
                    ['field' => 'data[].tracking_code', 'type' => 'string', 'description' => 'Mã vận đơn'],
                    ['field' => 'data[].version', 'type' => 'int', 'description' => 'Version hiện tại để truyền vào POST /return-process'],
                    ['field' => 'data[].return_tracking_code', 'type' => 'string|null', 'description' => 'Mã vận đơn hoàn (nếu đã tạo)'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Lấy danh sách vận đơn chờ chuyển hoàn thành công.',
                    'data' => [['tracking_code' => 'VSHN00000012', 'status' => 'pending_return', 'version' => 3]],
                ],
            ],
            'POST /api/v1/shipments/{public_id}/return-process' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Điều phối chờ hoàn: Duyệt giao lại (redeliver) hoặc Sinh vận đơn hoàn (create_return_shipment)',
                'description' => 'Khi action = create_return_shipment, hệ thống tự động hủy COD pending của đơn gốc, chuyển đơn gốc sang returning và sinh vận đơn return_shipment đảo chiều người gửi/nhận.',
                'sample_body' => [
                    'action' => 'create_return_shipment',
                    'version' => 3,
                    'note' => 'Khách từ chối nhận hàng, tạo đơn chuyển hoàn về shop',
                    'charge_return_freight' => false,
                ],
                'response_schema' => [
                    ['field' => 'data.action', 'type' => 'string', 'description' => 'redeliver hoặc create_return_shipment'],
                    ['field' => 'data.parent_shipment', 'type' => 'object', 'description' => 'Trạng thái mới của vận đơn gốc'],
                    ['field' => 'data.return_shipment', 'type' => 'object|null', 'description' => 'Thông tin vận đơn chuyển hoàn mới tạo (nếu create_return_shipment)'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tạo vận đơn chuyển hoàn thành công.',
                    'data' => [
                        'action' => 'create_return_shipment',
                        'parent_shipment' => ['tracking_code' => 'VSHN00000012', 'status' => 'returning'],
                        'return_shipment' => ['tracking_code' => 'VSHN00000013', 'shipment_type' => 'return_shipment', 'status' => 'in_warehouse'],
                    ],
                ],
            ],
            'GET /api/v1/shipment-approval-requests' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Danh sách yêu cầu phê duyệt đặc biệt (Hủy giao thành công, duyệt hoàn...)',
                'description' => 'Danh sách phiếu trình Quản lý chi nhánh duyệt, ưu tiên hiển thị các phiếu pending lên đầu.',
                'query_params' => [
                    ['name' => 'status', 'type' => 'string', 'example' => 'pending', 'description' => 'pending | approved | rejected'],
                    ['name' => 'approval_type', 'type' => 'string', 'example' => 'cancel_delivered_shipment', 'description' => 'Loại yêu cầu phê duyệt'],
                ],
                'response_schema' => [
                    ['field' => 'data[].public_id', 'type' => 'string (ULID)', 'description' => 'ID phiếu yêu cầu phê duyệt'],
                    ['field' => 'data[].request_code', 'type' => 'string', 'description' => 'Mã phiếu (APR-YYYYMMDD-XXXXXX)'],
                    ['field' => 'data[].approval_type', 'type' => 'string', 'description' => 'cancel_delivered_shipment | approve_return | extra_redelivery'],
                    ['field' => 'data[].status', 'type' => 'string', 'description' => 'pending | approved | rejected'],
                    ['field' => 'data[].version', 'type' => 'int', 'description' => 'Version phiếu duyệt'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Lấy danh sách yêu cầu phê duyệt thành công.',
                    'data' => [['request_code' => 'APR-20261126-BCE928', 'status' => 'pending', 'version' => 1]],
                ],
            ],
            'POST /api/v1/shipment-approval-requests' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Gửi yêu cầu phê duyệt Hủy giao thành công (cancel_delivered_shipment)',
                'description' => 'Điều phối viên gửi yêu cầu hủy trạng thái delivered của vận đơn (chỉ cho phép khi giao dịch COD chưa khóa sổ/quyết toán).',
                'sample_body' => [
                    'tracking_code' => 'VSHN00000011',
                    'approval_type' => 'cancel_delivered_shipment',
                    'reason' => 'Shipper bấm nhầm giao thành công, khách chưa nhận hàng',
                    'evidence_urls' => [],
                ],
                'response_schema' => [
                    ['field' => 'data.public_id', 'type' => 'string (ULID)', 'description' => 'ID phiếu yêu cầu'],
                    ['field' => 'data.request_code', 'type' => 'string', 'description' => 'Mã phiếu yêu cầu'],
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'Trạng thái khởi tạo (pending)'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Tạo yêu cầu phê duyệt vận đơn thành công.',
                    'data' => ['request_code' => 'APR-20261126-BCE928', 'status' => 'pending'],
                ],
            ],
            'POST /api/v1/shipment-approval-requests/{public_id}/review' => [
                'module' => 'IncidentCompensation',
                'client_target' => 'web_internal',
                'summary' => 'Quản lý chi nhánh Phê duyệt hoặc Từ chối yêu cầu',
                'description' => 'Khi decision = approved cho cancel_delivered_shipment: tự động hoàn tác vận đơn từ delivered về delivery_failed và hủy các cod_transactions chưa khóa sổ.',
                'sample_body' => [
                    'decision' => 'approved',
                    'version' => 1,
                    'review_note' => 'Đã kiểm tra đối soát, đồng ý hoàn tác trạng thái vận đơn và hủy COD',
                ],
                'response_schema' => [
                    ['field' => 'data.status', 'type' => 'string', 'description' => 'approved hoặc rejected'],
                    ['field' => 'data.shipment_effect', 'type' => 'object|null', 'description' => 'Kết quả hoàn tác vận đơn & số giao dịch COD đã hủy'],
                ],
                'sample_response' => [
                    'success' => true,
                    'message' => 'Phê duyệt yêu cầu thành công.',
                    'data' => [
                        'status' => 'approved',
                        'shipment_effect' => [
                            'tracking_code' => 'VSHN00000011',
                            'previous_status' => 'delivered',
                            'status' => 'delivery_failed',
                            'cancelled_cod_transactions' => 1,
                        ],
                    ],
                ],
            ],
        ];
    }
}