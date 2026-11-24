<?php

declare(strict_types=1);

namespace App\Modules\Pickup\Controllers;

use App\Core\ApiException;
use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\Pickup\Repositories\PickupRepository;

final class PickupDispatchController extends BaseController
{
    public function __construct(private readonly PickupRepository $repository)
    {
    }

    public function index(Request $request): Response
    {
        $paging = $this->paginationParameters($request);
        $result = $this->repository->paginate(
            $request->queryParameters(),
            $this->scopeContext($request),
            $paging['page'],
            $paging['per_page'],
        );

        return $this->paginatedResponse($result['items'], $paging['page'], $paging['per_page'], $result['total'], 'Lấy danh sách yêu cầu lấy hàng thành công.');
    }

    public function show(Request $request): Response
    {
        return Response::success(
            $this->repository->findDetail($this->routeParam($request, 'public_id'), $this->scopeContext($request)),
            'Lấy chi tiết yêu cầu lấy hàng thành công.',
        );
    }

    public function availableDrivers(Request $request): Response
    {
        return Response::success(
            $this->repository->listAvailableDrivers($this->scopeContext($request)),
            'Lấy danh sách tài xế lấy hàng khả dụng thành công.',
        );
    }

    public function assignDriver(Request $request): Response
    {
        $body = $request->jsonBody();
        $driverIdentifier = (string) ($body['driver_id'] ?? $body['driver_public_id'] ?? '');
        $version = filter_var($body['version'] ?? null, FILTER_VALIDATE_INT);

        $errors = [];
        if (trim($driverIdentifier) === '') {
            $errors['driver_id'] = ['Vui lòng chọn tài xế lấy hàng.'];
        }
        if ($version === false || $version < 1) {
            $errors['version'] = ['Trường version (Optimistic Locking) là bắt buộc và phải >= 1.'];
        }
        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu phân công tài xế không hợp lệ.', $errors, 422);
        }

        $updated = $this->repository->assignDriver(
            $this->routeParam($request, 'public_id'),
            trim($driverIdentifier),
            (int) $version,
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($updated, 'Phân công tài xế lấy hàng thành công.');
    }

    public function cancel(Request $request): Response
    {
        $body = $request->jsonBody();
        $cancelReason = trim((string) ($body['cancel_reason'] ?? ''));
        $version = filter_var($body['version'] ?? null, FILTER_VALIDATE_INT);

        $errors = [];
        if ($cancelReason === '' || mb_strlen($cancelReason) < 5) {
            $errors['cancel_reason'] = ['Lý do hủy yêu cầu lấy hàng (cancel_reason) tối thiểu 5 ký tự.'];
        }
        if ($version === false || $version < 1) {
            $errors['version'] = ['Trường version (Optimistic Locking) là bắt buộc và phải >= 1.'];
        }
        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu hủy yêu cầu lấy hàng không hợp lệ.', $errors, 422);
        }

        $updated = $this->repository->cancelRequest(
            $this->routeParam($request, 'public_id'),
            $cancelReason,
            (int) $version,
            $this->scopeContext($request),
            $this->actorId($request),
            $request->ipAddress() ?? '127.0.0.1',
            $request->userAgent(),
        );

        return Response::success($updated, 'Hủy yêu cầu lấy hàng thành công.');
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