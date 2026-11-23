<?php

declare(strict_types=1);

namespace App\Core;

abstract class BaseController
{
    /**
     * @return array{page: int, per_page: int}
     */
    protected function paginationParameters(Request $request): array
    {
        $requestedPage = filter_var($request->query('page', 1), FILTER_VALIDATE_INT);
        $requestedPerPage = filter_var($request->query('per_page', 20), FILTER_VALIDATE_INT);

        return [
            'page' => max(1, $requestedPage === false ? 1 : $requestedPage),
            'per_page' => min(100, max(1, $requestedPerPage === false ? 20 : $requestedPerPage)),
        ];
    }

    /**
     * @param array<int, mixed> $items
     */
    protected function paginatedResponse(
        array $items,
        int $page,
        int $perPage,
        int $total,
        string $message = 'Thành công',
    ): Response {
        return Response::paginated($items, $page, min(100, max(1, $perPage)), $total, $message);
    }
}
