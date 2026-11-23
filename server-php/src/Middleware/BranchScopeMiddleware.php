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
        if ($request->clientType() !== 'web_internal') {
            throw new ApiException('403_BRANCH_SCOPE', 'Branch scope chỉ áp dụng cho ứng dụng nội bộ.');
        }

        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập trước khi chọn phạm vi chi nhánh.');
        }

        $statement = $this->pdo->prepare(
            'SELECT scope_type, branch_id, warehouse_id
             FROM user_branch_scopes
             WHERE user_id = :user_id'
        );
        $statement->execute([':user_id' => (int) $auth['user_id']]);
        $scopeRows = $statement->fetchAll(PDO::FETCH_ASSOC);

        $recursiveRootIds = [];
        foreach ($scopeRows as $scopeRow) {
            if (
                in_array($scopeRow['scope_type'], ['region_center', 'branch'], true)
                && $scopeRow['branch_id'] !== null
            ) {
                $recursiveRootIds[] = (int) $scopeRow['branch_id'];
            }
        }

        $branchIdsByRoot = $this->branchIdsForScopes(array_values(array_unique($recursiveRootIds)));
        $allBranchIdsForWarehouseLookup = [];
        foreach ($scopeRows as $scopeRow) {
            if ($scopeRow['scope_type'] === 'post_office' && $scopeRow['branch_id'] !== null) {
                $allBranchIdsForWarehouseLookup[] = (int) $scopeRow['branch_id'];
            } elseif (
                in_array($scopeRow['scope_type'], ['region_center', 'branch'], true)
                && $scopeRow['branch_id'] !== null
            ) {
                $rootBranchId = (int) $scopeRow['branch_id'];
                $allBranchIdsForWarehouseLookup = [
                    ...$allBranchIdsForWarehouseLookup,
                    ...($branchIdsByRoot[$rootBranchId] ?? []),
                ];
            }
        }

        $warehousesByBranch = $this->warehousesForBranches(
            array_values(array_unique($allBranchIdsForWarehouseLookup)),
        );

        $scopes = [];
        $allBranchIds = [];
        $allWarehouseIds = [];
        $headerBranchIds = [];
        $hasHqScope = false;

        foreach ($scopeRows as $scopeRow) {
            $scopeType = (string) $scopeRow['scope_type'];
            $branchId = $scopeRow['branch_id'] === null ? null : (int) $scopeRow['branch_id'];
            $warehouseId = $scopeRow['warehouse_id'] === null ? null : (int) $scopeRow['warehouse_id'];

            if ($scopeType === 'hq_all') {
                $hasHqScope = true;
                $scopes[] = [
                    'scope_type' => 'hq_all',
                    'allowed_branch_ids' => [],
                    'allowed_warehouse_ids' => [],
                    'header_branch_ids' => [],
                ];
                continue;
            }

            if ($scopeType === 'warehouse') {
                $allowedWarehouseIds = $warehouseId === null ? [] : [$warehouseId];
                $scopeHeaderBranchIds = $branchId === null ? [] : [$branchId];
                $scope = [
                    'scope_type' => $scopeType,
                    'allowed_branch_ids' => [],
                    'allowed_warehouse_ids' => $allowedWarehouseIds,
                    'header_branch_ids' => $scopeHeaderBranchIds,
                ];
                $scopes[] = $scope;
                $allWarehouseIds = [...$allWarehouseIds, ...$allowedWarehouseIds];
                $headerBranchIds = [...$headerBranchIds, ...$scopeHeaderBranchIds];
                continue;
            }

            if (!in_array($scopeType, ['region_center', 'branch', 'post_office'], true) || $branchId === null) {
                continue;
            }

            $allowedBranchIds = $scopeType === 'post_office'
                ? [$branchId]
                : ($branchIdsByRoot[$branchId] ?? []);
            $allowedWarehouseIds = [];
            foreach ($allowedBranchIds as $allowedBranchId) {
                $allowedWarehouseIds = [
                    ...$allowedWarehouseIds,
                    ...($warehousesByBranch[$allowedBranchId] ?? []),
                ];
            }

            $scopes[] = [
                'scope_type' => $scopeType,
                'allowed_branch_ids' => $allowedBranchIds,
                'allowed_warehouse_ids' => $allowedWarehouseIds,
                'header_branch_ids' => $allowedBranchIds,
            ];
            $allBranchIds = [...$allBranchIds, ...$allowedBranchIds];
            $allWarehouseIds = [...$allWarehouseIds, ...$allowedWarehouseIds];
            $headerBranchIds = [...$headerBranchIds, ...$allowedBranchIds];
        }

        $scopeContext = [
            'scope_type' => $hasHqScope ? 'hq_all' : 'scoped',
            'scopes' => $scopes,
            'allowed_branch_ids' => array_values(array_unique($allBranchIds)),
            'allowed_warehouse_ids' => array_values(array_unique($allWarehouseIds)),
            'header_branch_ids' => array_values(array_unique($headerBranchIds)),
        ];

        $requestedBranchId = $request->branchIdHeader();
        if ($requestedBranchId !== null) {
            if (!ctype_digit($requestedBranchId) || (int) $requestedBranchId < 1) {
                throw new ApiException('400_BAD_REQUEST', 'Header X-Branch-Id phải là số nguyên dương.');
            }

            if (
                !$hasHqScope
                && !in_array((int) $requestedBranchId, $scopeContext['header_branch_ids'], true)
            ) {
                throw new ApiException('403_BRANCH_SCOPE', 'Chi nhánh được chọn không thuộc phạm vi của bạn.');
            }

            $scopeContext['active_branch_id'] = (int) $requestedBranchId;
        } elseif (!$hasHqScope) {
            throw new ApiException('403_BRANCH_SCOPE', 'Thiếu X-Branch-Id cho thao tác nghiệp vụ chi nhánh.');
        } else {
            $scopeContext['active_branch_id'] = null;
        }

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

        $placeholders = [];
        $parameters = [];
        foreach ($rootBranchIds as $index => $rootBranchId) {
            $placeholder = ':root_branch_' . $index;
            $placeholders[] = $placeholder;
            $parameters[$placeholder] = $rootBranchId;
        }

        $statement = $this->pdo->prepare(
            'WITH RECURSIVE branch_tree AS (
                SELECT id, parent_branch_id, id AS root_branch_id
                FROM branches
                WHERE id IN (' . implode(', ', $placeholders) . ')
                UNION ALL
                SELECT child.id, child.parent_branch_id, parent.root_branch_id
                FROM branches child
                INNER JOIN branch_tree parent ON child.parent_branch_id = parent.id
             )
             SELECT root_branch_id, id FROM branch_tree'
        );
        $statement->execute($parameters);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $branchIdsByRoot = [];
        foreach ($rows as $row) {
            $rootBranchId = (int) $row['root_branch_id'];
            $branchIdsByRoot[$rootBranchId][] = (int) $row['id'];
        }

        return $branchIdsByRoot;
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

        $placeholders = [];
        $parameters = [];
        foreach ($branchIds as $index => $branchId) {
            $placeholder = ':branch_id_' . $index;
            $placeholders[] = $placeholder;
            $parameters[$placeholder] = $branchId;
        }

        $statement = $this->pdo->prepare(
            'SELECT id, branch_id FROM warehouses WHERE branch_id IN (' . implode(', ', $placeholders) . ')'
        );
        $statement->execute($parameters);
        $warehousesByBranch = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $warehouse) {
            $branchId = (int) $warehouse['branch_id'];
            $warehousesByBranch[$branchId][] = (int) $warehouse['id'];
        }

        return $warehousesByBranch;
    }
}
