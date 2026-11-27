<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\BranchScopeMiddleware;
use App\Middleware\IdempotencyMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Modules\Warehouse\Controllers\WarehouseController;
use App\Modules\Warehouse\Repositories\WarehouseRepository;
use App\Modules\Warehouse\Services\WarehouseService;
use App\Modules\Warehouse\Validators\WarehouseValidator;

return static function (Router $router): void {
    $pdo = Database::getConnection();
    $controller = new WarehouseController(
        new WarehouseService(new WarehouseRepository($pdo)),
        new WarehouseValidator(),
    );

    $auth = new AuthMiddleware($pdo);
    $branchScope = new BranchScopeMiddleware($pdo);
    $idempotency = new IdempotencyMiddleware($pdo);

    // 1. Kiểm tra định tuyến & Cảnh báo sai tuyến (branch_routing_rules)
    $router->get('/api/v1/warehouse/routing-check', [$controller, 'routingCheck'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.read'),
        $branchScope,
    ]);
    $router->get('/api/v1/warehouse/routing-rules', [$controller, 'routingRules'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.read'),
        $branchScope,
    ]);

    // 2. Phiếu nhập kho (warehouse_receipts - inbound)
    $router->get('/api/v1/warehouse/receipts', [$controller, 'indexReceipts'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/warehouse/receipts', [$controller, 'storeReceipt'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.receive'),
        $branchScope,
        $idempotency,
    ]);
    $router->get('/api/v1/warehouse/receipts/{public_id}', [$controller, 'showReceipt'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/warehouse/receipts/{public_id}/scan', [$controller, 'scanReceipt'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.receive'),
        $branchScope,
        $idempotency,
    ]);
    $router->post('/api/v1/warehouse/receipts/{public_id}/confirm', [$controller, 'confirmReceipt'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.receive'),
        $branchScope,
        $idempotency,
    ]);

    // 3. Đóng / Mở túi hàng Seal (manifest_bags & manifest_bag_items)
    $router->get('/api/v1/warehouse/bags', [$controller, 'indexBags'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/warehouse/bags', [$controller, 'storeBag'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.manage_bags'),
        $branchScope,
        $idempotency,
    ]);
    $router->get('/api/v1/warehouse/bags/{public_id}', [$controller, 'showBag'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/warehouse/bags/{public_id}/items', [$controller, 'addBagItems'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.manage_bags'),
        $branchScope,
        $idempotency,
    ]);
    $router->post('/api/v1/warehouse/bags/{public_id}/seal', [$controller, 'sealBag'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.manage_bags'),
        $branchScope,
        $idempotency,
    ]);
    $router->post('/api/v1/warehouse/bags/{public_id}/open', [$controller, 'openBag'], [
        $auth,
        new PermissionMiddleware($pdo, 'warehouse.manage_bags'),
        $branchScope,
        $idempotency,
    ]);
};