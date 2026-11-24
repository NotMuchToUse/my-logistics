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
    public static function applyBranchFilter(
        array $scopeContext,
        string $branchColumn,
        array &$params,
    ): string {
        self::assertSafeColumn($branchColumn);
        if (self::hasUnrestrictedHqScope($scopeContext)) {
            return '1 = 1';
        }

        return self::buildScopeFilter(
            $branchColumn,
            self::scopeValues($scopeContext, 'allowed_branch_ids'),
            'branch',
            $params,
        );
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @param array<string, mixed> $params
     */
    public static function applyWarehouseFilter(
        array $scopeContext,
        string $warehouseColumn,
        array &$params,
    ): string {
        self::assertSafeColumn($warehouseColumn);
        if (self::hasUnrestrictedHqScope($scopeContext)) {
            return '1 = 1';
        }

        return self::buildScopeFilter(
            $warehouseColumn,
            self::scopeValues($scopeContext, 'allowed_warehouse_ids'),
            'warehouse',
            $params,
        );
    }

    /**
     * @param array<string, mixed> $scopeContext
     * @param array<string, mixed> $params
     */
    public static function buildBranchWhereClause(
        array $scopeContext,
        string $branchColumn,
        array &$params,
    ): string {
        $columnParts = explode('.', $branchColumn);
        $columnName = strtolower((string) end($columnParts));
        if (str_ends_with($columnName, 'warehouse_id')) {
            return self::applyWarehouseFilter($scopeContext, $branchColumn, $params);
        }

        return self::applyBranchFilter($scopeContext, $branchColumn, $params);
    }

    /**
     * @param array<string, mixed> $scopeContext
     */
    public static function assertBranchAccess(array $scopeContext, int $targetBranchId): void
    {
        if (self::hasUnrestrictedHqScope($scopeContext)) {
            return;
        }

        if (!in_array($targetBranchId, self::scopeValues($scopeContext, 'allowed_branch_ids'), true)) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }
    }

    /**
     * @param array<string, mixed> $scopeContext
     */
    public static function assertWarehouseAccess(array $scopeContext, int $targetWarehouseId): void
    {
        if (self::hasUnrestrictedHqScope($scopeContext)) {
            return;
        }

        if (!in_array($targetWarehouseId, self::scopeValues($scopeContext, 'allowed_warehouse_ids'), true)) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }
    }

    /**
     * @param array<string, mixed> $scopeContext
     */
    private static function hasUnrestrictedHqScope(array $scopeContext): bool
    {
        if (($scopeContext['active_branch_id'] ?? null) !== null) {
            return false;
        }

        if (($scopeContext['is_hq_all'] ?? false) === true) {
            return true;
        }
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
        $scopes = array_key_exists($key, $scopeContext)
            ? [$scopeContext]
            : ($scopeContext['scopes'] ?? [$scopeContext]);
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

    /**
     * @param array<int, int> $scopeValues
     * @param array<string, mixed> $params
     */
    private static function buildScopeFilter(
        string $column,
        array $scopeValues,
        string $scopeKind,
        array &$params,
    ): string {
        if ($scopeValues === []) {
            return '0 = 1';
        }

        $placeholders = [];
        foreach ($scopeValues as $index => $scopeValue) {
            $parameterName = ':scope_' . $scopeKind . '_' . $index;
            while (array_key_exists($parameterName, $params)) {
                $parameterName .= '_';
            }

            $placeholders[] = $parameterName;
            $params[$parameterName] = $scopeValue;
        }

        return $column . ' IN (' . implode(', ', $placeholders) . ')';
    }

    private static function assertSafeColumn(string $column): void
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/', $column) !== 1) {
            throw new InvalidArgumentException('SQL scope columns must be simple qualified identifiers.');
        }
    }
}
