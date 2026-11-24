<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Controllers;

use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\MasterData\Services\GeographyService;
use App\Modules\MasterData\Validators\GeographyQueryValidator;

final class GeographyController extends BaseController
{
    public function __construct(
        private readonly GeographyService $service,
        private readonly GeographyQueryValidator $validator,
    ) {
    }

    public function provinces(Request $request): Response
    {
        return $this->list($request, 'provinces', null);
    }

    public function province(Request $request): Response
    {
        return $this->detail($request, 'provinces');
    }

    public function districts(Request $request): Response
    {
        return $this->list($request, 'districts', 'province_id');
    }

    public function district(Request $request): Response
    {
        return $this->detail($request, 'districts');
    }

    public function wards(Request $request): Response
    {
        return $this->list($request, 'wards', 'district_id');
    }

    public function ward(Request $request): Response
    {
        return $this->detail($request, 'wards');
    }

    private function list(Request $request, string $resource, ?string $parentField): Response
    {
        $query = $this->validator->validateList($request->queryParameters(), $parentField);
        $result = $this->service->paginate(
            $resource,
            $query->parentId,
            $query->page,
            $query->perPage,
        );

        return $this->paginatedResponse(
            $result['items'],
            $query->page,
            $query->perPage,
            $result['total'],
            'Lấy danh sách địa giới hành chính thành công.',
        );
    }

    private function detail(Request $request, string $resource): Response
    {
        $routeParameters = $request->attribute('route_params', []);
        $id = is_array($routeParameters) && is_string($routeParameters['id'] ?? null)
            ? $this->validator->validateId($routeParameters['id'])
            : $this->validator->validateId('');

        return Response::success(
            $this->service->findActive($resource, $id),
            'Lấy thông tin địa giới hành chính thành công.',
        );
    }
}
