<?php

declare(strict_types=1);

namespace App\Modules\IncidentCompensation\Controllers;

use App\Core\ApiException;
use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\IncidentCompensation\Services\IncidentCompensationService;
use App\Modules\IncidentCompensation\Validators\IncidentCompensationValidator;

final class IncidentCompensationController extends BaseController
{
    public function __construct(
        private readonly IncidentCompensationService $service,
        private readonly IncidentCompensationValidator $validator,
    ) {
    }

    // --- 1. CRUD Sự cố vận đơn ---

    public function indexIncidents(Request $request): Response
    {
        $query = $request->queryParameters();
        $pagination = $this->paginationParameters($request);
        $filters = [
            'status' => $this->optionalString($query, 'status', 30),
            'incident_type' => $this->optionalString($query, 'incident_type', 40),
            'severity' => $this->optionalString($query, 'severity', 20),
            'tracking_code' => $this->optionalString($query, 'tracking_code', 50),
            'page' => $pagination['page'],
            'per_page' => $pagination['per_page'],
        ];

        $result = $this->service->listIncidents($filters, $this->scopeContext($request));

        return $this->paginatedResponse(
            $result['items'],
            $pagination['page'],
            $pagination['per_page'],
            $result['total'],
            'Lấy danh sách sự cố vận đơn thành công.',
        );
    }

    public function storeIncident(Request $request): Response
    {
        $validated = $this->validator->validateCreateIncident($request->jsonBody());
        $result = $this->service->createIncident(
            $validated,
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($result, 'Tạo báo cáo sự cố vận đơn thành công.', 201);
    }

    public function showIncident(Request $request): Response
    {
        $result = $this->service->getIncident(
            $this->routeIdentifier($request),
            $this->scopeContext($request),
        );

        return Response::success($result, 'Lấy chi tiết sự cố vận đơn thành công.');
    }

    public function updateIncident(Request $request): Response
    {
        $validated = $this->validator->validateUpdateIncident($request->jsonBody());
        $result = $this->service->updateIncident(
            $this->routeIdentifier($request),
            $validated,
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($result, 'Cập nhật sự cố vận đơn thành công.');
    }

    public function destroyIncident(Request $request): Response
    {
        $result = $this->service->deleteIncident(
            $this->routeIdentifier($request),
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($result, 'Xóa báo cáo sự cố vận đơn thành công.');
    }

    // --- 2. Điều phối danh sách chờ chuyển hoàn ---

    public function indexPendingReturns(Request $request): Response
    {
        $query = $request->queryParameters();
        $pagination = $this->paginationParameters($request);
        $filters = [
            'tracking_code' => $this->optionalString($query, 'tracking_code', 50),
            'include_failed' => $query['include_failed'] ?? false,
            'page' => $pagination['page'],
            'per_page' => $pagination['per_page'],
        ];

        $result = $this->service->listPendingReturns($filters, $this->scopeContext($request));

        return $this->paginatedResponse(
            $result['items'],
            $pagination['page'],
            $pagination['per_page'],
            $result['total'],
            'Lấy danh sách vận đơn chờ chuyển hoàn thành công.',
        );
    }

    public function processReturn(Request $request): Response
    {
        $validated = $this->validator->validateReturnDisposition($request->jsonBody());
        $result = $this->service->processReturnDisposition(
            $this->routeIdentifier($request),
            $validated,
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        $statusCode = $validated['action'] === 'create_return_shipment' ? 201 : 200;
        $message = $validated['action'] === 'create_return_shipment'
            ? 'Tạo vận đơn chuyển hoàn thành công.'
            : 'Duyệt giao lại vận đơn thành công.';

        return Response::success($result, $message, $statusCode);
    }

    // --- 3. Luồng phê duyệt yêu cầu hủy giao thành công ---

    public function indexApprovalRequests(Request $request): Response
    {
        $query = $request->queryParameters();
        $pagination = $this->paginationParameters($request);
        $filters = [
            'status' => $this->optionalString($query, 'status', 30),
            'approval_type' => $this->optionalString($query, 'approval_type', 40),
            'tracking_code' => $this->optionalString($query, 'tracking_code', 50),
            'page' => $pagination['page'],
            'per_page' => $pagination['per_page'],
        ];

        $result = $this->service->listApprovalRequests($filters, $this->scopeContext($request));

        return $this->paginatedResponse(
            $result['items'],
            $pagination['page'],
            $pagination['per_page'],
            $result['total'],
            'Lấy danh sách yêu cầu phê duyệt thành công.',
        );
    }

    public function storeApprovalRequest(Request $request): Response
    {
        $validated = $this->validator->validateCreateApprovalRequest($request->jsonBody());
        $result = $this->service->createApprovalRequest(
            $validated,
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($result, 'Tạo yêu cầu phê duyệt vận đơn thành công.', 201);
    }

    public function showApprovalRequest(Request $request): Response
    {
        $result = $this->service->getApprovalRequest(
            $this->routeIdentifier($request),
            $this->scopeContext($request),
        );

        return Response::success($result, 'Lấy chi tiết yêu cầu phê duyệt thành công.');
    }

    public function reviewApprovalRequest(Request $request): Response
    {
        $validated = $this->validator->validateReviewApprovalRequest($request->jsonBody());
        $result = $this->service->reviewApprovalRequest(
            $this->routeIdentifier($request),
            $validated,
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        $message = $validated['decision'] === 'approved'
            ? 'Phê duyệt yêu cầu thành công.'
            : 'Từ chối yêu cầu thành công.';

        return Response::success($result, $message);
    }

    /**
     * @param array<string, mixed> $query
     */
    private function optionalString(array $query, string $field, int $maxLen): ?string
    {
        if (!isset($query[$field]) or !is_string($query[$field])) {
            return null;
        }
        $val = trim($query[$field]);
        if (($val === '') or (mb_strlen($val, 'UTF-8') > $maxLen)) {
            return null;
        }
        return $val;
    }

    /**
     * @return array<string, mixed>
     */
    private function scopeContext(Request $request): array
    {
        $scopeContext = $request->attribute('scope_context');
        if (!is_array($scopeContext)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Thiếu ngữ cảnh phạm vi chi nhánh.');
        }

        return $scopeContext;
    }

    private function actorId(Request $request): int
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) or !isset($auth['user_id']) or !is_numeric($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để thực hiện thao tác.');
        }

        return (int) $auth['user_id'];
    }

    private function clientIp(Request $request): string
    {
        $ipAddress = $request->ipAddress();
        if (($ipAddress === null) or (filter_var($ipAddress, FILTER_VALIDATE_IP) === false)) {
            return '127.0.0.1';
        }

        return $ipAddress;
    }

    private function routeIdentifier(Request $request): string
    {
        $routeParameters = $request->attribute('route_params', []);
        $identifier = is_array($routeParameters) ? ($routeParameters['public_id'] ?? null) : null;
        if (!is_string($identifier) or (trim($identifier) === '') or (strlen($identifier) > 64)) {
            throw new ApiException('400_BAD_REQUEST', 'Mã định danh không hợp lệ.');
        }

        return trim($identifier);
    }
}