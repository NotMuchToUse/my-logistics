<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use PDO;

final class BranchScopeMiddleware implements MiddlewareInterface
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function process(Request $request, callable $next): Response
    {
        if (!in_array($request->clientType(), ['web_internal', 'mobile_driver'], true)) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }

        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id']) || !is_numeric($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập trước khi chọn phạm vi chi nhánh.');
        }

        $statement = $this->pdo->prepare(
            'SELECT scope_type, branch_id, warehouse_id
             FROM user_branch_scopes
             WHERE user_id = :user_id'
        );
        $statement->execute([':user_id' => (int) $auth['user_id']]);
        $scopeRows = $statement->fetchAll(PDO::FETCH_ASSOC);
        if ($scopeRows === []) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }

        $branchRoots = [];
        $postOfficeIds = [];
        $warehouseScopeRows = [];
        $hasHqScope = false;
        foreach ($scopeRows as $scopeRow) {
            $scopeType = (string) $scopeRow['scope_type'];
            $branchId = $this->positiveId($scopeRow['branch_id']);
            $warehouseId = $this->positiveId($scopeRow['warehouse_id']);

            if ($scopeType === 'hq_all') {
                $hasHqScope = true;
            } elseif (in_array($scopeType, ['region_center', 'branch'], true) && $branchId !== null) {
                $branchRoots[$branchId] = $scopeType;
            } elseif ($scopeType === 'post_office' && $branchId !== null) {
                $postOfficeIds[$branchId] = $branchId;
            } elseif ($scopeType === 'warehouse' && $warehouseId !== null) {
                $warehouseScopeRows[] = [
                    'warehouse_id' => $warehouseId,
                    'branch_id' => $branchId,
                ];
            }
        }

        $rootBranchIds = [...array_keys($branchRoots), ...array_values($postOfficeIds)];
        $branchDetails = $this->branchDetails($rootBranchIds);
        $validRoots = [];
        foreach ($branchRoots as $branchId => $scopeType) {
            $expectedType = $scopeType === 'region_center' ? 'regional_hub' : 'branch';
            if (($branchDetails[$branchId]['branch_type'] ?? null) === $expectedType) {
                $validRoots[$branchId] = $scopeType;
            }
        }
        foreach ($postOfficeIds as $branchId) {
            if (($branchDetails[$branchId]['branch_type'] ?? null) === 'post_office') {
                $validRoots[$branchId] = 'post_office';
            }
        }

        $branchIdsByRoot = $this->branchIdsForScopes(array_keys(array_filter(
            $validRoots,
            static fn (string $scopeType): bool => in_array($scopeType, ['region_center', 'branch'], true),
        )));
        foreach ($validRoots as $branchId => $scopeType) {
            if ($scopeType === 'post_office') {
                $branchIdsByRoot[$branchId] = [$branchId];
            }
        }

        $branchesForWarehouseLookup = [];
        foreach ($branchIdsByRoot as $branchIds) {
            $branchesForWarehouseLookup = [...$branchesForWarehouseLookup, ...$branchIds];
        }
        $warehousesByBranch = $this->warehousesForBranches(array_values(array_unique($branchesForWarehouseLookup)));
        $resolvedScopes = [];
        foreach ($validRoots as $branchId => $scopeType) {
            $allowedBranchIds = $branchIdsByRoot[$branchId] ?? [];
            $allowedWarehouseIds = [];
            foreach ($allowedBranchIds as $allowedBranchId) {
                $allowedWarehouseIds = [
                    ...$allowedWarehouseIds,
                    ...($warehousesByBranch[$allowedBranchId] ?? []),
                ];
            }
            $resolvedScopes[] = [
                'scope_type' => $scopeType,
                'allowed_branch_ids' => $allowedBranchIds,
                'allowed_warehouse_ids' => array_values(array_unique($allowedWarehouseIds)),
                'header_branch_ids' => $allowedBranchIds,
            ];
        }
        $resolvedScopes = [
            ...$resolvedScopes,
            ...$this->warehouseScopes($warehouseScopeRows),
        ];
        if ($hasHqScope) {
            $resolvedScopes[] = [
                'scope_type' => 'hq_all',
                'allowed_branch_ids' => [],
                'allowed_warehouse_ids' => [],
                'header_branch_ids' => [],
            ];
        }
        if ($resolvedScopes === []) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }

        $availableHeaderBranchIds = [];
        foreach ($resolvedScopes as $scope) {
            $availableHeaderBranchIds = [
                ...$availableHeaderBranchIds,
                ...$scope['header_branch_ids'],
            ];
        }
        $availableHeaderBranchIds = array_values(array_unique($availableHeaderBranchIds));

        $requestedBranchId = $request->branchIdHeader();
        $activeBranchId = null;
        $allowedBranchIds = [];
        $allowedWarehouseIds = [];
        if ($requestedBranchId !== null) {
            $activeBranchId = $this->resolveBranchHeader($requestedBranchId);
            if (!$hasHqScope && !in_array($activeBranchId, $availableHeaderBranchIds, true)) {
                throw new ApiException(
                    '403_BRANCH_SCOPE',
                    'Không có quyền thao tác trên chi nhánh/kho này',
                    [],
                    403,
                );
            }

            $activeBranchWarehouses = $warehousesByBranch[$activeBranchId]
                ?? $this->warehousesForBranches([$activeBranchId])[$activeBranchId]
                ?? [];
            if ($hasHqScope) {
                $allowedBranchIds[] = $activeBranchId;
                $allowedWarehouseIds = $activeBranchWarehouses;
            }

            foreach ($resolvedScopes as $scope) {
                if (!in_array($activeBranchId, $scope['header_branch_ids'], true)) {
                    continue;
                }

                if ($scope['scope_type'] === 'warehouse') {
                    $allowedWarehouseIds = [
                        ...$allowedWarehouseIds,
                        ...$scope['allowed_warehouse_ids'],
                    ];
                    continue;
                }

                $allowedBranchIds[] = $activeBranchId;
                $allowedWarehouseIds = [
                    ...$allowedWarehouseIds,
                    ...array_values(array_intersect(
                        $scope['allowed_warehouse_ids'],
                        $activeBranchWarehouses,
                    )),
                ];
            }
        } elseif (!$hasHqScope) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }

        $scopeContext = [
            'scope_type' => $hasHqScope && $activeBranchId === null ? 'hq_all' : 'scoped',
            'is_hq_all' => $hasHqScope,
            'scopes' => $resolvedScopes,
            'active_branch_id' => $activeBranchId,
            'allowed_branch_ids' => array_values(array_unique($allowedBranchIds)),
            'allowed_warehouse_ids' => array_values(array_unique($allowedWarehouseIds)),
            'header_branch_ids' => $activeBranchId === null
                ? $availableHeaderBranchIds
                : [$activeBranchId],
        ];
        $request->setAttribute('scope_context', $scopeContext);

        return $next($request);
    }

    /**
     * @param array<int, int> $rootBranchIds
     * @return array<int, array<int, int>>
     */
    private function branchIdsForScopes(array $rootBranchIds): array
    {
        if ($rootBranchIds === []) {
            return [];
        }

        $inClause = $this->buildInClause($rootBranchIds, 'root_branch');

        $statement = $this->pdo->prepare(
            'WITH RECURSIVE branch_tree AS (
                SELECT id, parent_branch_id, id AS root_branch_id
                FROM branches
                WHERE id IN (' . $inClause['sql'] . ')
                  AND is_active = 1
                  AND deleted_at IS NULL
                UNION DISTINCT
                SELECT child.id, child.parent_branch_id, parent.root_branch_id
                FROM branches child
                INNER JOIN branch_tree parent ON child.parent_branch_id = parent.id
                WHERE child.is_active = 1
                  AND child.deleted_at IS NULL
             )
             SELECT root_branch_id, id FROM branch_tree'
        );
        $statement->execute($inClause['params']);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $branchIdsByRoot = [];
        foreach ($rows as $row) {
            $rootBranchId = (int) $row['root_branch_id'];
            $branchIdsByRoot[$rootBranchId][] = (int) $row['id'];
        }
        foreach ($branchIdsByRoot as &$branchIds) {
            $branchIds = array_values(array_unique($branchIds));
        }
        unset($branchIds);

        return $branchIdsByRoot;
    }

    /**
     * @param array<int, int> $branchIds
     * @return array<int, array{branch_type: string}>
     */
    private function branchDetails(array $branchIds): array
    {
        if ($branchIds === []) {
            return [];
        }

        $inClause = $this->buildInClause($branchIds, 'branch_detail');
        $statement = $this->pdo->prepare(
            'SELECT id, branch_type
             FROM branches
             WHERE id IN (' . $inClause['sql'] . ')
               AND is_active = 1
               AND deleted_at IS NULL'
        );
        $statement->execute($inClause['params']);
        $details = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $details[(int) $row['id']] = ['branch_type' => (string) $row['branch_type']];
        }

        return $details;
    }

    /**
     * @param array<int, int> $branchIds
     * @return array<int, array<int, int>>
     */
    private function warehousesForBranches(array $branchIds): array
    {
        if ($branchIds === []) {
            return [];
        }

        $inClause = $this->buildInClause($branchIds, 'warehouse_branch');

        $statement = $this->pdo->prepare(
            'SELECT warehouses.id, warehouses.branch_id
             FROM warehouses
             INNER JOIN branches ON branches.id = warehouses.branch_id
             WHERE warehouses.branch_id IN (' . $inClause['sql'] . ')
               AND warehouses.is_active = 1
               AND warehouses.deleted_at IS NULL
               AND branches.is_active = 1
               AND branches.deleted_at IS NULL'
        );
        $statement->execute($inClause['params']);
        $warehousesByBranch = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $warehouse) {
            $branchId = (int) $warehouse['branch_id'];
            $warehousesByBranch[$branchId][] = (int) $warehouse['id'];
        }

        return $warehousesByBranch;
    }

    /**
     * @param array<int, array{warehouse_id: int, branch_id: int|null}> $scopeRows
     * @return list<array{
     *     scope_type: string,
     *     allowed_branch_ids: array<int, int>,
     *     allowed_warehouse_ids: array<int, int>,
     *     header_branch_ids: array<int, int>
     * }>
     */
    private function warehouseScopes(array $scopeRows): array
    {
        if ($scopeRows === []) {
            return [];
        }

        $warehouseIds = array_values(array_unique(array_column($scopeRows, 'warehouse_id')));
        $inClause = $this->buildInClause($warehouseIds, 'scoped_warehouse');
        $statement = $this->pdo->prepare(
            'SELECT warehouses.id, warehouses.branch_id
             FROM warehouses
             INNER JOIN branches ON branches.id = warehouses.branch_id
             WHERE warehouses.id IN (' . $inClause['sql'] . ')
               AND warehouses.is_active = 1
               AND warehouses.deleted_at IS NULL
               AND branches.is_active = 1
               AND branches.deleted_at IS NULL'
        );
        $statement->execute($inClause['params']);
        $warehouseBranches = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $warehouseBranches[(int) $row['id']] = (int) $row['branch_id'];
        }

        $scopes = [];
        foreach ($scopeRows as $scopeRow) {
            $warehouseId = $scopeRow['warehouse_id'];
            $branchId = $warehouseBranches[$warehouseId] ?? null;
            if ($branchId === null || ($scopeRow['branch_id'] !== null && $scopeRow['branch_id'] !== $branchId)) {
                continue;
            }

            $scopes[] = [
                'scope_type' => 'warehouse',
                'allowed_branch_ids' => [],
                'allowed_warehouse_ids' => [$warehouseId],
                'header_branch_ids' => [$branchId],
            ];
        }

        return $scopes;
    }

    private function resolveBranchHeader(string $headerValue): int
    {
        if (ctype_digit($headerValue)) {
            $branchId = filter_var($headerValue, FILTER_VALIDATE_INT);
            if ($branchId === false || $branchId < 1) {
                throw new ApiException('400_BAD_REQUEST', 'Header X-Branch-Id không hợp lệ.');
            }
            $statement = $this->pdo->prepare(
                'SELECT id FROM branches
                 WHERE id = :branch_id AND is_active = 1 AND deleted_at IS NULL
                 LIMIT 1'
            );
            $statement->execute([':branch_id' => $branchId]);
        } elseif (preg_match('/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i', $headerValue) === 1) {
            $statement = $this->pdo->prepare(
                'SELECT id FROM branches
                 WHERE public_id = :public_id AND is_active = 1 AND deleted_at IS NULL
                 LIMIT 1'
            );
            $statement->execute([':public_id' => strtoupper($headerValue)]);
        } else {
            throw new ApiException('400_BAD_REQUEST', 'Header X-Branch-Id không hợp lệ.');
        }

        $branchId = $statement->fetchColumn();
        if ($branchId === false) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }

        return (int) $branchId;
    }

    /**
     * @param array<int, mixed> $ids
     * @return array{sql: string, params: array<string, int>}
     */
    private function buildInClause(array $ids, string $parameterPrefix): array
    {
        $placeholders = [];
        $parameters = [];
        foreach (array_values(array_unique(array_filter($ids, static fn (mixed $id): bool => is_int($id) && $id > 0))) as $index => $id) {
            $placeholder = ':' . $parameterPrefix . '_' . $index;
            $placeholders[] = $placeholder;
            $parameters[$placeholder] = $id;
        }

        if ($placeholders === []) {
            throw new ApiException(
                '403_BRANCH_SCOPE',
                'Không có quyền thao tác trên chi nhánh/kho này',
                [],
                403,
            );
        }

        return ['sql' => implode(', ', $placeholders), 'params' => $parameters];
    }

    private function positiveId(mixed $value): ?int
    {
        if (!is_int($value) && !is_string($value)) {
            return null;
        }

        $id = filter_var($value, FILTER_VALIDATE_INT);

        return $id === false || $id < 1 ? null : $id;
    }
}
