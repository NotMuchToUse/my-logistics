<?php

declare(strict_types=1);

namespace App\Modules\NetworkOrg\Controllers;

use App\Core\ApiException;
use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\NetworkOrg\Repositories\NetworkOrgRepository;

final class NetworkOrgController extends BaseController
{
    public function __construct(private readonly NetworkOrgRepository $repository)
    {
    }

    public function indexBranches(Request $request): Response
    {
        $paging = $this->paginationParameters($request);
        $result = $this->repository->paginateBranches(
            $request->queryParameters(),
            $this->scopeContext($request),
            $paging['page'],
            $paging['per_page'],
        );

        return $this->paginatedResponse($result['items'], $paging['page'], $paging['per_page'], $result['total'], 'Lấy danh sách chi nhánh thành công.');
    }

    public function createBranch(Request $request): Response
    {
        $body = $request->jsonBody();
        $this->requireFields($body, ['code', 'name', 'branch_type', 'province_id', 'district_id', 'ward_id', 'address_line']);
        if (!in_array((string) $body['branch_type'], ['hq', 'regional_hub', 'branch', 'post_office'], true)) {
            throw new ApiException('422_VALIDATION_ERROR', 'branch_type không hợp lệ.', [], 422);
        }

        $scopeContext = $this->scopeContext($request);
        $created = $this->repository->createBranch(
            $body,
            $this->actorId($request),
            $scopeContext['active_branch_id'] ?? null,
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($created, 'Tạo chi nhánh/bưu cục thành công.', 201);
    }

    public function updateBranch(Request $request): Response
    {
        $updated = $this->repository->updateBranch(
            $this->routeParam($request, 'public_id'),
            $request->jsonBody(),
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($updated, 'Cập nhật chi nhánh/bưu cục thành công.');
    }

    public function indexWarehouses(Request $request): Response
    {
        $paging = $this->paginationParameters($request);
        $result = $this->repository->paginateWarehouses(
            $request->queryParameters(),
            $this->scopeContext($request),
            $paging['page'],
            $paging['per_page'],
        );

        return $this->paginatedResponse($result['items'], $paging['page'], $paging['per_page'], $result['total'], 'Lấy danh sách kho thành công.');
    }

    public function createWarehouse(Request $request): Response
    {
        $body = $request->jsonBody();
        $this->requireFields($body, ['branch_id', 'code', 'name', 'warehouse_type', 'address_line']);
        if (!in_array((string) $body['warehouse_type'], ['hub_sorting', 'branch_warehouse', 'post_office_storage'], true)) {
            throw new ApiException('422_VALIDATION_ERROR', 'warehouse_type không hợp lệ.', [], 422);
        }

        $created = $this->repository->createWarehouse(
            $body,
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($created, 'Tạo kho hàng thành công.', 201);
    }

    public function updateWarehouse(Request $request): Response
    {
        $updated = $this->repository->updateWarehouse(
            $this->routeParam($request, 'public_id'),
            $request->jsonBody(),
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($updated, 'Cập nhật kho hàng thành công.');
    }

    public function indexRoles(Request $request): Response
    {
        return Response::success($this->repository->listRoles(), 'Lấy danh sách vai trò thành công.');
    }

    public function indexUsers(Request $request): Response
    {
        $paging = $this->paginationParameters($request);
        $result = $this->repository->paginateStaffUsers(
            $request->queryParameters(),
            $this->scopeContext($request),
            $paging['page'],
            $paging['per_page'],
        );

        return $this->paginatedResponse($result['items'], $paging['page'], $paging['per_page'], $result['total'], 'Lấy danh sách nhân sự thành công.');
    }

    public function showUser(Request $request): Response
    {
        return Response::success(
            $this->repository->findUserDetail($this->routeParam($request, 'public_id')),
            'Lấy chi tiết nhân sự thành công.',
        );
    }

    public function createUser(Request $request): Response
    {
        $body = $request->jsonBody();
        $this->requireFields($body, ['full_name', 'email', 'phone']);
        if (filter_var((string) $body['email'], FILTER_VALIDATE_EMAIL) === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Email không hợp lệ.', ['email' => ['Email không đúng định dạng']], 422);
        }

        $created = $this->repository->createStaffUser(
            $body,
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($created, 'Tạo tài khoản nhân sự thành công.', 201);
    }

    public function updateUser(Request $request): Response
    {
        $updated = $this->repository->updateStaffUser(
            $this->routeParam($request, 'public_id'),
            $request->jsonBody(),
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($updated, 'Cập nhật thông tin nhân sự thành công.');
    }

    public function assignRoles(Request $request): Response
    {
        $body = $request->jsonBody();
        if (!isset($body['role_codes']) || !is_array($body['role_codes'])) {
            throw new ApiException('422_VALIDATION_ERROR', 'Trường role_codes phải là một mảng.', [], 422);
        }

        $updated = $this->repository->syncUserRoles(
            $this->routeParam($request, 'public_id'),
            $body['role_codes'],
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($updated, 'Gán vai trò nhân sự thành công.');
    }

    public function assignBranchScopes(Request $request): Response
    {
        $body = $request->jsonBody();
        if (!isset($body['branch_scopes']) || !is_array($body['branch_scopes'])) {
            throw new ApiException('422_VALIDATION_ERROR', 'Trường branch_scopes phải là một mảng.', [], 422);
        }

        $updated = $this->repository->syncUserBranchScopes(
            $this->routeParam($request, 'public_id'),
            $body['branch_scopes'],
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($updated, 'Cập nhật phạm vi chi nhánh/kho thành công.');
    }

    /**
     * @param array<string, mixed> $body
     * @param list<string> $required
     */
    private function requireFields(array $body, array $required): void
    {
        $errors = [];
        foreach ($required as $field) {
            if (!isset($body[$field]) || trim((string) $body[$field]) === '') {
                $errors[$field] = ["Trường {$field} là bắt buộc."];
            }
        }
        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu đầu vào không hợp lệ.', $errors, 422);
        }
    }

    private function routeParam(Request $request, string $name): string
    {
        $params = $request->attribute('route_params');
        $value = is_array($params) ? (string) ($params[$name] ?? '') : '';
        if ($value === '') {
            throw new ApiException('400_BAD_REQUEST', "Thiếu tham số đường dẫn {$name}.");
        }
        return $value;
    }

    private function actorId(Request $request): int
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Chưa xác thực người dùng.');
        }
        return (int) $auth['user_id'];
    }

    /**
     * @return array<string, mixed>
     */
    private function scopeContext(Request $request): array
    {
        $scope = $request->attribute('scope_context');
        if (!is_array($scope)) {
            throw new ApiException('403_BRANCH_SCOPE', 'Thiếu ngữ cảnh phạm vi chi nhánh.', [], 403);
        }
        return $scope;
    }
}