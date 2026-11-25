<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Controllers;

use App\Core\ApiException;
use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\Shipment\DTOs\ShipmentFilterDto;
use App\Modules\Shipment\Services\ShipmentService;
use App\Modules\Shipment\Validators\BulkImportShipmentValidator;
use App\Modules\Shipment\Validators\CreateShipmentValidator;
use App\Modules\Shipment\Validators\ShipmentActionValidator;
use DateTimeImmutable;
use DateTimeZone;

final class ShipmentController extends BaseController
{
    private const SHIPMENT_STATUSES = [
        'draft',
        'pending_pickup',
        'picked_up',
        'in_warehouse',
        'bagged',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'delivery_failed',
        'pending_return',
        'returning',
        'returned',
        'incident',
        'cancelled',
    ];

    public function __construct(
        private readonly ShipmentService $shipmentService,
        private readonly CreateShipmentValidator $createValidator,
        private readonly ShipmentActionValidator $actionValidator,
        private readonly BulkImportShipmentValidator $bulkImportValidator,
    ) {
    }

    public function create(Request $request): Response
    {
        $shipment = $this->shipmentService->create(
            $this->createValidator->validate($request->jsonBody()),
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($shipment, 'Tạo vận đơn thành công.', 201);
    }

    public function bulkImport(Request $request): Response
    {
        $validatedBatch = $this->bulkImportValidator->validateBatch($request->jsonBody());
        $result = $this->shipmentService->bulkImport(
            $validatedBatch['valid_rows'],
            $validatedBatch['row_errors'],
            $validatedBatch['total_rows'],
            $validatedBatch['dry_run'],
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );
        $statusCode = $validatedBatch['dry_run'] ? 200 : 201;
        $message = $validatedBatch['dry_run']
            ? 'Kiểm tra hợp lệ danh sách vận đơn import thành công.'
            : 'Import danh sách vận đơn hàng loạt thành công.';
        return Response::success($result, $message, $statusCode);
    }
    public function index(Request $request): Response
    {
        $filters = $this->shipmentFilters($request);
        $result = $this->shipmentService->paginate($filters, $this->scopeContext($request));

        return $this->paginatedResponse(
            $result['items'],
            $filters->page,
            $filters->perPage,
            $result['total'],
            'Lấy danh sách vận đơn thành công.',
        );
    }

    public function show(Request $request): Response
    {
        return Response::success(
            $this->shipmentService->detail(
                $this->routeIdentifier($request),
                $this->scopeContext($request),
            ),
            'Lấy chi tiết vận đơn thành công.',
        );
    }

    public function updatePriority(Request $request): Response
    {
        $action = $this->actionValidator->validatePriority($request->jsonBody());
        $result = $this->shipmentService->updatePriority(
            $this->routeIdentifier($request),
            $action['version'],
            $action['is_priority'],
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($result, 'Cập nhật ưu tiên vận đơn thành công.');
    }

    public function cancel(Request $request): Response
    {
        $action = $this->actionValidator->validateCancellation($request->jsonBody());
        $result = $this->shipmentService->cancel(
            $this->routeIdentifier($request),
            $action['version'],
            $action['cancel_reason'],
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($result, 'Hủy vận đơn thành công.');
    }

    public function forward(Request $request): Response
    {
        $recipient = $this->actionValidator->validateForward($request->jsonBody());
        $result = $this->shipmentService->forward(
            $this->routeIdentifier($request),
            $recipient,
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
            $request->userAgent(),
        );

        return Response::success($result, 'Tạo vận đơn chuyển tiếp thành công.', 201);
    }

    public function recordPrint(Request $request): Response
    {
        $print = $this->actionValidator->validatePrintLog($request->jsonBody());
        $result = $this->shipmentService->recordPrint(
            $this->routeIdentifier($request),
            $print['document_type'],
            $print['print_count'],
            $this->scopeContext($request),
            $this->actorId($request),
            $this->clientIp($request),
        );

        return Response::success($result, 'Lưu lịch sử in vận đơn thành công.', 201);
    }

    private function shipmentFilters(Request $request): ShipmentFilterDto
    {
        $query = $request->queryParameters();
        $errors = [];
        $status = $this->optionalString($query, 'status', 40, $errors);
        if ($status !== null && !in_array($status, self::SHIPMENT_STATUSES, true)) {
            $errors['status'][] = 'Trạng thái vận đơn không hợp lệ.';
        }

        $trackingCode = $this->optionalString($query, 'tracking_code', 50, $errors);
        $phone = $this->optionalString($query, 'phone', 20, $errors);
        if ($phone !== null && !$this->isVietnamesePhone($phone)) {
            $errors['phone'][] = 'Số điện thoại Việt Nam không hợp lệ.';
        }

        $serviceTypeId = $this->optionalPositiveInteger($query, 'service_type_id', $errors);
        $isPriority = $this->optionalBoolean($query, 'is_priority', $errors);
        $fromDate = $this->optionalDate($query, 'from_date', $errors);
        $toDate = $this->optionalDate($query, 'to_date', $errors);
        if ($fromDate !== null && $toDate !== null && $fromDate > $toDate) {
            $errors['to_date'][] = 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.';
        }

        $pagination = $this->paginationParameters($request);
        $pageValue = filter_var($query['page'] ?? 1, FILTER_VALIDATE_INT);
        $perPageValue = filter_var($query['per_page'] ?? 20, FILTER_VALIDATE_INT);
        if ($pageValue === false || $pageValue < 1) {
            $errors['page'][] = 'Trang phải là số nguyên dương.';
        }
        if ($perPageValue === false || $perPageValue < 1 || $perPageValue > 100) {
            $errors['per_page'][] = 'Số phần tử mỗi trang phải nằm trong khoảng 1 đến 100.';
        }

        $sortBy = $this->optionalString($query, 'sort_by', 32, $errors) ?? 'created_at';
        if (!in_array($sortBy, ['created_at', 'tracking_code', 'cod_amount', 'total_freight_amount'], true)) {
            $errors['sort_by'][] = 'Cột sắp xếp không được hỗ trợ.';
        }
        $sortDirection = strtoupper($this->optionalString($query, 'sort_direction', 4, $errors) ?? 'DESC');
        if (!in_array($sortDirection, ['ASC', 'DESC'], true)) {
            $errors['sort_direction'][] = 'Thứ tự sắp xếp phải là ASC hoặc DESC.';
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Bộ lọc vận đơn không hợp lệ.', $errors);
        }

        return new ShipmentFilterDto(
            $status,
            $trackingCode,
            $phone,
            $serviceTypeId,
            $isPriority,
            $fromDate,
            $toDate,
            $pagination['page'],
            $pagination['per_page'],
            $sortBy,
            $sortDirection,
        );
    }

    /**
     * @param array<string, mixed> $query
     * @param array<string, list<string>> $errors
     */
    private function optionalString(array $query, string $field, int $maximumLength, array &$errors): ?string
    {
        if (!array_key_exists($field, $query) || $query[$field] === null || $query[$field] === '') {
            return null;
        }
        if (!is_string($query[$field])) {
            $errors[$field][] = 'Giá trị phải là chuỗi.';
            return null;
        }

        $value = trim($query[$field]);
        if ($value === '') {
            return null;
        }
        if (mb_strlen($value, 'UTF-8') > $maximumLength) {
            $errors[$field][] = 'Độ dài vượt quá giới hạn cho phép.';
            return null;
        }

        return $value;
    }

    /**
     * @param array<string, mixed> $query
     * @param array<string, list<string>> $errors
     */
    private function optionalPositiveInteger(array $query, string $field, array &$errors): ?int
    {
        if (!array_key_exists($field, $query) || $query[$field] === null || $query[$field] === '') {
            return null;
        }

        $value = filter_var($query[$field], FILTER_VALIDATE_INT);
        if ($value === false || $value < 1) {
            $errors[$field][] = 'Giá trị phải là số nguyên dương.';
            return null;
        }

        return $value;
    }

    /**
     * @param array<string, mixed> $query
     * @param array<string, list<string>> $errors
     */
    private function optionalBoolean(array $query, string $field, array &$errors): ?bool
    {
        if (!array_key_exists($field, $query) || $query[$field] === null || $query[$field] === '') {
            return null;
        }
        if (!is_string($query[$field]) || !in_array(strtolower($query[$field]), ['true', 'false', '1', '0'], true)) {
            $errors[$field][] = 'Giá trị phải là true, false, 1 hoặc 0.';
            return null;
        }

        return in_array(strtolower($query[$field]), ['true', '1'], true);
    }

    /**
     * @param array<string, mixed> $query
     * @param array<string, list<string>> $errors
     */
    private function optionalDate(array $query, string $field, array &$errors): ?string
    {
        $value = $this->optionalString($query, $field, 10, $errors);
        if ($value === null) {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('+07:00'));
        $dateErrors = DateTimeImmutable::getLastErrors();
        if (
            $date === false
            || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0))
            || $date->format('Y-m-d') !== $value
        ) {
            $errors[$field][] = 'Ngày phải theo định dạng YYYY-MM-DD.';
            return null;
        }

        return $value;
    }

    /**
     * @param array<string, mixed> $scopeContext
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
        if (!is_array($auth) || !isset($auth['user_id']) || !is_numeric($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để quản lý vận đơn.');
        }

        return (int) $auth['user_id'];
    }

    private function clientIp(Request $request): string
    {
        $ipAddress = $request->ipAddress();
        if ($ipAddress === null || filter_var($ipAddress, FILTER_VALIDATE_IP) === false) {
            throw new ApiException('400_BAD_REQUEST', 'Không xác định được địa chỉ IP của yêu cầu.');
        }

        return $ipAddress;
    }

    private function routeIdentifier(Request $request): string
    {
        $routeParameters = $request->attribute('route_params', []);
        $identifier = is_array($routeParameters) ? ($routeParameters['public_id'] ?? null) : null;
        if (!is_string($identifier) || trim($identifier) === '' || strlen($identifier) > 64) {
            throw new ApiException('400_BAD_REQUEST', 'Mã vận đơn không hợp lệ.');
        }

        return trim($identifier);
    }

    private function isVietnamesePhone(string $phone): bool
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '84')) {
            $digits = '0' . substr($digits, 2);
        }

        return preg_match('/^0[0-9]{9,10}$/', $digits) === 1;
    }
}
