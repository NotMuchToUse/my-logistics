<?php

declare(strict_types=1);

namespace App\Modules\Warehouse\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Modules\Warehouse\Services\WarehouseService;
use App\Modules\Warehouse\Validators\WarehouseValidator;

final class WarehouseController
{
    public function __construct(
        private readonly WarehouseService $service,
        private readonly WarehouseValidator $validator,
    ) {
    }

    public function routingCheck(Request $request): Response
    {
        $query = $this->validator->validateRoutingCheckQuery($request->queryParameters());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $result = $this->service->checkRouting($query, $scopeContext);

        return Response::success(
            $result,
            $result['is_wrong_route']
                ? 'Cảnh báo: Kiện hàng đang lệch tuyến định tuyến.'
                : 'Định tuyến vận đơn hợp lệ.',
        );
    }

    public function routingRules(Request $request): Response
    {
        $rules = $this->service->listRoutingRules($request->queryParameters());

        return Response::success($rules, 'Lấy danh sách quy tắc định tuyến thành công.');
    }

    public function indexReceipts(Request $request): Response
    {
        $filters = $this->validator->validateReceiptListQuery($request->queryParameters());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $result = $this->service->listReceipts($filters, $scopeContext);

        return Response::paginated(
            $result['items'],
            $filters['page'],
            $filters['per_page'],
            $result['total'],
            'Lấy danh sách phiếu kho thành công.',
        );
    }

    public function storeReceipt(Request $request): Response
    {
        $payload = $this->validator->validateCreateReceipt($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $created = $this->service->createInboundReceipt(
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($created, 'Tạo phiếu nhập kho thành công.', 201);
    }

    public function showReceipt(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $scopeContext = (array) $request->attribute('scope_context', []);

        $receipt = $this->service->showReceipt($publicId, $scopeContext);

        return Response::success($receipt, 'Lấy chi tiết phiếu kho thành công.');
    }

    public function scanReceipt(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $scanItems = $this->validator->validateScanReceiptItems($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $updated = $this->service->scanInboundReceipt(
            $publicId,
            $scanItems,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($updated, 'Quét vận đơn nhập kho thành công.');
    }

    public function confirmReceipt(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateConfirmReceipt($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $confirmed = $this->service->confirmInboundReceipt(
            $publicId,
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($confirmed, 'Chốt phiếu nhập kho thành công.');
    }

    public function unlockReceipt(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateUnlockReceipt($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);

        $unlocked = $this->service->unlockReceipt(
            $publicId,
            $payload,
            $scopeContext,
            $auth,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($unlocked, 'Mở khóa phiếu xuất kho thành công.');
    }

    public function outboundDeliveryBootstrap(Request $request): Response
    {
        $query = $this->validator->validateOutboundDeliveryBootstrapQuery($request->queryParameters());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $data = $this->service->getOutboundDeliveryBootstrap($query, $scopeContext);

        return Response::success($data, 'Lấy dữ liệu xuất kho giao hàng thành công.');
    }

    public function storeOutboundDelivery(Request $request): Response
    {
        $payload = $this->validator->validateCreateOutboundDelivery($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $created = $this->service->createOutboundDelivery(
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($created, 'Tạo phiếu xuất kho giao hàng thành công.', 201);
    }

    public function scanOutboundDelivery(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $trackingCodes = $this->validator->validateScanOutboundDelivery($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $updated = $this->service->scanOutboundDelivery(
            $publicId,
            $trackingCodes,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($updated, 'Quét vận đơn vào phiếu xuất giao hàng thành công.');
    }

    public function removeOutboundDeliveryItem(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateRemoveOutboundDeliveryItem($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $updated = $this->service->removeOutboundDeliveryItem(
            $publicId,
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($updated, 'Đã gỡ vận đơn khỏi phiếu xuất giao hàng.');
    }

    public function confirmOutboundDelivery(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateConfirmReceipt($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $confirmed = $this->service->confirmOutboundDelivery(
            $publicId,
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($confirmed, 'Chốt phiếu xuất kho giao hàng thành công.');
    }

    public function outboundLinehaulDataset(Request $request): Response
    {
        $scopeContext = (array) $request->attribute('scope_context', []);
        $dataset = $this->service->getOutboundLinehaulDataset($scopeContext);

        return Response::success($dataset, 'Lấy dữ liệu xuất kho trung chuyển thành công.');
    }

    public function storeOutboundLinehaul(Request $request): Response
    {
        $payload = $this->validator->validateCreateOutboundLinehaul($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $created = $this->service->createOutboundLinehaul(
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($created, 'Tạo phiếu xuất kho trung chuyển thành công.', 201);
    }

    public function scanOutboundLinehaul(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $scanItems = $this->validator->validateScanOutboundLinehaul($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $updated = $this->service->scanOutboundLinehaul(
            $publicId,
            $scanItems,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($updated, 'Quét vận đơn/túi Seal vào phiếu xuất trung chuyển thành công.');
    }

    public function confirmOutboundLinehaul(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateConfirmReceipt($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $confirmed = $this->service->confirmOutboundLinehaul(
            $publicId,
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($confirmed, 'Chốt phiếu xuất kho trung chuyển thành công.');
    }

    public function indexStockAudits(Request $request): Response
    {
        $filters = $this->validator->validateStockAuditListQuery($request->queryParameters());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $res = $this->service->listStockAudits($filters, $scopeContext);

        return Response::paginated(
            $res['items'],
            $filters['page'],
            $filters['per_page'],
            $res['total'],
            'Lấy danh sách phiên kiểm kê kho thành công.',
        );
    }

    public function storeStockAudit(Request $request): Response
    {
        $payload = $this->validator->validateCreateStockAudit($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $created = $this->service->createStockAudit(
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($created, 'Tạo phiên kiểm kê kho thành công.', 201);
    }

    public function showStockAudit(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $auditIdOrCode = (string) ($params['audit_id'] ?? '');
        $scopeContext = (array) $request->attribute('scope_context', []);

        $audit = $this->service->showStockAudit($auditIdOrCode, $scopeContext);

        return Response::success($audit, 'Lấy chi tiết phiên kiểm kê kho thành công.');
    }

    public function scanStockAudit(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $auditIdOrCode = (string) ($params['audit_id'] ?? '');
        $payload = $this->validator->validateScanStockAudit($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $updated = $this->service->scanStockAudit(
            $auditIdOrCode,
            $payload['tracking_codes'],
            $payload['note'],
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($updated, 'Quét vận đơn kiểm kê kho thành công.');
    }

    public function completeStockAudit(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $auditIdOrCode = (string) ($params['audit_id'] ?? '');
        $payload = $this->validator->validateCompleteStockAudit($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $completed = $this->service->completeStockAudit(
            $auditIdOrCode,
            $payload['note'],
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($completed, 'Chốt hoàn tất phiên kiểm kê kho thành công.');
    }

    public function indexBags(Request $request): Response
    {
        $filters = $this->validator->validateBagListQuery($request->queryParameters());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $result = $this->service->listBags($filters, $scopeContext);

        return Response::paginated(
            $result['items'],
            $filters['page'],
            $filters['per_page'],
            $result['total'],
            'Lấy danh sách túi hàng Seal thành công.',
        );
    }

    public function storeBag(Request $request): Response
    {
        $payload = $this->validator->validateCreateBag($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $bag = $this->service->createBag(
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($bag, 'Tạo túi hàng Seal thành công.', 201);
    }

    public function showBag(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $scopeContext = (array) $request->attribute('scope_context', []);

        $bag = $this->service->showBag($publicId, $scopeContext);

        return Response::success($bag, 'Lấy chi tiết túi hàng Seal thành công.');
    }

    public function addBagItems(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateBagScanItems($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $bag = $this->service->addItemsToBag(
            $publicId,
            $payload['tracking_codes'],
            $payload['strict_routing'],
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($bag, 'Quét vận đơn vào túi hàng thành công.');
    }

    public function sealBag(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateSealBag($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $bag = $this->service->sealBag(
            $publicId,
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($bag, 'Niêm phong túi hàng Seal thành công.');
    }

    public function openBag(Request $request): Response
    {
        $params = (array) $request->attribute('route_params', []);
        $publicId = (string) ($params['public_id'] ?? '');
        $payload = $this->validator->validateOpenBag($request->jsonBody());
        $scopeContext = (array) $request->attribute('scope_context', []);
        $auth = (array) $request->attribute('auth', []);
        $userId = (int) ($auth['user_id'] ?? 0);

        $bag = $this->service->openBag(
            $publicId,
            $payload,
            $scopeContext,
            $userId,
            $request->ipAddress(),
            $request->userAgent(),
        );

        return Response::success($bag, 'Mở niêm phong túi hàng và nhập kho thành công.');
    }
}