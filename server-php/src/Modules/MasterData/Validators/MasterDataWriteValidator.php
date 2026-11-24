<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Validators;

use App\Core\ApiException;
use App\Modules\MasterData\DTOs\PricingTariffDto;
use App\Modules\MasterData\DTOs\ServiceTypeDto;
use App\Modules\MasterData\DTOs\SurchargeDto;
use App\Modules\MasterData\DTOs\ValueAddedServiceDto;
use App\Modules\MasterData\DTOs\WeightConversionRuleDto;

final class MasterDataWriteValidator
{
    public function serviceType(array $input): ServiceTypeDto
    {
        $errors = [];
        $code = $this->requiredCode($input['code'] ?? null, $errors, 'code');
        $name = $this->requiredText($input['name'] ?? null, 150, $errors, 'name');
        $description = $this->nullableText($input['description'] ?? null, 500, $errors, 'description');
        $minDays = $this->integerField($input['estimated_days_min'] ?? null, 0, null, $errors, 'estimated_days_min');
        $maxDays = $this->integerField($input['estimated_days_max'] ?? null, 0, null, $errors, 'estimated_days_max');
        $isActive = $this->booleanField($input['is_active'] ?? true, $errors, 'is_active');

        if ($minDays !== null && $maxDays !== null && $maxDays < $minDays) {
            $errors['estimated_days_max'][] = 'Số ngày tối đa không được nhỏ hơn số ngày tối thiểu.';
        }
        $this->throwValidation($errors);

        return new ServiceTypeDto(
            $code,
            $name,
            $description,
            $minDays,
            $maxDays,
            $isActive,
        );
    }

    public function valueAddedService(array $input): ValueAddedServiceDto
    {
        $errors = [];
        $code = $this->requiredCode($input['code'] ?? null, $errors, 'code');
        $name = $this->requiredText($input['name'] ?? null, 150, $errors, 'name');
        $feeType = $this->enumField($input['fee_type'] ?? null, ['fixed', 'percentage'], $errors, 'fee_type');
        $feeValue = $this->decimalField($input['fee_value'] ?? null, 0, null, $errors, 'fee_value');
        $minFee = $this->decimalField($input['min_fee'] ?? null, 0, null, $errors, 'min_fee');
        $maxFee = $this->decimalField($input['max_fee'] ?? null, 0, null, $errors, 'max_fee');
        $isActive = $this->booleanField($input['is_active'] ?? true, $errors, 'is_active');

        if ($feeValue !== null && $feeType === 'percentage' && (float) $feeValue > 100) {
            $errors['fee_value'][] = 'Tỷ lệ phần trăm không được vượt quá 100.';
        }
        if ($minFee !== null && $maxFee !== null && bccomp($minFee, $maxFee, 2) > 0) {
            $errors['max_fee'][] = 'Mức phí tối đa không được nhỏ hơn mức phí tối thiểu.';
        }
        $this->throwValidation($errors);

        return new ValueAddedServiceDto($code, $name, $feeType, $feeValue, $minFee, $maxFee, $isActive);
    }

    public function surcharge(array $input): SurchargeDto
    {
        $errors = [];
        $code = $this->requiredCode($input['code'] ?? null, $errors, 'code');
        $name = $this->requiredText($input['name'] ?? null, 150, $errors, 'name');
        $feeType = $this->enumField($input['fee_type'] ?? null, ['fixed', 'percentage'], $errors, 'fee_type');
        $feeValue = $this->decimalField($input['fee_value'] ?? null, 0, null, $errors, 'fee_value');
        $isAutoApplied = $this->booleanField($input['is_auto_applied'] ?? false, $errors, 'is_auto_applied');
        $isActive = $this->booleanField($input['is_active'] ?? true, $errors, 'is_active');

        if ($feeValue !== null && $feeType === 'percentage' && (float) $feeValue > 100) {
            $errors['fee_value'][] = 'Tỷ lệ phần trăm không được vượt quá 100.';
        }
        $this->throwValidation($errors);

        return new SurchargeDto($code, $name, $feeType, $feeValue, $isAutoApplied, $isActive);
    }

    public function pricingTariff(array $input): PricingTariffDto
    {
        $errors = [];
        $serviceTypeId = $this->integerField($input['service_type_id'] ?? null, 1, null, $errors, 'service_type_id');
        $zoneType = $this->enumField(
            $input['zone_type'] ?? null,
            ['intra_province', 'inter_region_near', 'inter_region_far'],
            $errors,
            'zone_type',
        );
        $minWeight = $this->integerField($input['min_weight_gram'] ?? null, 0, null, $errors, 'min_weight_gram');
        $maxWeight = $this->integerField($input['max_weight_gram'] ?? null, 1, null, $errors, 'max_weight_gram');
        $basePrice = $this->decimalField($input['base_price'] ?? null, 0, null, $errors, 'base_price');
        $stepWeight = $this->integerField($input['step_weight_gram'] ?? null, 1, null, $errors, 'step_weight_gram');
        $stepPrice = $this->decimalField($input['step_price'] ?? null, 0, null, $errors, 'step_price');
        $effectiveFrom = $this->requiredDate($input['effective_from'] ?? null, $errors, 'effective_from');
        $effectiveTo = $this->nullableDate($input['effective_to'] ?? null, $errors, 'effective_to');
        $isActive = $this->booleanField($input['is_active'] ?? true, $errors, 'is_active');

        if ($minWeight !== null && $maxWeight !== null && $maxWeight < $minWeight) {
            $errors['max_weight_gram'][] = 'Trọng lượng tối đa không được nhỏ hơn trọng lượng tối thiểu.';
        }
        if ($effectiveFrom !== null && $effectiveTo !== null && strcmp($effectiveTo, $effectiveFrom) < 0) {
            $errors['effective_to'][] = 'Ngày kết thúc không được trước ngày bắt đầu.';
        }
        $this->throwValidation($errors);

        return new PricingTariffDto(
            $serviceTypeId,
            $zoneType,
            $minWeight,
            $maxWeight,
            $basePrice,
            $stepWeight,
            $stepPrice,
            $effectiveFrom,
            $effectiveTo,
            $isActive,
        );
    }

    public function weightConversionRule(array $input): WeightConversionRuleDto
    {
        $errors = [];
        $serviceTypeId = $this->integerField($input['service_type_id'] ?? null, 1, null, $errors, 'service_type_id');
        $divisor = $this->integerField($input['divisor'] ?? null, 1, null, $errors, 'divisor');
        $minChargeable = $this->integerField(
            $input['min_chargeable_gram'] ?? null,
            1,
            null,
            $errors,
            'min_chargeable_gram',
        );
        $effectiveFrom = $this->requiredDate($input['effective_from'] ?? null, $errors, 'effective_from');
        $effectiveTo = $this->nullableDate($input['effective_to'] ?? null, $errors, 'effective_to');
        $isActive = $this->booleanField($input['is_active'] ?? true, $errors, 'is_active');

        if ($effectiveFrom !== null && $effectiveTo !== null && strcmp($effectiveTo, $effectiveFrom) < 0) {
            $errors['effective_to'][] = 'Ngày kết thúc không được trước ngày bắt đầu.';
        }
        $this->throwValidation($errors);

        return new WeightConversionRuleDto(
            $serviceTypeId,
            $divisor,
            $minChargeable,
            $effectiveFrom,
            $effectiveTo,
            $isActive,
        );
    }

    /**
     * @param array<string, array<int, string>> $errors
     */
    private function throwValidation(array $errors): void
    {
        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu danh mục không hợp lệ.', $errors);
        }
    }

    private function requiredCode(mixed $value, array &$errors, string $field): string
    {
        if (!is_string($value) || preg_match('/^[A-Z0-9_]{2,50}$/', trim($value)) !== 1) {
            $errors[$field][] = 'Mã danh mục phải gồm 2–50 ký tự IN HOA, số và dấu gạch dưới.';
            return '';
        }

        return trim($value);
    }

    private function requiredText(mixed $value, int $maxLength, array &$errors, string $field): string
    {
        if (!is_string($value) || trim($value) === '' || mb_strlen(trim($value)) > $maxLength) {
            $errors[$field][] = 'Trường bắt buộc và không vượt quá ' . $maxLength . ' ký tự.';
            return '';
        }

        return trim($value);
    }

    private function nullableText(mixed $value, int $maxLength, array &$errors, string $field): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_string($value) || mb_strlen(trim($value)) > $maxLength) {
            $errors[$field][] = 'Nội dung không vượt quá ' . $maxLength . ' ký tự.';
            return null;
        }

        return trim($value);
    }

    private function enumField(mixed $value, array $allowed, array &$errors, string $field): string
    {
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            $errors[$field][] = 'Giá trị không nằm trong danh sách cho phép.';
            return '';
        }

        return $value;
    }

    private function integerField(
        mixed $value,
        int $min,
        ?int $max,
        array &$errors,
        string $field,
    ): ?int {
        if ($value === null || $value === '') {
            $errors[$field][] = 'Trường này là bắt buộc.';
            return null;
        }

        $validated = filter_var($value, FILTER_VALIDATE_INT);
        if ($validated === false || $validated < $min || ($max !== null && $validated > $max)) {
            $errors[$field][] = 'Giá trị phải là số nguyên trong phạm vi cho phép.';
            return null;
        }

        return $validated;
    }

    private function decimalField(
        mixed $value,
        string|int $min,
        string|int|null $max,
        array &$errors,
        string $field,
    ): ?string {
        if ($value === null || $value === '') {
            $errors[$field][] = 'Trường này là bắt buộc.';
            return null;
        }
        if (!is_int($value) && !is_float($value) && !is_string($value)) {
            $errors[$field][] = 'Giá trị tiền phải là số.';
            return null;
        }

        $normalized = number_format((float) $value, 2, '.', '');
        $minimum = (string) $min;
        $maximum = $max === null ? null : (string) $max;
        if (bccomp($normalized, $minimum, 2) < 0 || ($maximum !== null && bccomp($normalized, $maximum, 2) > 0)) {
            $errors[$field][] = 'Giá trị tiền nằm ngoài phạm vi cho phép.';
            return null;
        }

        return $normalized;
    }

    private function booleanField(mixed $value, array &$errors, string $field): bool
    {
        if (is_bool($value) || (is_int($value) && in_array($value, [0, 1], true))) {
            return is_bool($value) ? $value : $value === 1;
        }
        $errors[$field][] = 'Giá trị phải là true/false hoặc 0/1.';
        return false;
    }

    private function requiredDate(mixed $value, array &$errors, string $field): ?string
    {
        $date = $this->dateValue($value);
        if ($date === null) {
            $errors[$field][] = 'Ngày phải đúng định dạng YYYY-MM-DD.';
        }

        return $date;
    }

    private function nullableDate(mixed $value, array &$errors, string $field): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $date = $this->dateValue($value);
        if ($date === null) {
            $errors[$field][] = 'Ngày phải đúng định dạng YYYY-MM-DD.';
        }

        return $date;
    }

    private function dateValue(mixed $value): ?string
    {
        if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            return null;
        }

        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = \DateTimeImmutable::getLastErrors();
        if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            return null;
        }

        return $date->format('Y-m-d') === $value ? $value : null;
    }
}
