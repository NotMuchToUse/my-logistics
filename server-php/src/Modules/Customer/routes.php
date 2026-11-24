<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\IdempotencyMiddleware;
use App\Modules\Customer\Controllers\CustomerPortalController;
use App\Modules\Customer\Controllers\PublicPortalController;
use App\Modules\Customer\Repositories\CustomerPortalRepository;
use App\Modules\Customer\Repositories\PublicPortalRepository;

return static function (Router $router): void {
    $pdo = Database::getConnection();
    $publicController = new PublicPortalController(new PublicPortalRepository($pdo));
    $customerController = new CustomerPortalController(new CustomerPortalRepository($pdo));
    $auth = new AuthMiddleware($pdo);
    $idempotency = new IdempotencyMiddleware($pdo);

    // Public APIs (không cần Bearer token)
    $router->get('/api/v1/public/tracking/{tracking_code}', [$publicController, 'tracking']);
    $router->get('/api/v1/public/branches', [$publicController, 'branches']);
    $router->post('/api/v1/public/calculate-rate', [$publicController, 'calculateRate']);

    // Customer Portal APIs (Bearer token khách hàng)
    $router->get('/api/v1/customer/addresses', [$customerController, 'listAddresses'], [$auth]);
    $router->post('/api/v1/customer/addresses', [$customerController, 'createAddress'], [$auth, $idempotency]);
    $router->put('/api/v1/customer/addresses/{public_id}', [$customerController, 'updateAddress'], [$auth]);
    $router->patch('/api/v1/customer/addresses/{public_id}', [$customerController, 'updateAddress'], [$auth]);
    $router->delete('/api/v1/customer/addresses/{public_id}', [$customerController, 'deleteAddress'], [$auth]);

    $router->get('/api/v1/customer/pickup-requests', [$customerController, 'indexPickupRequests'], [$auth]);
    $router->post('/api/v1/customer/pickup-requests', [$customerController, 'createPickupRequest'], [$auth, $idempotency]);
    $router->get('/api/v1/customer/pickup-requests/{public_id}', [$customerController, 'showPickupRequest'], [$auth]);
    $router->post('/api/v1/customer/pickup-requests/{public_id}/cancel', [$customerController, 'cancelPickupRequest'], [$auth]);
};