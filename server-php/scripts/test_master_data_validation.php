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
use App\Modules\MasterData\Validators\MasterDataWriteValidator;

function assertMasterDataValidation(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $validator = new MasterDataWriteValidator();

    $serviceType = $validator->serviceType([
        'code' => 'EXPRESS',
        'name' => 'Hỏa tốc',
        'description' => 'Dịch vụ ưu tiên',
        'estimated_days_min' => 1,
        'estimated_days_max' => 1,
        'is_active' => true,
    ]);
    assertMasterDataValidation($serviceType->code === 'EXPRESS', 'Valid service type was rejected.');

    $vas = $validator->valueAddedService([
        'code' => 'DECLARED_VALUE_INSURANCE',
        'name' => 'Bảo hiểm khai giá',
        'fee_type' => 'percentage',
        'fee_value' => 0.5,
        'min_fee' => 5000,
        'max_fee' => 500000,
        'is_active' => true,
    ]);
    assertMasterDataValidation($vas->feeValue === '0.50', 'Valid value-added service was rejected.');

    $surcharge = $validator->surcharge([
        'code' => 'FUEL',
        'name' => 'Phụ phí nhiên liệu',
        'fee_type' => 'percentage',
        'fee_value' => 5,
        'is_auto_applied' => true,
        'is_active' => true,
    ]);
    assertMasterDataValidation($surcharge->isAutoApplied, 'Valid surcharge was rejected.');

    $tariff = $validator->pricingTariff([
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
    ]);
    assertMasterDataValidation($tariff->basePrice === '35000.00', 'Valid tariff was rejected.');

    $rule = $validator->weightConversionRule([
        'service_type_id' => 1,
        'divisor' => 5000,
        'min_chargeable_gram' => 1000,
        'effective_from' => '2026-01-01',
        'effective_to' => null,
        'is_active' => true,
    ]);
    assertMasterDataValidation($rule->divisor === 5000, 'Valid conversion rule was rejected.');

    $invalidCases = [
        static fn () => $validator->serviceType([
            'code' => 'bad-code',
            'name' => '',
            'estimated_days_min' => -1,
            'estimated_days_max' => 0,
        ]),
        static fn () => $validator->valueAddedService([
            'code' => 'VAT',
            'name' => 'VAT',
            'fee_type' => 'percentage',
            'fee_value' => 101,
            'min_fee' => 1,
            'max_fee' => 0,
        ]),
        static fn () => $validator->pricingTariff([
            'service_type_id' => 0,
            'zone_type' => 'unknown',
            'min_weight_gram' => 1000,
            'max_weight_gram' => 500,
            'base_price' => -1,
            'step_weight_gram' => 0,
            'step_price' => -1,
            'effective_from' => '2026-02-30',
        ]),
    ];

    foreach ($invalidCases as $invalidCase) {
        try {
            $invalidCase();
            throw new RuntimeException('Invalid master-data payload was accepted.');
        } catch (ApiException $exception) {
            assertMasterDataValidation(
                $exception->errorCode === '422_VALIDATION_ERROR',
                'Invalid payload returned the wrong error code.',
            );
        }
    }

    echo "Master-data validation checks passed: 5 valid DTO payloads and 3 invalid payload groups." . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, 'Master-data validation checks failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
