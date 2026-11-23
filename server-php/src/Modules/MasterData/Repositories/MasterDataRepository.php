<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Repositories;

use App\Core\ApiException;
use App\Core\BaseRepository;
use App\Modules\MasterData\DTOs\PricingTariffDto;
use App\Modules\MasterData\DTOs\ServiceTypeDto;
use App\Modules\MasterData\DTOs\SurchargeDto;
use App\Modules\MasterData\DTOs\ValueAddedServiceDto;
use App\Modules\MasterData\DTOs\WeightConversionRuleDto;
use PDO;

final class MasterDataRepository extends BaseRepository
{
    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateServiceTypes(int $page, int $perPage, ?string $search): array
    {
        return $this->paginateCatalog(
            'service_types',
            'id, code, name, description, estimated_days_min, estimated_days_max, is_active',
            $page,
            $perPage,
            $search,
            ['code', 'name'],
            ['id', 'code', 'name'],
        );
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateValueAddedServices(int $page, int $perPage, ?string $search): array
    {
        return $this->paginateCatalog(
            'value_added_services',
            'id, code, name, fee_type, fee_value, min_fee, max_fee, is_active',
            $page,
            $perPage,
            $search,
            ['code', 'name'],
            ['id', 'code', 'name'],
        );
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateSurcharges(int $page, int $perPage, ?string $search): array
    {
        return $this->paginateCatalog(
            'surcharges',
            'id, code, name, fee_type, fee_value, is_auto_applied, is_active',
            $page,
            $perPage,
            $search,
            ['code', 'name'],
            ['id', 'code', 'name'],
        );
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginatePricingTariffs(int $page, int $perPage, ?string $search): array
    {
        $conditions = ['is_active = 1'];
        $parameters = [];
        if ($search !== null) {
            $conditions[] = 'zone_type LIKE :search';
            $parameters[':search'] = '%' . $search . '%';
        }

        $where = implode(' AND ', $conditions);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM pricing_tariffs WHERE ' . $where);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $offset = ($page - 1) * $perPage;

        $statement = $this->pdo->prepare(
            'SELECT id, service_type_id, zone_type, min_weight_gram, max_weight_gram,
                    base_price, step_weight_gram, step_price, effective_from, effective_to, is_active
             FROM pricing_tariffs
             WHERE ' . $where . '
             ORDER BY id ASC
             LIMIT :limit OFFSET :offset',
        );
        foreach ($parameters as $name => $value) {
            $statement->bindValue($name, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return [
            'items' => array_map(fn (array $row): array => $this->normalizeIntegers($row), $statement->fetchAll()),
            'total' => $total,
        ];
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateWeightConversionRules(int $page, int $perPage, ?string $search): array
    {
        $conditions = ['is_active = 1'];
        $parameters = [];
        if ($search !== null) {
            $conditions[] = 'CAST(service_type_id AS CHAR) LIKE :search';
            $parameters[':search'] = '%' . $search . '%';
        }

        $where = implode(' AND ', $conditions);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM weight_conversion_rules WHERE ' . $where);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $offset = ($page - 1) * $perPage;

        $statement = $this->pdo->prepare(
            'SELECT id, service_type_id, divisor, min_chargeable_gram, effective_from, effective_to, is_active
             FROM weight_conversion_rules
             WHERE ' . $where . '
             ORDER BY id ASC
             LIMIT :limit OFFSET :offset',
        );
        foreach ($parameters as $name => $value) {
            $statement->bindValue($name, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return [
            'items' => array_map(fn (array $row): array => $this->normalizeIntegers($row), $statement->fetchAll()),
            'total' => $total,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findServiceType(int $id): ?array
    {
        return $this->findCatalog('service_types', 'id, code, name, description, estimated_days_min, estimated_days_max, is_active', $id);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findValueAddedService(int $id): ?array
    {
        return $this->findCatalog('value_added_services', 'id, code, name, fee_type, fee_value, min_fee, max_fee, is_active', $id);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findSurcharge(int $id): ?array
    {
        return $this->findCatalog('surcharges', 'id, code, name, fee_type, fee_value, is_auto_applied, is_active', $id);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findPricingTariff(int $id): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, service_type_id, zone_type, min_weight_gram, max_weight_gram,
                    base_price, step_weight_gram, step_price, effective_from, effective_to, is_active
             FROM pricing_tariffs
             WHERE id = :id AND is_active = 1
             LIMIT 1',
        );
        $statement->execute([':id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : $this->normalizeIntegers($row);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findWeightConversionRule(int $id): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, service_type_id, divisor, min_chargeable_gram, effective_from, effective_to, is_active
             FROM weight_conversion_rules
             WHERE id = :id AND is_active = 1
             LIMIT 1',
        );
        $statement->execute([':id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : $this->normalizeIntegers($row);
    }

    public function createServiceType(ServiceTypeDto $dto): int
    {
        $this->assertCatalogCodeAvailable('service_types', $dto->code);
        $statement = $this->pdo->prepare(
            'INSERT INTO service_types
                (code, name, description, estimated_days_min, estimated_days_max, is_active)
             VALUES
                (:code, :name, :description, :estimated_days_min, :estimated_days_max, :is_active)',
        );
        $statement->execute([
            ':code' => $dto->code,
            ':name' => $dto->name,
            ':description' => $dto->description,
            ':estimated_days_min' => $dto->estimatedDaysMin,
            ':estimated_days_max' => $dto->estimatedDaysMax,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function updateServiceType(int $id, ServiceTypeDto $dto): void
    {
        $this->assertCatalogExistsAndCodeAvailable('service_types', $id, $dto->code);
        $statement = $this->pdo->prepare(
            'UPDATE service_types
             SET code = :code,
                 name = :name,
                 description = :description,
                 estimated_days_min = :estimated_days_min,
                 estimated_days_max = :estimated_days_max,
                 is_active = :is_active
             WHERE id = :id',
        );
        $statement->execute([
            ':id' => $id,
            ':code' => $dto->code,
            ':name' => $dto->name,
            ':description' => $dto->description,
            ':estimated_days_min' => $dto->estimatedDaysMin,
            ':estimated_days_max' => $dto->estimatedDaysMax,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);
    }

    public function createValueAddedService(ValueAddedServiceDto $dto): int
    {
        $this->assertCatalogCodeAvailable('value_added_services', $dto->code);
        $statement = $this->pdo->prepare(
            'INSERT INTO value_added_services
                (code, name, fee_type, fee_value, min_fee, max_fee, is_active)
             VALUES
                (:code, :name, :fee_type, :fee_value, :min_fee, :max_fee, :is_active)',
        );
        $statement->execute([
            ':code' => $dto->code,
            ':name' => $dto->name,
            ':fee_type' => $dto->feeType,
            ':fee_value' => $dto->feeValue,
            ':min_fee' => $dto->minFee,
            ':max_fee' => $dto->maxFee,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function updateValueAddedService(int $id, ValueAddedServiceDto $dto): void
    {
        $this->assertCatalogExistsAndCodeAvailable('value_added_services', $id, $dto->code);
        $statement = $this->pdo->prepare(
            'UPDATE value_added_services
             SET code = :code, name = :name, fee_type = :fee_type,
                 fee_value = :fee_value, min_fee = :min_fee, max_fee = :max_fee,
                 is_active = :is_active
             WHERE id = :id',
        );
        $statement->execute([
            ':id' => $id,
            ':code' => $dto->code,
            ':name' => $dto->name,
            ':fee_type' => $dto->feeType,
            ':fee_value' => $dto->feeValue,
            ':min_fee' => $dto->minFee,
            ':max_fee' => $dto->maxFee,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);
    }

    public function createSurcharge(SurchargeDto $dto): int
    {
        $this->assertCatalogCodeAvailable('surcharges', $dto->code);
        $statement = $this->pdo->prepare(
            'INSERT INTO surcharges
                (code, name, fee_type, fee_value, is_auto_applied, is_active)
             VALUES
                (:code, :name, :fee_type, :fee_value, :is_auto_applied, :is_active)',
        );
        $statement->execute([
            ':code' => $dto->code,
            ':name' => $dto->name,
            ':fee_type' => $dto->feeType,
            ':fee_value' => $dto->feeValue,
            ':is_auto_applied' => $dto->isAutoApplied ? 1 : 0,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function updateSurcharge(int $id, SurchargeDto $dto): void
    {
        $this->assertCatalogExistsAndCodeAvailable('surcharges', $id, $dto->code);
        $statement = $this->pdo->prepare(
            'UPDATE surcharges
             SET code = :code, name = :name, fee_type = :fee_type,
                 fee_value = :fee_value, is_auto_applied = :is_auto_applied,
                 is_active = :is_active
             WHERE id = :id',
        );
        $statement->execute([
            ':id' => $id,
            ':code' => $dto->code,
            ':name' => $dto->name,
            ':fee_type' => $dto->feeType,
            ':fee_value' => $dto->feeValue,
            ':is_auto_applied' => $dto->isAutoApplied ? 1 : 0,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);
    }

    public function createPricingTariff(PricingTariffDto $dto): int
    {
        $this->assertServiceTypeExists($dto->serviceTypeId);
        $this->assertTariffOverlap(
            $dto->serviceTypeId,
            $dto->zoneType,
            $dto->minWeightGram,
            $dto->maxWeightGram,
            $dto->effectiveFrom,
            $dto->effectiveTo,
        );
        $statement = $this->pdo->prepare(
            'INSERT INTO pricing_tariffs
                (service_type_id, zone_type, min_weight_gram, max_weight_gram, base_price,
                 step_weight_gram, step_price, effective_from, effective_to, is_active)
             VALUES
                (:service_type_id, :zone_type, :min_weight_gram, :max_weight_gram, :base_price,
                 :step_weight_gram, :step_price, :effective_from, :effective_to, :is_active)',
        );
        $statement->execute([
            ':service_type_id' => $dto->serviceTypeId,
            ':zone_type' => $dto->zoneType,
            ':min_weight_gram' => $dto->minWeightGram,
            ':max_weight_gram' => $dto->maxWeightGram,
            ':base_price' => $dto->basePrice,
            ':step_weight_gram' => $dto->stepWeightGram,
            ':step_price' => $dto->stepPrice,
            ':effective_from' => $dto->effectiveFrom,
            ':effective_to' => $dto->effectiveTo,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function updatePricingTariff(int $id, PricingTariffDto $dto): void
    {
        $this->assertCatalogExists('pricing_tariffs', $id);
        $this->assertServiceTypeExists($dto->serviceTypeId);
        $this->assertTariffOverlap(
            $dto->serviceTypeId,
            $dto->zoneType,
            $dto->minWeightGram,
            $dto->maxWeightGram,
            $dto->effectiveFrom,
            $dto->effectiveTo,
            $id,
        );
        $statement = $this->pdo->prepare(
            'UPDATE pricing_tariffs
             SET service_type_id = :service_type_id, zone_type = :zone_type,
                 min_weight_gram = :min_weight_gram, max_weight_gram = :max_weight_gram,
                 base_price = :base_price, step_weight_gram = :step_weight_gram,
                 step_price = :step_price, effective_from = :effective_from,
                 effective_to = :effective_to, is_active = :is_active
             WHERE id = :id',
        );
        $statement->execute([
            ':id' => $id,
            ':service_type_id' => $dto->serviceTypeId,
            ':zone_type' => $dto->zoneType,
            ':min_weight_gram' => $dto->minWeightGram,
            ':max_weight_gram' => $dto->maxWeightGram,
            ':base_price' => $dto->basePrice,
            ':step_weight_gram' => $dto->stepWeightGram,
            ':step_price' => $dto->stepPrice,
            ':effective_from' => $dto->effectiveFrom,
            ':effective_to' => $dto->effectiveTo,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);
    }

    public function createWeightConversionRule(WeightConversionRuleDto $dto): int
    {
        $this->assertServiceTypeExists($dto->serviceTypeId);
        $this->assertWeightConversionOverlap(
            $dto->serviceTypeId,
            $dto->effectiveFrom,
            $dto->effectiveTo,
        );
        $statement = $this->pdo->prepare(
            'INSERT INTO weight_conversion_rules
                (service_type_id, divisor, min_chargeable_gram, effective_from, effective_to, is_active)
             VALUES
                (:service_type_id, :divisor, :min_chargeable_gram, :effective_from, :effective_to, :is_active)',
        );
        $statement->execute([
            ':service_type_id' => $dto->serviceTypeId,
            ':divisor' => $dto->divisor,
            ':min_chargeable_gram' => $dto->minChargeableGram,
            ':effective_from' => $dto->effectiveFrom,
            ':effective_to' => $dto->effectiveTo,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function updateWeightConversionRule(int $id, WeightConversionRuleDto $dto): void
    {
        $this->assertCatalogExists('weight_conversion_rules', $id);
        $this->assertServiceTypeExists($dto->serviceTypeId);
        $this->assertWeightConversionOverlap(
            $dto->serviceTypeId,
            $dto->effectiveFrom,
            $dto->effectiveTo,
            $id,
        );
        $statement = $this->pdo->prepare(
            'UPDATE weight_conversion_rules
             SET service_type_id = :service_type_id, divisor = :divisor,
                 min_chargeable_gram = :min_chargeable_gram,
                 effective_from = :effective_from, effective_to = :effective_to,
                 is_active = :is_active
             WHERE id = :id',
        );
        $statement->execute([
            ':id' => $id,
            ':service_type_id' => $dto->serviceTypeId,
            ':divisor' => $dto->divisor,
            ':min_chargeable_gram' => $dto->minChargeableGram,
            ':effective_from' => $dto->effectiveFrom,
            ':effective_to' => $dto->effectiveTo,
            ':is_active' => $dto->isActive ? 1 : 0,
        ]);
    }

    public function softDelete(string $resource, int $id): void
    {
        $allowed = [
            'service_types',
            'value_added_services',
            'surcharges',
            'pricing_tariffs',
            'weight_conversion_rules',
        ];
        if (!in_array($resource, $allowed, true)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Tên danh mục không hợp lệ.');
        }

        $this->assertCatalogExists($resource, $id);
        $statement = $this->pdo->prepare('UPDATE ' . $resource . ' SET is_active = 0 WHERE id = :id');
        $statement->execute([':id' => $id]);
    }

    public function assertMasterDataAdmin(int $userId): void
    {
        $statement = $this->pdo->prepare(
            'SELECT 1
             FROM user_has_roles uhr
             INNER JOIN roles r ON r.id = uhr.role_id
             WHERE uhr.user_id = :user_id
               AND r.code IN (\'system_admin\', \'system_dev\')
             LIMIT 1',
        );
        $statement->execute([':user_id' => $userId]);
        if ($statement->fetchColumn() === false) {
            throw new ApiException('403_FORBIDDEN', 'Chỉ Quản trị viên hoặc Dev hệ thống được quản lý danh mục.');
        }
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    private function paginateCatalog(
        string $table,
        string $columns,
        int $page,
        int $perPage,
        ?string $search,
        array $searchColumns,
        array $allowedSortColumns,
    ): array {
        $allowedTables = [
            'service_types',
            'value_added_services',
            'surcharges',
        ];
        if (!in_array($table, $allowedTables, true)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Tên bảng danh mục không hợp lệ.');
        }

        $conditions = ['is_active = 1'];
        $parameters = [];
        if ($search !== null) {
            $searchConditions = [];
            foreach ($searchColumns as $index => $column) {
                $key = ':search_' . $index;
                $searchConditions[] = $column . ' LIKE ' . $key;
                $parameters[$key] = '%' . $search . '%';
            }
            $conditions[] = '(' . implode(' OR ', $searchConditions) . ')';
        }
        $where = implode(' AND ', $conditions);

        $count = $this->pdo->prepare('SELECT COUNT(*) FROM ' . $table . ' WHERE ' . $where);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $statement = $this->pdo->prepare(
            'SELECT ' . $columns . ' FROM ' . $table
            . ' WHERE ' . $where
            . ' ORDER BY id ASC LIMIT :limit OFFSET :offset',
        );
        foreach ($parameters as $name => $value) {
            $statement->bindValue($name, $value, PDO::PARAM_STR);
        }
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return [
            'items' => array_map(fn (array $row): array => $this->normalizeIntegers($row), $statement->fetchAll()),
            'total' => $total,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findCatalog(string $table, string $columns, int $id): ?array
    {
        $allowed = ['service_types', 'value_added_services', 'surcharges'];
        if (!in_array($table, $allowed, true)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Tên bảng danh mục không hợp lệ.');
        }
        $statement = $this->pdo->prepare(
            'SELECT ' . $columns . ' FROM ' . $table . ' WHERE id = :id AND is_active = 1 LIMIT 1',
        );
        $statement->execute([':id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : $this->normalizeIntegers($row);
    }

    private function assertCatalogCodeAvailable(string $table, string $code, ?int $excludeId = null): void
    {
        $allowed = ['service_types', 'value_added_services', 'surcharges'];
        if (!in_array($table, $allowed, true)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Tên bảng danh mục không hợp lệ.');
        }

        $sql = 'SELECT 1 FROM ' . $table . ' WHERE code = :code';
        $parameters = [':code' => $code];
        if ($excludeId !== null) {
            $sql .= ' AND id <> :id';
            $parameters[':id'] = $excludeId;
        }
        $sql .= ' LIMIT 1';
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);
        if ($statement->fetchColumn() !== false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Mã danh mục đã tồn tại.', ['code' => ['Mã danh mục đã được sử dụng.']]);
        }
    }

    private function assertCatalogExistsAndCodeAvailable(string $table, int $id, string $code): void
    {
        $this->assertCatalogExists($table, $id);
        $this->assertCatalogCodeAvailable($table, $code, $id);
    }

    private function assertCatalogExists(string $table, int $id): void
    {
        $allowed = [
            'service_types',
            'value_added_services',
            'surcharges',
            'pricing_tariffs',
            'weight_conversion_rules',
        ];
        if (!in_array($table, $allowed, true)) {
            throw new ApiException('500_INTERNAL_ERROR', 'Tên bảng danh mục không hợp lệ.');
        }
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM ' . $table . ' WHERE id = :id AND is_active = 1 LIMIT 1',
        );
        $statement->execute([':id' => $id]);
        if ($statement->fetchColumn() === false) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy danh mục.');
        }
    }

    private function assertServiceTypeExists(int $serviceTypeId): void
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM service_types WHERE id = :id AND is_active = 1 LIMIT 1',
        );
        $statement->execute([':id' => $serviceTypeId]);
        if ($statement->fetchColumn() === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Dịch vụ không hợp lệ.', [
                'service_type_id' => ['Dịch vụ không tồn tại hoặc đã ngừng hoạt động.'],
            ]);
        }
    }

    private function assertTariffOverlap(
        int $serviceTypeId,
        string $zoneType,
        int $minWeight,
        int $maxWeight,
        string $effectiveFrom,
        ?string $effectiveTo,
        ?int $excludeId = null,
    ): void {
        $sql = 'SELECT 1
                FROM pricing_tariffs
                WHERE is_active = 1
                  AND service_type_id = :service_type_id
                  AND zone_type = :zone_type
                  AND min_weight_gram < :max_weight
                  AND max_weight_gram > :min_weight
                  AND effective_from <= :effective_to
                  AND (effective_to IS NULL OR effective_to >= :effective_from)';
        $parameters = [
            ':service_type_id' => $serviceTypeId,
            ':zone_type' => $zoneType,
            ':max_weight' => $maxWeight,
            ':min_weight' => $minWeight,
            ':effective_from' => $effectiveFrom,
            ':effective_to' => $effectiveTo ?? '9999-12-31',
        ];
        if ($excludeId !== null) {
            $sql .= ' AND id <> :exclude_id';
            $parameters[':exclude_id'] = $excludeId;
        }
        $sql .= ' LIMIT 1';
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);
        if ($statement->fetchColumn() !== false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Khoảng bảng giá bị trùng.', [
                'zone_type' => ['Khoảng trọng lượng hoặc thời gian bị trùng với bảng giá hiện có.'],
            ]);
        }
    }

    private function assertWeightConversionOverlap(
        int $serviceTypeId,
        string $effectiveFrom,
        ?string $effectiveTo,
        ?int $excludeId = null,
    ): void {
        $sql = 'SELECT 1
                FROM weight_conversion_rules
                WHERE is_active = 1
                  AND service_type_id = :service_type_id
                  AND effective_from <= :effective_to
                  AND (effective_to IS NULL OR effective_to >= :effective_from)';
        $parameters = [
            ':service_type_id' => $serviceTypeId,
            ':effective_from' => $effectiveFrom,
            ':effective_to' => $effectiveTo ?? '9999-12-31',
        ];
        if ($excludeId !== null) {
            $sql .= ' AND id <> :exclude_id';
            $parameters[':exclude_id'] = $excludeId;
        }
        $sql .= ' LIMIT 1';
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);
        if ($statement->fetchColumn() !== false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Quy tắc quy đổi bị trùng thời gian.', [
                'effective_from' => ['Dịch vụ đã có quy tắc quy đổi trong khoảng thời gian này.'],
            ]);
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizeIntegers(array $row): array
    {
        foreach ($row as $key => $value) {
            if (in_array($key, [
                'id',
                'service_type_id',
                'estimated_days_min',
                'estimated_days_max',
                'is_active',
                'is_auto_applied',
                'min_weight_gram',
                'max_weight_gram',
                'step_weight_gram',
                'divisor',
                'min_chargeable_gram',
            ], true) && $value !== null) {
                $row[$key] = (int) $value;
            }
        }

        return $row;
    }
}
