<?php

declare(strict_types=1);

namespace App\Modules\Customer\Controllers;

use App\Core\ApiException;
use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\Customer\Repositories\CustomerPortalRepository;

final class CustomerPortalController extends BaseController
{
    public function __construct(private readonly CustomerPortalRepository $repository)
    {
    }

    public function listAddresses(Request $request): Response
    {
        return Response::success(
            $this->repository->listAddresses($this->actorId($request), $request->queryParameters()),
            'Lấy sổ địa chỉ thành công.',
        );
    }

    public function createAddress(Request $request): Response
    {
        $body = $request->jsonBody();
        $errors = [];
        foreach (['contact_name', 'phone', 'province_id', 'district_id', 'ward_id', 'address_line'] as $field) {
            if (!isset($body[$field]) || trim((string) $body[$field]) === '') {
                $errors[$field] = ["Trường {$field} là bắt buộc."];
            }
        }
        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu địa chỉ không hợp lệ.', $errors, 422);
        }

        $created = $this->repository->createAddress($this->actorId($request), $body);
        return Response::success($created, 'Thêm địa chỉ mới thành công.', 201);
    }

    public function updateAddress(Request $request): Response
    {
        $updated = $this->repository->updateAddress(
            $this->actorId($request),
            $this->routeParam($request, 'public_id'),
            $request->jsonBody(),
        );

        return Response::success($updated, 'Cập nhật địa chỉ thành công.');
    }

    public function deleteAddress(Request $request): Response
    {
        $this->repository->deleteAddress(
            $this->actorId($request),
            $this->routeParam($request, 'public_id'),
        );

        return Response::success(null, 'Xóa địa chỉ thành công.');
    }

    public function indexPickupRequests(Request $request): Response
    {
        $paging = $this->paginationParameters($request);
        $result = $this->repository->paginateOwnPickupRequests(
            $this->actorId($request),
            $request->queryParameters(),
            $paging['page'],
            $paging['per_page'],
        );

        return $this->paginatedResponse($result['items'], $paging['page'], $paging['per_page'], $result['total'], 'Lấy danh sách yêu cầu lấy hàng thành công.');
    }

    public function createPickupRequest(Request $request): Response
    {
        $created = $this->repository->createPickupRequest(
            $this->actorId($request),
            $request->jsonBody(),
        );

        return Response::success($created, 'Gửi yêu cầu lấy hàng thành công.', 201);
    }

    public function showPickupRequest(Request $request): Response
    {
        return Response::success(
            $this->repository->findOwnPickupDetail($this->actorId($request), $this->routeParam($request, 'public_id')),
            'Lấy chi tiết yêu cầu lấy hàng thành công.',
        );
    }

    public function cancelPickupRequest(Request $request): Response
    {
        $body = $request->jsonBody();
        $reason = trim((string) ($body['cancel_reason'] ?? ''));
        if ($reason === '' || mb_strlen($reason) < 3) {
            throw new ApiException('422_VALIDATION_ERROR', 'Vui lòng nhập lý do hủy yêu cầu lấy hàng (cancel_reason).', ['cancel_reason' => ['Lý do hủy là bắt buộc']], 422);
        }

        $updated = $this->repository->cancelOwnPickupRequest(
            $this->actorId($request),
            $this->routeParam($request, 'public_id'),
            $reason,
        );

        return Response::success($updated, 'Hủy yêu cầu lấy hàng thành công.');
    }

    private function actorId(Request $request): int
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập tài khoản khách hàng.');
        }
        return (int) $auth['user_id'];
    }

    private function routeParam(Request $request, string $name): string
    {
        $params = $request->attribute('route_params');
        $value = is_array($params) ? (string) ($params[$name] ?? '') : '';
        if ($value === '') {
            throw new ApiException('400_BAD_REQUEST', "Thiếu tham số {$name}.");
        }
        return $value;
    }
}