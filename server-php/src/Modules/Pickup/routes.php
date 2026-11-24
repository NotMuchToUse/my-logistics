<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\BranchScopeMiddleware;
use App\Middleware\IdempotencyMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Modules\Pickup\Controllers\PickupDispatchController;
use App\Modules\Pickup\Repositories\PickupRepository;

return static function (Router $router): void {
    $pdo = Database::getConnection();
    $controller = new PickupDispatchController(new PickupRepository($pdo));
    $auth = new AuthMiddleware($pdo);
    $branchScope = new BranchScopeMiddleware($pdo);
    $idempotency = new IdempotencyMiddleware($pdo);

    $router->get('/api/v1/pickup-requests', [$controller, 'index'], [$auth, new PermissionMiddleware($pdo, 'pickup.read'), $branchScope]);
    $router->post('/api/v1/pickup-requests', [$controller, 'store'], [$auth, new PermissionMiddleware($pdo, 'pickup.assign'), $branchScope, $idempotency]);
    $router->get('/api/v1/pickup-requests/drivers/available', [$controller, 'availableDrivers'], [$auth, new PermissionMiddleware($pdo, 'pickup.assign'), $branchScope]);
    $router->get('/api/v1/pickup-requests/{public_id}', [$controller, 'show'], [$auth, new PermissionMiddleware($pdo, 'pickup.read'), $branchScope]);
    $router->patch('/api/v1/pickup-requests/{public_id}/assign', [$controller, 'assignDriver'], [$auth, new PermissionMiddleware($pdo, 'pickup.assign'), $branchScope, $idempotency]);
    $router->post('/api/v1/pickup-requests/{public_id}/assign-driver', [$controller, 'assignDriver'], [$auth, new PermissionMiddleware($pdo, 'pickup.assign'), $branchScope, $idempotency]);
    $router->post('/api/v1/pickup-requests/{public_id}/cancel', [$controller, 'cancel'], [$auth, new PermissionMiddleware($pdo, 'pickup.cancel'), $branchScope, $idempotency]);
};