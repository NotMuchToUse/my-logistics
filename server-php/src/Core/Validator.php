<?php

declare(strict_types=1);

namespace App\Core;

use DateTimeImmutable;
use Throwable;

final class Validator
{
    /**
     * @param array<string, mixed> $input
     * @param array<string, array<string, mixed>> $rules
     * @return array<string, mixed>
     */
    public function validate(array $input, array $rules): array
    {
        $errors = [];
        $validated = [];

        foreach ($rules as $field => $fieldRules) {
            $value = $input[$field] ?? null;
            $isPresent = array_key_exists($field, $input);
            $isRequired = in_array('required', $fieldRules, true) || array_key_exists('required', $fieldRules);

            if ($isRequired && (!$isPresent || $value === null || $value === '')) {
                $errors[$field][] = 'Trường này là bắt buộc.';
                continue;
            }

            if (!$isPresent || $value === null || $value === '') {
                continue;
            }

            foreach ($fieldRules as $rule => $options) {
                if (is_int($rule)) {
                    $rule = (string) $options;
                    $options = null;
                }

                if ($rule === 'required') {
                    continue;
                }

                $message = $this->validateRule($rule, $value, $options);
                if ($message !== null) {
                    $errors[$field][] = $message;
                }
            }

            if (!isset($errors[$field])) {
                $validated[$field] = $value;
            }
        }

        if ($errors !== []) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Dữ liệu đầu vào không hợp lệ.',
                $errors,
            );
        }

        return $validated;
    }

    private function validateRule(string $rule, mixed $value, mixed $options): ?string
    {
        return match ($rule) {
            'string' => is_string($value) ? null : 'Giá trị phải là chuỗi.',
            'int' => filter_var($value, FILTER_VALIDATE_INT) !== false ? null : 'Giá trị phải là số nguyên.',
            'numeric' => is_numeric($value) ? null : 'Giá trị phải là số.',
            'email' => is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false
                ? null
                : 'Địa chỉ email không hợp lệ.',
            'vn_phone' => $this->isVietnamesePhone($value) ? null : 'Số điện thoại Việt Nam không hợp lệ.',
            'in_enum' => $this->isInEnum($value, $options) ? null : 'Giá trị không nằm trong danh sách cho phép.',
            'ulid' => $this->isUlid($value) ? null : 'Mã ULID không hợp lệ.',
            'date' => $this->isDate($value) ? null : 'Ngày không hợp lệ, định dạng yêu cầu YYYY-MM-DD.',
            default => throw new ApiException('500_INTERNAL_ERROR', 'Quy tắc kiểm tra dữ liệu không được hỗ trợ.'),
        };
    }

    private function isVietnamesePhone(mixed $value): bool
    {
        if (!is_string($value)) {
            return false;
        }

        $digits = preg_replace('/\D+/', '', $value) ?? '';
        if (str_starts_with($digits, '84')) {
            $digits = '0' . substr($digits, 2);
        }

        return preg_match('/^0[0-9]{9,10}$/', $digits) === 1;
    }

    private function isInEnum(mixed $value, mixed $options): bool
    {
        return is_array($options) && in_array($value, $options, true);
    }

    private function isUlid(mixed $value): bool
    {
        return is_string($value)
            && preg_match('/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/', strtoupper($value)) === 1;
    }

    private function isDate(mixed $value): bool
    {
        if (!is_string($value)) {
            return false;
        }

        try {
            $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
            $errors = DateTimeImmutable::getLastErrors();
        } catch (Throwable) {
            return false;
        }

        return $date !== false
            && $date->format('Y-m-d') === $value
            && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0));
    }
}
