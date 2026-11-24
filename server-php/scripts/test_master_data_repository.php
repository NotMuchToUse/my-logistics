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
use App\Modules\MasterData\DTOs\PricingTariffDto;
use App\Modules\MasterData\DTOs\ServiceTypeDto;
use App\Modules\MasterData\DTOs\SurchargeDto;
use App\Modules\MasterData\DTOs\ValueAddedServiceDto;
use App\Modules\MasterData\DTOs\WeightConversionRuleDto;
use App\Modules\MasterData\Repositories\MasterDataRepository;
use App\Modules\MasterData\Services\MasterDataService;

function assertMasterDataRepository(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
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

    $repository = new MasterDataRepository($pdo);

    $serviceTypeId = $repository->createServiceType(new ServiceTypeDto(
        'EXPRESS',
        'Hỏa tốc',
        'Dịch vụ ưu tiên',
        1,
        1,
        true,
    ));
    assertMasterDataRepository($repository->findServiceType($serviceTypeId) !== null, 'Service type was not created.');

    $vasId = $repository->createValueAddedService(new ValueAddedServiceDto(
        'DECLARED_VALUE_INSURANCE',
        'Bảo hiểm khai giá',
        'percentage',
        '0.50',
        '5000.00',
        '500000.00',
        true,
    ));
    assertMasterDataRepository($repository->findValueAddedService($vasId) !== null, 'Value-added service was not created.');

    $surchargeId = $repository->createSurcharge(new SurchargeDto(
        'FUEL',
        'Phụ phí nhiên liệu',
        'percentage',
        '5.00',
        true,
        true,
    ));
    assertMasterDataRepository($repository->findSurcharge($surchargeId) !== null, 'Surcharge was not created.');

    $tariffId = $repository->createPricingTariff(new PricingTariffDto(
        $serviceTypeId,
        'intra_province',
        0,
        1000,
        '35000.00',
        500,
        '5000.00',
        '2026-01-01',
        null,
        true,
    ));
    assertMasterDataRepository($repository->findPricingTariff($tariffId) !== null, 'Pricing tariff was not created.');

    $ruleId = $repository->createWeightConversionRule(new WeightConversionRuleDto(
        $serviceTypeId,
        5000,
        1000,
        '2026-01-01',
        null,
        true,
    ));
    assertMasterDataRepository($repository->findWeightConversionRule($ruleId) !== null, 'Weight rule was not created.');

    $repository->updateServiceType($serviceTypeId, new ServiceTypeDto(
        'EXPRESS',
        'Hỏa tốc cập nhật',
        'Dịch vụ ưu tiên đã cập nhật',
        1,
        2,
        true,
    ));
    assertMasterDataRepository(
        $repository->findServiceType($serviceTypeId)['name'] === 'Hỏa tốc cập nhật',
        'Service type update was not persisted.',
    );

    $repository->softDelete('service_types', $serviceTypeId);
    assertMasterDataRepository($repository->findServiceType($serviceTypeId) === null, 'Soft delete did not deactivate record.');
    assertMasterDataRepository($repository->paginateServiceTypes(1, 20, null)['total'] === 0, 'Deleted record remained in list.');

    $service = new MasterDataService($repository);
    try {
        $service->findServiceType($serviceTypeId);
        throw new RuntimeException('Service layer returned an inactive service type.');
    } catch (ApiException $exception) {
        assertMasterDataRepository(
            $exception->errorCode === '404_NOT_FOUND',
            'Service layer returned the wrong missing-record error.',
        );
    }

    try {
        $repository->createServiceType(new ServiceTypeDto(
            'EXPRESS',
            'Trùng mã',
            null,
            1,
            1,
            true,
        ));
        throw new RuntimeException('Duplicate service type code was accepted.');
    } catch (ApiException $exception) {
        assertMasterDataRepository(
            $exception->errorCode === '422_VALIDATION_ERROR',
            'Duplicate code returned the wrong error.',
        );
    }

    echo "Master-data repository checks passed: create/find/update/soft-delete for 5 resources, pagination and duplicate code." . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, 'Master-data repository test failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
