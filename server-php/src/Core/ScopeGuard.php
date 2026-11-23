<?php

declare(strict_types=1);

namespace App\Core;

use InvalidArgumentException;

final class ScopeGuard
{
    /**
     * @param array<string, mixed> $scopeContext
     * @param array<string, mixed> $params
     */
    public static function buildBranchWhereClause(
        array $scopeContext,
        string $branchColumn,
        array &$params,
    ): string {
        self::assertSafeColumn($branchColumn);
        if (self::hasHqScope($scopeContext)) {
            return '1 = 1';
        }

        $columnParts = explode('.', $branchColumn);
        $columnName = strtolower((string) end($columnParts));
        $isWarehouseColumn = str_ends_with($columnName, 'warehouse_id');
        $scopeKey = $isWarehouseColumn ? 'allowed_warehouse_ids' : 'allowed_branch_ids';
        $scopeValues = self::scopeValues($scopeContext, $scopeKey);
        if ($scopeValues === []) {
            throw new ApiException('403_BRANCH_SCOPE', 'Người dùng không có phạm vi truy cập phù hợp.');
        }

        $placeholders = [];
        foreach ($scopeValues as $index => $scopeValue) {
            $parameterName = ':scope_' . ($isWarehouseColumn ? 'warehouse' : 'branch') . '_' . $index;
            while (array_key_exists($parameterName, $params)) {
                $parameterName .= '_';
            }

            $placeholders[] = $parameterName;
            $params[$parameterName] = $scopeValue;
        }

        return $branchColumn . ' IN (' . implode(', ', $placeholders) . ')';
    }

    /**
     * @param array<string, mixed> $scopeContext
     */
    public static function assertBranchAccess(array $scopeContext, int $targetBranchId): void
    {
        if (self::hasHqScope($scopeContext)) {
            return;
        }

        if (!in_array($targetBranchId, self::scopeValues($scopeContext, 'allowed_branch_ids'), true)) {
            throw new ApiException('403_BRANCH_SCOPE', 'Bạn không có quyền truy cập chi nhánh này.');
        }
    }

    /**
     * @param array<string, mixed> $scopeContext
     */
    private static function hasHqScope(array $scopeContext): bool
    {
        if (($scopeContext['scope_type'] ?? null) === 'hq_all') {
            return true;
        }

        foreach (($scopeContext['scopes'] ?? []) as $scope) {
            if (is_array($scope) && ($scope['scope_type'] ?? null) === 'hq_all') {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @return array<int, int>
     */
    private static function scopeValues(array $scopeContext, string $key): array
    {
        $values = [];
        $scopes = $scopeContext['scopes'] ?? [$scopeContext];
        foreach ($scopes as $scope) {
            if (!is_array($scope)) {
                continue;
            }

            foreach (($scope[$key] ?? []) as $value) {
                if (is_int($value) && $value > 0) {
                    $values[$value] = $value;
                } elseif (is_string($value) && ctype_digit($value) && (int) $value > 0) {
                    $values[(int) $value] = (int) $value;
                }
            }
        }

        return array_values($values);
    }

    private static function assertSafeColumn(string $column): void
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/', $column) !== 1) {
            throw new InvalidArgumentException('SQL scope columns must be simple qualified identifiers.');
        }
    }
}
