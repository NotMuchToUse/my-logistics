<?php

declare(strict_types=1);

namespace App\Modules\MasterData\DTOs;

final class GeographyListQueryDto
{
    public function __construct(
        public readonly int $page,
        public readonly int $perPage,
        public readonly ?int $parentId,
    ) {
    }
}
