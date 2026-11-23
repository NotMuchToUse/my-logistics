<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Services;

use App\Core\ApiException;
use App\Modules\MasterData\DTOs\PricingTariffDto;
use App\Modules\MasterData\DTOs\ServiceTypeDto;
use App\Modules\MasterData\DTOs\SurchargeDto;
use App\Modules\MasterData\DTOs\ValueAddedServiceDto;
use App\Modules\MasterData\DTOs\WeightConversionRuleDto;
use App\Modules\MasterData\Repositories\MasterDataRepository;

final class MasterDataService
{
    public function __construct(private readonly MasterDataRepository $repository)
    {
    }

    public function assertMasterDataAdmin(int $userId): void
    {
        $this->repository->assertMasterDataAdmin($userId);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateServiceTypes(int $page, int $perPage, ?string $search): array
    {
        return $this->repository->paginateServiceTypes($page, $perPage, $search);
    }

    /**
     * @return array<string, mixed>
     */
    public function findServiceType(int $id): array
    {
        $record = $this->repository->findServiceType($id);
        return $this->requireRecord($record, 'Không tìm thấy loại dịch vụ.');
    }

    /**
     * @return array<string, mixed>
     */
    public function createServiceType(ServiceTypeDto $dto): array
    {
        $id = $this->repository->createServiceType($dto);
        return $this->findServiceType($id);
    }

    /**
     * @return array<string, mixed>
     */
    public function updateServiceType(int $id, ServiceTypeDto $dto): array
    {
        $this->repository->updateServiceType($id, $dto);
        return $this->findServiceType($id);
    }

    public function softDeleteServiceType(int $id): void
    {
        $this->repository->softDelete('service_types', $id);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateValueAddedServices(int $page, int $perPage, ?string $search): array
    {
        return $this->repository->paginateValueAddedServices($page, $perPage, $search);
    }

    /**
     * @return array<string, mixed>
     */
    public function findValueAddedService(int $id): array
    {
        $record = $this->repository->findValueAddedService($id);
        return $this->requireRecord($record, 'Không tìm thấy dịch vụ gia tăng.');
    }

    /**
     * @return array<string, mixed>
     */
    public function createValueAddedService(ValueAddedServiceDto $dto): array
    {
        $id = $this->repository->createValueAddedService($dto);
        return $this->findValueAddedService($id);
    }

    /**
     * @return array<string, mixed>
     */
    public function updateValueAddedService(int $id, ValueAddedServiceDto $dto): array
    {
        $this->repository->updateValueAddedService($id, $dto);
        return $this->findValueAddedService($id);
    }

    public function softDeleteValueAddedService(int $id): void
    {
        $this->repository->softDelete('value_added_services', $id);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateSurcharges(int $page, int $perPage, ?string $search): array
    {
        return $this->repository->paginateSurcharges($page, $perPage, $search);
    }

    /**
     * @return array<string, mixed>
     */
    public function findSurcharge(int $id): array
    {
        $record = $this->repository->findSurcharge($id);
        return $this->requireRecord($record, 'Không tìm thấy phụ phí.');
    }

    /**
     * @return array<string, mixed>
     */
    public function createSurcharge(SurchargeDto $dto): array
    {
        $id = $this->repository->createSurcharge($dto);
        return $this->findSurcharge($id);
    }

    /**
     * @return array<string, mixed>
     */
    public function updateSurcharge(int $id, SurchargeDto $dto): array
    {
        $this->repository->updateSurcharge($id, $dto);
        return $this->findSurcharge($id);
    }

    public function softDeleteSurcharge(int $id): void
    {
        $this->repository->softDelete('surcharges', $id);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginatePricingTariffs(int $page, int $perPage, ?string $search): array
    {
        return $this->repository->paginatePricingTariffs($page, $perPage, $search);
    }

    /**
     * @return array<string, mixed>
     */
    public function findPricingTariff(int $id): array
    {
        $record = $this->repository->findPricingTariff($id);
        return $this->requireRecord($record, 'Không tìm thấy bảng giá.');
    }

    /**
     * @return array<string, mixed>
     */
    public function createPricingTariff(PricingTariffDto $dto): array
    {
        $id = $this->repository->createPricingTariff($dto);
        return $this->findPricingTariff($id);
    }

    /**
     * @return array<string, mixed>
     */
    public function updatePricingTariff(int $id, PricingTariffDto $dto): array
    {
        $this->repository->updatePricingTariff($id, $dto);
        return $this->findPricingTariff($id);
    }

    public function softDeletePricingTariff(int $id): void
    {
        $this->repository->softDelete('pricing_tariffs', $id);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginateWeightConversionRules(int $page, int $perPage, ?string $search): array
    {
        return $this->repository->paginateWeightConversionRules($page, $perPage, $search);
    }

    /**
     * @return array<string, mixed>
     */
    public function findWeightConversionRule(int $id): array
    {
        $record = $this->repository->findWeightConversionRule($id);
        return $this->requireRecord($record, 'Không tìm thấy quy tắc quy đổi trọng lượng.');
    }

    /**
     * @return array<string, mixed>
     */
    public function createWeightConversionRule(WeightConversionRuleDto $dto): array
    {
        $id = $this->repository->createWeightConversionRule($dto);
        return $this->findWeightConversionRule($id);
    }

    /**
     * @return array<string, mixed>
     */
    public function updateWeightConversionRule(int $id, WeightConversionRuleDto $dto): array
    {
        $this->repository->updateWeightConversionRule($id, $dto);
        return $this->findWeightConversionRule($id);
    }

    public function softDeleteWeightConversionRule(int $id): void
    {
        $this->repository->softDelete('weight_conversion_rules', $id);
    }

    /**
     * @param array<string, mixed>|null $record
     * @return array<string, mixed>
     */
    private function requireRecord(?array $record, string $message): array
    {
        if ($record === null) {
            throw new ApiException('404_NOT_FOUND', $message);
        }

        return $record;
    }
}
