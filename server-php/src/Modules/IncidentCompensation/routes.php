<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\BranchScopeMiddleware;
use App\Middleware\IdempotencyMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Modules\IncidentCompensation\Controllers\IncidentCompensationController;
use App\Modules\IncidentCompensation\Repositories\ReturnAndApprovalRepository;
use App\Modules\IncidentCompensation\Repositories\ShipmentIncidentRepository;
use App\Modules\IncidentCompensation\Services\IncidentCompensationService;
use App\Modules\IncidentCompensation\Validators\IncidentCompensationValidator;
use App\Modules\Shipment\Repositories\PricingLookupRepository;
use App\Modules\Shipment\Repositories\ShipmentRepository;
use App\Modules\Shipment\Repositories\TrackingRangeRepository;
use App\Modules\Shipment\Services\ShipmentPricingService;

return static function (Router $router): void {
    $pdo = Database::getConnection();
    $controller = new IncidentCompensationController(
        new IncidentCompensationService(
            new ShipmentIncidentRepository($pdo),
            new ReturnAndApprovalRepository($pdo),
            new ShipmentRepository($pdo),
            new TrackingRangeRepository($pdo),
            new ShipmentPricingService(new PricingLookupRepository($pdo)),
        ),
        new IncidentCompensationValidator(),
    );

    $auth = new AuthMiddleware($pdo);
    $branchScope = new BranchScopeMiddleware($pdo);
    $idempotency = new IdempotencyMiddleware($pdo);

    // 1. CRUD Sự cố vận đơn (shipment_incidents)
    $router->get('/api/v1/shipment-incidents', [$controller, 'indexIncidents'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/shipment-incidents', [$controller, 'storeIncident'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.update_status'),
        $branchScope,
        $idempotency,
    ]);
    $router->get('/api/v1/shipment-incidents/{public_id}', [$controller, 'showIncident'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.read'),
        $branchScope,
    ]);
    $router->patch('/api/v1/shipment-incidents/{public_id}', [$controller, 'updateIncident'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.update_status'),
        $branchScope,
    ]);
    $router->delete('/api/v1/shipment-incidents/{public_id}', [$controller, 'destroyIncident'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.update_status'),
        $branchScope,
    ]);

    // 2. Điều phối danh sách chờ chuyển hoàn (pending_return)
    $router->get('/api/v1/shipment-returns/pending', [$controller, 'indexPendingReturns'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/shipments/{public_id}/return-process', [$controller, 'processReturn'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.update_status'),
        $branchScope,
        $idempotency,
    ]);

    // 3. Luồng phê duyệt yêu cầu hủy giao thành công (shipment_approval_requests)
    $router->get('/api/v1/shipment-approval-requests', [$controller, 'indexApprovalRequests'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/shipment-approval-requests', [$controller, 'storeApprovalRequest'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.update_status'),
        $branchScope,
        $idempotency,
    ]);
    $router->get('/api/v1/shipment-approval-requests/{public_id}', [$controller, 'showApprovalRequest'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.read'),
        $branchScope,
    ]);
    $router->post('/api/v1/shipment-approval-requests/{public_id}/review', [$controller, 'reviewApprovalRequest'], [
        $auth,
        new PermissionMiddleware($pdo, 'shipment.cancel'),
        $branchScope,
        $idempotency,
    ]);
};