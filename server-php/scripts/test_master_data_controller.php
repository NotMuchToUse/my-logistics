<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($projectRoot): void {
    if (!str_starts_with($class, 'App\\')) {
        return;
    }

    $classPath = str_replace('\\', DIRECTORY_SEPARATOR, substr($class, 4));
    $filePath = $projectRoot . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . $classPath . '.php';
    if (is_file($filePath)) {
        require $filePath;
    }
});

use App\Core\ApiException;
use App\Core\Request;
use App\Modules\MasterData\Controllers\MasterDataController;
use App\Modules\MasterData\Repositories\MasterDataRepository;
use App\Modules\MasterData\Services\MasterDataService;
use App\Modules\MasterData\Validators\GeographyQueryValidator;
use App\Modules\MasterData\Validators\MasterDataWriteValidator;

function assertMasterDataController(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * @param array<string, mixed> $body
 * @param array<string, mixed> $attributes
 */
function masterDataRequest(
    string $method,
    array $query = [],
    array $body = [],
    array $attributes = [],
): Request {
    $request = new Request(
        $method,
        '/api/v1/master-data',
        $query,
        $body === [] ? '' : json_encode($body, JSON_THROW_ON_ERROR),
        [],
        [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'X-Client-Type' => 'web_internal',
        ],
        null,
        'MasterDataControllerTest/1.0',
    );
    foreach ($attributes as $name => $value) {
        $request->setAttribute($name, $value);
    }

    return $request;
}

try {
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE roles (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE)',
    );
    $pdo->exec(
        'CREATE TABLE user_has_roles (user_id INTEGER NOT NULL, role_id INTEGER NOT NULL)',
    );
    $pdo->exec("INSERT INTO roles VALUES (1, 'system_admin'), (2, 'coordinator')");
    $pdo->exec("INSERT INTO user_has_roles VALUES (1, 1), (2, 2)");
    $pdo->exec(
        'CREATE TABLE service_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            estimated_days_min INTEGER NOT NULL,
            estimated_days_max INTEGER NOT NULL,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        'CREATE TABLE value_added_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            fee_type TEXT NOT NULL,
            fee_value TEXT NOT NULL,
            min_fee TEXT NOT NULL,
            max_fee TEXT NOT NULL,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        'CREATE TABLE surcharges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            fee_type TEXT NOT NULL,
            fee_value TEXT NOT NULL,
            is_auto_applied INTEGER NOT NULL,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        'CREATE TABLE pricing_tariffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_type_id INTEGER NOT NULL,
            zone_type TEXT NOT NULL,
            min_weight_gram INTEGER NOT NULL,
            max_weight_gram INTEGER NOT NULL,
            base_price TEXT NOT NULL,
            step_weight_gram INTEGER NOT NULL,
            step_price TEXT NOT NULL,
            effective_from TEXT NOT NULL,
            effective_to TEXT,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        'CREATE TABLE weight_conversion_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_type_id INTEGER NOT NULL,
            divisor INTEGER NOT NULL,
            min_chargeable_gram INTEGER NOT NULL,
            effective_from TEXT NOT NULL,
            effective_to TEXT,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        "INSERT INTO service_types VALUES
            (1, 'EXPRESS', 'Hỏa tốc', 'Ưu tiên', 1, 1, 1)",
    );

    $controller = new MasterDataController(
        new MasterDataService(new MasterDataRepository($pdo)),
        new MasterDataWriteValidator(),
        new GeographyQueryValidator(),
    );
    $admin = ['auth' => ['user_id' => 1]];
    $nonAdmin = ['auth' => ['user_id' => 2]];

    $list = $controller->serviceTypes(masterDataRequest('GET', ['page' => '1', 'per_page' => '20']));
    $listPayload = json_decode($list->body(), true, 512, JSON_THROW_ON_ERROR);
    assertMasterDataController($list->statusCode() === 200, 'GET list did not return HTTP 200.');
    assertMasterDataController($listPayload['success'] === true, 'GET list envelope is invalid.');
    assertMasterDataController(count($listPayload['data']) === 1, 'GET list did not return seeded service.');

    $detail = $controller->serviceType(masterDataRequest(
        'GET',
        [],
        [],
        ['route_params' => ['id' => '1']],
    ));
    assertMasterDataController($detail->statusCode() === 200, 'GET detail did not return HTTP 200.');

    $created = $controller->createServiceType(masterDataRequest(
        'POST',
        [],
        [
            'code' => 'STANDARD',
            'name' => 'Nhanh',
            'description' => 'Dịch vụ tiêu chuẩn',
            'estimated_days_min' => 1,
            'estimated_days_max' => 2,
            'is_active' => true,
        ],
        $admin,
    ));
    assertMasterDataController($created->statusCode() === 201, 'POST did not return HTTP 201.');
    $createdPayload = json_decode($created->body(), true, 512, JSON_THROW_ON_ERROR);
    assertMasterDataController($createdPayload['data']['code'] === 'STANDARD', 'POST did not return created record.');

    $updated = $controller->updateServiceType(masterDataRequest(
        'PUT',
        [],
        [
            'code' => 'STANDARD',
            'name' => 'Nhanh cập nhật',
            'description' => 'Đã cập nhật',
            'estimated_days_min' => 1,
            'estimated_days_max' => 3,
            'is_active' => true,
        ],
        array_merge($admin, ['route_params' => ['id' => '2']]),
    ));
    assertMasterDataController($updated->statusCode() === 200, 'PUT did not return HTTP 200.');

    $deleted = $controller->deleteServiceType(masterDataRequest(
        'DELETE',
        [],
        [],
        array_merge($admin, ['route_params' => ['id' => '2']]),
    ));
    assertMasterDataController($deleted->statusCode() === 200, 'DELETE soft deactivation did not return HTTP 200.');

    $vas = $controller->createValueAddedService(masterDataRequest(
        'POST',
        [],
        [
            'code' => 'OPEN_CHECK',
            'name' => 'Đồng kiểm',
            'fee_type' => 'fixed',
            'fee_value' => 10000,
            'min_fee' => 10000,
            'max_fee' => 10000,
            'is_active' => true,
        ],
        $admin,
    ));
    assertMasterDataController($vas->statusCode() === 201, 'Value-added service POST failed.');

    $surcharge = $controller->createSurcharge(masterDataRequest(
        'POST',
        [],
        [
            'code' => 'FUEL',
            'name' => 'Phụ phí nhiên liệu',
            'fee_type' => 'percentage',
            'fee_value' => 5,
            'is_auto_applied' => true,
            'is_active' => true,
        ],
        $admin,
    ));
    assertMasterDataController($surcharge->statusCode() === 201, 'Surcharge POST failed.');

    $tariff = $controller->createPricingTariff(masterDataRequest(
        'POST',
        [],
        [
            'service_type_id' => 1,
            'zone_type' => 'intra_province',
            'min_weight_gram' => 0,
            'max_weight_gram' => 1000,
            'base_price' => 35000,
            'step_weight_gram' => 500,
            'step_price' => 5000,
            'effective_from' => '2026-01-01',
            'effective_to' => null,
            'is_active' => true,
        ],
        $admin,
    ));
    assertMasterDataController($tariff->statusCode() === 201, 'Pricing tariff POST failed.');

    $rule = $controller->createWeightConversionRule(masterDataRequest(
        'POST',
        [],
        [
            'service_type_id' => 1,
            'divisor' => 5000,
            'min_chargeable_gram' => 1000,
            'effective_from' => '2026-01-01',
            'effective_to' => null,
            'is_active' => true,
        ],
        $admin,
    ));
    assertMasterDataController($rule->statusCode() === 201, 'Weight conversion POST failed.');

    try {
        $controller->createServiceType(masterDataRequest(
            'POST',
            [],
            [
                'code' => 'ECONOMY',
                'name' => 'Tiết kiệm',
                'estimated_days_min' => 2,
                'estimated_days_max' => 4,
            ],
        ));
        throw new RuntimeException('Unauthenticated write was accepted.');
    } catch (ApiException $exception) {
        assertMasterDataController($exception->errorCode === '401_UNAUTHORIZED', 'Unauthenticated write returned wrong error.');
    }

    try {
        $controller->createServiceType(masterDataRequest(
            'POST',
            [],
            [
                'code' => 'ECONOMY',
                'name' => 'Tiết kiệm',
                'estimated_days_min' => 2,
                'estimated_days_max' => 4,
            ],
            $nonAdmin,
        ));
        throw new RuntimeException('Non-admin write was accepted.');
    } catch (ApiException $exception) {
        assertMasterDataController($exception->errorCode === '403_FORBIDDEN', 'Non-admin write returned wrong error.');
    }

    try {
        $controller->serviceType(masterDataRequest(
            'GET',
            [],
            [],
            ['route_params' => ['id' => '999999']],
        ));
        throw new RuntimeException('Missing master-data detail returned successfully.');
    } catch (ApiException $exception) {
        assertMasterDataController($exception->errorCode === '404_NOT_FOUND', 'Missing detail returned wrong error.');
    }

    echo "Master-data controller checks passed: list/detail envelope, POST/PUT/DELETE for catalog resources, 401/403/404 handling." . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, 'Master-data controller test failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
