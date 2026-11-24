<?php

declare(strict_types=1);

use App\Core\Router;
use App\Core\Database;
use App\Middleware\AuthMiddleware;
use App\Middleware\BranchScopeMiddleware;
use App\Middleware\IdempotencyMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Modules\Shipment\Controllers\ShipmentController;
use App\Modules\Shipment\Repositories\PricingLookupRepository;
use App\Modules\Shipment\Repositories\ShipmentRepository;
use App\Modules\Shipment\Repositories\TrackingRangeRepository;
use App\Modules\Shipment\Services\ShipmentPricingService;
use App\Modules\Shipment\Services\ShipmentService;
use App\Modules\Shipment\Validators\CreateShipmentValidator;
use App\Modules\Shipment\Validators\ShipmentActionValidator;

return static function (Router $router): void {
    $pdo = Database::getConnection();
    $controller = new ShipmentController(
        new ShipmentService(
            $pdo,
            new ShipmentRepository($pdo),
            new TrackingRangeRepository($pdo),
            new ShipmentPricingService(new PricingLookupRepository($pdo)),
        ),
        new CreateShipmentValidator(),
        new ShipmentActionValidator(),
    );
    $auth = new AuthMiddleware($pdo);
    $branchScope = new BranchScopeMiddleware($pdo);
    $idempotency = new IdempotencyMiddleware($pdo);

    $router->post('/api/v1/shipments', [$controller, 'create'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipments.create'),
        $branchScope,
        $idempotency,
    ]);
    $router->get('/api/v1/shipments', [$controller, 'index'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipments.read'),
        $branchScope,
    ]);
    $router->get('/api/v1/shipments/{public_id}', [$controller, 'show'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipments.read'),
        $branchScope,
    ]);
    $router->patch('/api/v1/shipments/{public_id}/priority', [$controller, 'updatePriority'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipments.priority'),
        $branchScope,
    ]);
    $router->post('/api/v1/shipments/{public_id}/cancel', [$controller, 'cancel'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipments.cancel'),
        $branchScope,
    ]);
    $router->post('/api/v1/shipments/{public_id}/forward', [$controller, 'forward'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipments.forward'),
        $branchScope,
        $idempotency,
    ]);
    $router->post('/api/v1/shipments/{public_id}/print-logs', [$controller, 'recordPrint'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipments.print'),
        $branchScope,
    ]);
};
