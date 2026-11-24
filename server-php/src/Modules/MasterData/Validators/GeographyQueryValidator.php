<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Validators;

use App\Core\ApiException;
use App\Modules\MasterData\DTOs\GeographyListQueryDto;

final class GeographyQueryValidator
{
    /**
     * @param array<string, mixed> $query
     */
    public function validateList(array $query, ?string $parentField): GeographyListQueryDto
    {
        $errors = [];
        $page = $this->positiveInteger($query['page'] ?? 1, 'page', $errors);
        $perPage = $this->positiveInteger($query['per_page'] ?? 20, 'per_page', $errors);
        if ($perPage > 100) {
            $errors['per_page'][] = 'Số bản ghi mỗi trang không được vượt quá 100.';
        }
        if ($page > intdiv(PHP_INT_MAX, $perPage) + 1) {
            $errors['page'][] = 'Số trang vượt quá giới hạn hỗ trợ.';
        }

        $parentId = null;
        if ($parentField !== null && array_key_exists($parentField, $query)) {
            $parentId = $this->positiveInteger($query[$parentField], $parentField, $errors);
        }

        if ($errors !== []) {
            throw new ApiException('422_VALIDATION_ERROR', 'Tham số truy vấn không hợp lệ.', $errors);
        }

        return new GeographyListQueryDto($page, $perPage, $parentId);
    }

    public function validateId(string $id): int
    {
        $validatedId = filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($validatedId === false) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Mã địa giới hành chính phải là số nguyên dương.',
                ['id' => ['Mã địa giới hành chính không hợp lệ.']],
            );
        }

        return $validatedId;
    }

    /**
     * @param array<string, array<int, string>> $errors
     */
    private function positiveInteger(mixed $value, string $field, array &$errors): int
    {
        $validated = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($validated === false) {
            $errors[$field][] = 'Giá trị phải là số nguyên dương.';
            return 1;
        }

        return $validated;
    }
}
