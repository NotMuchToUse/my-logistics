<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Validators;

use App\Core\ApiException;
use App\Modules\Shipment\DTOs\CreateShipmentDto;

final class CreateShipmentValidator
{
    private const PAYMENT_METHODS = ['ngttn', 'ngtts', 'nntn'];
    private const CREATION_MODES = ['counter_dropoff', 'driver_pickup'];

    /**
     * @param array<string, mixed> $input
     */
    public function validate(array $input): CreateShipmentDto
    {
        $errors = [];
        $requiredStrings = [
            'sender_name' => 150,
            'sender_phone' => 20,
            'sender_address' => 255,
            'recipient_name' => 150,
            'recipient_phone' => 20,
            'recipient_address' => 255,
            'payment_method' => 20,
        ];
        $strings = [];

        foreach ($requiredStrings as $field => $maximumLength) {
            $value = $input[$field] ?? null;
            if (!is_string($value) || trim($value) === '') {
                $errors[$field][] = 'Trường này là bắt buộc và phải là chuỗi.';
                continue;
            }

            if (mb_strlen(trim($value), 'UTF-8') > $maximumLength) {
                $errors[$field][] = 'Độ dài vượt quá giới hạn cho phép.';
                continue;
            }

            $strings[$field] = trim($value);
        }

        foreach (['sender_phone', 'recipient_phone'] as $field) {
            if (isset($strings[$field]) && !$this->isVietnamesePhone($strings[$field])) {
                $errors[$field][] = 'Số điện thoại Việt Nam không hợp lệ.';
            }
        }

        if (
            isset($strings['payment_method'])
            && !in_array($strings['payment_method'], self::PAYMENT_METHODS, true)
        ) {
            $errors['payment_method'][] = 'Hình thức thanh toán không hợp lệ.';
        }

        $integerFields = [
            'sender_province_id',
            'sender_district_id',
            'sender_ward_id',
            'recipient_province_id',
            'recipient_district_id',
            'recipient_ward_id',
            'destination_branch_id',
            'service_type_id',
            'cargo_category_id',
        ];
        $integers = [];
        foreach ($integerFields as $field) {
            $value = $input[$field] ?? null;
            $integer = filter_var($value, FILTER_VALIDATE_INT);
            if ($integer === false || $integer < 1) {
                $errors[$field][] = 'Giá trị phải là số nguyên dương.';
                continue;
            }

            $integers[$field] = $integer;
        }

        $codAmount = $this->decimalAmount($input['cod_amount'] ?? null, 'cod_amount', $errors);
        $declaredValue = $this->decimalAmount($input['declared_value'] ?? null, 'declared_value', $errors);
        $creationMode = $input['creation_mode'] ?? null;
        if (!is_string($creationMode) || !in_array($creationMode, self::CREATION_MODES, true)) {
            $errors['creation_mode'][] = 'Chế độ tạo vận đơn không hợp lệ.';
            $creationMode = 'driver_pickup';
        }
        $parcels = $this->validateParcels($input['parcels'] ?? null, $errors);
        $vasIds = $this->validateIdList($input['vas_ids'] ?? [], 'vas_ids', $errors);
        $surchargeIds = $this->validateIdList($input['surcharge_ids'] ?? [], 'surcharge_ids', $errors);

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu tạo vận đơn không hợp lệ.', $errors);
        }

        return new CreateShipmentDto(
            $strings['sender_name'],
            $strings['sender_phone'],
            $strings['sender_address'],
            $integers['sender_province_id'],
            $integers['sender_district_id'],
            $integers['sender_ward_id'],
            $strings['recipient_name'],
            $strings['recipient_phone'],
            $strings['recipient_address'],
            $integers['recipient_province_id'],
            $integers['recipient_district_id'],
            $integers['recipient_ward_id'],
            $integers['destination_branch_id'],
            $integers['service_type_id'],
            $integers['cargo_category_id'],
            $strings['payment_method'],
            $codAmount,
            $declaredValue,
            $creationMode,
            $parcels,
            $vasIds,
            $surchargeIds,
        );
    }

    /**
     * @param array<string, list<string>> $errors
     */
    private function decimalAmount(mixed $value, string $field, array &$errors): string
    {
        if (!is_string($value) && !is_int($value) && !is_float($value)) {
            $errors[$field][] = 'Giá trị phải là số không âm.';
            return '0.00';
        }

        $decimal = trim((string) $value);
        if (preg_match('/^\d{1,13}(?:\.\d{1,2})?$/', $decimal) !== 1) {
            $errors[$field][] = 'Giá trị phải là số không âm với tối đa 2 chữ số thập phân.';
            return '0.00';
        }

        [$integerPart, $fractionalPart] = array_pad(explode('.', $decimal, 2), 2, '0');
        return $integerPart . '.' . str_pad($fractionalPart, 2, '0');
    }

    /**
     * @param array<string, list<string>> $errors
     * @return list<array{
     *     actual_weight_gram: int,
     *     length_cm: string,
     *     width_cm: string,
     *     height_cm: string,
     *     description: string|null
     * }>
     */
    private function validateParcels(mixed $value, array &$errors): array
    {
        if (!is_array($value) || !array_is_list($value) || $value === []) {
            $errors['parcels'][] = 'Phải có ít nhất một kiện hàng.';
            return [];
        }

        $parcels = [];
        foreach ($value as $index => $parcel) {
            $prefix = 'parcels.' . $index;
            if (!is_array($parcel)) {
                $errors[$prefix][] = 'Thông tin kiện hàng không hợp lệ.';
                continue;
            }

            $weight = filter_var($parcel['actual_weight_gram'] ?? null, FILTER_VALIDATE_INT);
            if ($weight === false || $weight < 1) {
                $errors[$prefix . '.actual_weight_gram'][] = 'Trọng lượng thực phải là số nguyên dương (gram).';
            }

            $dimensions = [];
            foreach (['length_cm', 'width_cm', 'height_cm'] as $dimension) {
                $dimensionValue = $parcel[$dimension] ?? null;
                if (
                    (!is_string($dimensionValue) && !is_int($dimensionValue) && !is_float($dimensionValue))
                    || preg_match('/^\d{1,6}(?:\.\d{1,2})?$/', (string) $dimensionValue) !== 1
                    || (float) $dimensionValue <= 0
                ) {
                    $errors[$prefix . '.' . $dimension][] = 'Kích thước phải là số dương, tối đa 2 chữ số thập phân.';
                    continue;
                }

                $dimensions[$dimension] = number_format((float) $dimensionValue, 2, '.', '');
            }

            $description = $parcel['description'] ?? null;
            if ($description !== null && (!is_string($description) || mb_strlen($description, 'UTF-8') > 255)) {
                $errors[$prefix . '.description'][] = 'Mô tả kiện hàng không hợp lệ hoặc vượt quá 255 ký tự.';
            }

            if (
                $weight !== false
                && $weight > 0
                && count($dimensions) === 3
                && ($description === null || is_string($description))
            ) {
                $parcels[] = [
                    'actual_weight_gram' => $weight,
                    'length_cm' => $dimensions['length_cm'],
                    'width_cm' => $dimensions['width_cm'],
                    'height_cm' => $dimensions['height_cm'],
                    'description' => $description,
                ];
            }
        }

        return $parcels;
    }

    /**
     * @param array<string, list<string>> $errors
     * @return list<int>
     */
    private function validateIdList(mixed $value, string $field, array &$errors): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            $errors[$field][] = 'Giá trị phải là danh sách ID.';
            return [];
        }

        $ids = [];
        foreach ($value as $index => $item) {
            $id = filter_var($item, FILTER_VALIDATE_INT);
            if ($id === false || $id < 1) {
                $errors[$field . '.' . $index][] = 'ID phải là số nguyên dương.';
                continue;
            }
            $ids[$id] = $id;
        }

        return array_values($ids);
    }

    private function isVietnamesePhone(string $phone): bool
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '84')) {
            $digits = '0' . substr($digits, 2);
        }

        return preg_match('/^0[0-9]{9,10}$/', $digits) === 1;
    }
}
