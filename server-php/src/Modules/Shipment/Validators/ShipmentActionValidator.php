<?php

declare(strict_types=1);

namespace App\Modules\Shipment\Validators;

use App\Core\ApiException;

final class ShipmentActionValidator
{
    private const PRINT_DOCUMENT_TYPES = [
        'waybill_a4',
        'waybill_label',
        'barcode_sticker',
        'delivery_manifest',
        'outbound_manifest',
        'collection_receipt',
    ];

    /**
     * @param array<string, mixed> $input
     * @return array{version: int, is_priority: bool}
     */
    public function validatePriority(array $input): array
    {
        $version = $this->validateVersion($input);
        $priority = $input['is_priority'] ?? null;
        if (!is_bool($priority) && !in_array($priority, [0, 1], true)) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Dữ liệu đánh dấu ưu tiên không hợp lệ.',
                ['is_priority' => ['Giá trị phải là boolean.']],
            );
        }

        return [
            'version' => $version,
            'is_priority' => $priority === true || $priority === 1,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array{version: int, cancel_reason: string|null}
     */
    public function validateCancellation(array $input): array
    {
        $version = $this->validateVersion($input);
        $reason = $input['cancel_reason'] ?? null;
        if ($reason !== null && (!is_string($reason) || mb_strlen($reason, 'UTF-8') > 500)) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Lý do hủy vận đơn không hợp lệ.',
                ['cancel_reason' => ['Lý do hủy tối đa 500 ký tự.']],
            );
        }

        return [
            'version' => $version,
            'cancel_reason' => $reason === null ? null : trim($reason),
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array{document_type: string, print_count: int}
     */
    public function validatePrintLog(array $input): array
    {
        $documentType = $input['document_type'] ?? null;
        $printCount = filter_var($input['print_count'] ?? 1, FILTER_VALIDATE_INT);
        $errors = [];

        if (!is_string($documentType) || !in_array($documentType, self::PRINT_DOCUMENT_TYPES, true)) {
            $errors['document_type'][] = 'Loại chứng từ in không hợp lệ.';
        }
        if ($printCount === false || $printCount < 1 || $printCount > 100) {
            $errors['print_count'][] = 'Số bản in phải nằm trong khoảng 1 đến 100.';
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dữ liệu lịch sử in không hợp lệ.', $errors);
        }

        return [
            'document_type' => $documentType,
            'print_count' => $printCount,
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array{
     *     recipient_name: string,
     *     recipient_phone: string,
     *     recipient_address: string,
     *     recipient_province_id: int,
     *     recipient_district_id: int,
     *     recipient_ward_id: int,
     *     destination_branch_id: int
     * }
     */
    public function validateForward(array $input): array
    {
        $errors = [];
        $strings = [];
        foreach (['recipient_name' => 150, 'recipient_phone' => 20, 'recipient_address' => 255] as $field => $maxLength) {
            $value = $input[$field] ?? null;
            if (!is_string($value) || trim($value) === '') {
                $errors[$field][] = 'Trường này là bắt buộc và phải là chuỗi.';
                continue;
            }
            if (mb_strlen(trim($value), 'UTF-8') > $maxLength) {
                $errors[$field][] = 'Độ dài vượt quá giới hạn cho phép.';
                continue;
            }
            $strings[$field] = trim($value);
        }

        if (isset($strings['recipient_phone']) && !$this->isVietnamesePhone($strings['recipient_phone'])) {
            $errors['recipient_phone'][] = 'Số điện thoại Việt Nam không hợp lệ.';
        }

        $integers = [];
        foreach (['recipient_province_id', 'recipient_district_id', 'recipient_ward_id', 'destination_branch_id'] as $field) {
            $value = filter_var($input[$field] ?? null, FILTER_VALIDATE_INT);
            if ($value === false || $value < 1) {
                $errors[$field][] = 'Giá trị phải là số nguyên dương.';
                continue;
            }
            $integers[$field] = $value;
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Thông tin chuyển tiếp vận đơn không hợp lệ.', $errors);
        }

        return [
            'recipient_name' => $strings['recipient_name'],
            'recipient_phone' => $strings['recipient_phone'],
            'recipient_address' => $strings['recipient_address'],
            'recipient_province_id' => $integers['recipient_province_id'],
            'recipient_district_id' => $integers['recipient_district_id'],
            'recipient_ward_id' => $integers['recipient_ward_id'],
            'destination_branch_id' => $integers['destination_branch_id'],
        ];
    }

    /**
     * @param array<string, mixed> $input
     */
    public function validateVersion(array $input): int
    {
        $version = filter_var($input['version'] ?? null, FILTER_VALIDATE_INT);
        if ($version === false || $version < 1) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Version vận đơn không hợp lệ.',
                ['version' => ['Version phải là số nguyên dương.']],
            );
        }

        return $version;
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
