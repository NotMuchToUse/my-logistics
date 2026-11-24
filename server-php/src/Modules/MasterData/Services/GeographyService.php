<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Services;

use App\Core\ApiException;
use App\Modules\MasterData\Repositories\GeographyRepository;

final class GeographyService
{
    public function __construct(private readonly GeographyRepository $repository)
    {
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginate(string $resource, ?int $parentId, int $page, int $perPage): array
    {
        return $this->repository->paginate($resource, $parentId, $page, $perPage);
    }

    /**
     * @return array<string, mixed>
     */
    public function findActive(string $resource, int $id): array
    {
        $record = $this->repository->findActive($resource, $id);
        if ($record === null) {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy địa giới hành chính.');
        }

        return $record;
    }
}
