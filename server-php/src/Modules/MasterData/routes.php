<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Router;
use App\Modules\MasterData\Controllers\GeographyController;
use App\Modules\MasterData\Controllers\MasterDataController;
use App\Modules\MasterData\Repositories\GeographyRepository;
use App\Modules\MasterData\Repositories\MasterDataRepository;
use App\Modules\MasterData\Services\GeographyService;
use App\Modules\MasterData\Services\MasterDataService;
use App\Modules\MasterData\Validators\GeographyQueryValidator;
use App\Modules\MasterData\Validators\MasterDataWriteValidator;
use App\Middleware\AuthMiddleware;
use App\Middleware\IdempotencyMiddleware;

return static function (Router $router): void {
    $controller = new GeographyController(
        new GeographyService(new GeographyRepository(Database::getConnection())),
        new GeographyQueryValidator(),
    );
    $pdo = Database::getConnection();
    $authMiddleware = new AuthMiddleware($pdo);
    $masterDataController = new MasterDataController(
        new MasterDataService(new MasterDataRepository($pdo)),
        new MasterDataWriteValidator(),
        new GeographyQueryValidator(),
    );

    $router->get('/api/v1/public/provinces', [$controller, 'provinces']);
    $router->get('/api/v1/public/provinces/{id}', [$controller, 'province']);
    $router->get('/api/v1/public/districts', [$controller, 'districts']);
    $router->get('/api/v1/public/districts/{id}', [$controller, 'district']);
    $router->get('/api/v1/public/wards', [$controller, 'wards']);
    $router->get('/api/v1/public/wards/{id}', [$controller, 'ward']);

    $router->get('/api/v1/master-data/service-types', [$masterDataController, 'serviceTypes']);
    $router->get('/api/v1/master-data/service-types/{id}', [$masterDataController, 'serviceType']);
    $router->post('/api/v1/master-data/service-types', [$masterDataController, 'createServiceType'], [$authMiddleware, new IdempotencyMiddleware($pdo)]);
    $router->put('/api/v1/master-data/service-types/{id}', [$masterDataController, 'updateServiceType'], [$authMiddleware]);
    $router->delete('/api/v1/master-data/service-types/{id}', [$masterDataController, 'deleteServiceType'], [$authMiddleware]);

    $router->get('/api/v1/master-data/value-added-services', [$masterDataController, 'valueAddedServices']);
    $router->get('/api/v1/master-data/value-added-services/{id}', [$masterDataController, 'valueAddedService']);
    $router->post('/api/v1/master-data/value-added-services', [$masterDataController, 'createValueAddedService'], [$authMiddleware, new IdempotencyMiddleware($pdo)]);
    $router->put('/api/v1/master-data/value-added-services/{id}', [$masterDataController, 'updateValueAddedService'], [$authMiddleware]);
    $router->delete('/api/v1/master-data/value-added-services/{id}', [$masterDataController, 'deleteValueAddedService'], [$authMiddleware]);

    $router->get('/api/v1/master-data/surcharges', [$masterDataController, 'surcharges']);
    $router->get('/api/v1/master-data/surcharges/{id}', [$masterDataController, 'surcharge']);
    $router->post('/api/v1/master-data/surcharges', [$masterDataController, 'createSurcharge'], [$authMiddleware, new IdempotencyMiddleware($pdo)]);
    $router->put('/api/v1/master-data/surcharges/{id}', [$masterDataController, 'updateSurcharge'], [$authMiddleware]);
    $router->delete('/api/v1/master-data/surcharges/{id}', [$masterDataController, 'deleteSurcharge'], [$authMiddleware]);

    $router->get('/api/v1/master-data/pricing-tariffs', [$masterDataController, 'pricingTariffs']);
    $router->get('/api/v1/master-data/pricing-tariffs/{id}', [$masterDataController, 'pricingTariff']);
    $router->post('/api/v1/master-data/pricing-tariffs', [$masterDataController, 'createPricingTariff'], [$authMiddleware, new IdempotencyMiddleware($pdo)]);
    $router->put('/api/v1/master-data/pricing-tariffs/{id}', [$masterDataController, 'updatePricingTariff'], [$authMiddleware]);
    $router->delete('/api/v1/master-data/pricing-tariffs/{id}', [$masterDataController, 'deletePricingTariff'], [$authMiddleware]);

    $router->get('/api/v1/master-data/weight-conversion-rules', [$masterDataController, 'weightConversionRules']);
    $router->get('/api/v1/master-data/weight-conversion-rules/{id}', [$masterDataController, 'weightConversionRule']);
    $router->post('/api/v1/master-data/weight-conversion-rules', [$masterDataController, 'createWeightConversionRule'], [$authMiddleware, new IdempotencyMiddleware($pdo)]);
    $router->put('/api/v1/master-data/weight-conversion-rules/{id}', [$masterDataController, 'updateWeightConversionRule'], [$authMiddleware]);
    $router->delete('/api/v1/master-data/weight-conversion-rules/{id}', [$masterDataController, 'deleteWeightConversionRule'], [$authMiddleware]);
};
