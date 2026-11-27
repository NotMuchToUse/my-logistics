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

        return Response::success($receipt, 'Lấy chi tiết phiếu nhập kho thành công.');
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