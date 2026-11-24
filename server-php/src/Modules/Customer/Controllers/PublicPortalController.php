<?php

declare(strict_types=1);

namespace App\Modules\Customer\Controllers;

use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\Customer\Repositories\PublicPortalRepository;

final class PublicPortalController extends BaseController
{
    public function __construct(private readonly PublicPortalRepository $repository)
    {
    }

    public function tracking(Request $request): Response
    {
        $params = $request->attribute('route_params');
        $trackingCode = is_array($params) ? (string) ($params['tracking_code'] ?? '') : '';

        return Response::success(
            $this->repository->trackShipment($trackingCode),
            'Tra cứu hành trình vận đơn thành công.',
        );
    }

    public function branches(Request $request): Response
    {
        return Response::success(
            $this->repository->searchBranchesWithGps($request->queryParameters()),
            'Lấy danh sách bưu cục thành công.',
        );
    }

    public function calculateRate(Request $request): Response
    {
        return Response::success(
            $this->repository->calculateRate($request->jsonBody()),
            'Tính cước vận chuyển tạm tính thành công.',
        );
    }
}