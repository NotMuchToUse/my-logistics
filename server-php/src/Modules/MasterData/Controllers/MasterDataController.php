<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Controllers;

use App\Core\ApiException;
use App\Core\BaseController;
use App\Core\Request;
use App\Core\Response;
use App\Modules\MasterData\Services\MasterDataService;
use App\Modules\MasterData\Validators\MasterDataWriteValidator;
use App\Modules\MasterData\Validators\GeographyQueryValidator;

final class MasterDataController extends BaseController
{
    public function __construct(
        private readonly MasterDataService $service,
        private readonly MasterDataWriteValidator $writeValidator,
        private readonly GeographyQueryValidator $idValidator,
    ) {
    }

    public function serviceTypes(Request $request): Response
    {
        [$page, $perPage] = $this->pagination($request);
        $result = $this->service->paginateServiceTypes($page, $perPage, $this->search($request));
        return $this->paginatedResponse($result['items'], $page, $perPage, $result['total'], 'Lấy danh sách dịch vụ thành công.');
    }

    public function serviceType(Request $request): Response
    {
        $id = $this->id($request);
        return Response::success($this->service->findServiceType($id), 'Lấy thông tin dịch vụ thành công.');
    }

    public function createServiceType(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->createServiceType($this->writeValidator->serviceType($request->jsonBody()));
        return Response::success($record, 'Tạo dịch vụ thành công.', 201);
    }

    public function updateServiceType(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->updateServiceType(
            $this->id($request),
            $this->writeValidator->serviceType($request->jsonBody()),
        );
        return Response::success($record, 'Cập nhật dịch vụ thành công.');
    }

    public function deleteServiceType(Request $request): Response
    {
        $this->authorize($request);
        $this->service->softDeleteServiceType($this->id($request));
        return Response::success(null, 'Ngừng hoạt động dịch vụ thành công.');
    }

    public function valueAddedServices(Request $request): Response
    {
        [$page, $perPage] = $this->pagination($request);
        $result = $this->service->paginateValueAddedServices($page, $perPage, $this->search($request));
        return $this->paginatedResponse($result['items'], $page, $perPage, $result['total'], 'Lấy danh sách dịch vụ gia tăng thành công.');
    }

    public function valueAddedService(Request $request): Response
    {
        return Response::success(
            $this->service->findValueAddedService($this->id($request)),
            'Lấy thông tin dịch vụ gia tăng thành công.',
        );
    }

    public function createValueAddedService(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->createValueAddedService(
            $this->writeValidator->valueAddedService($request->jsonBody()),
        );
        return Response::success($record, 'Tạo dịch vụ gia tăng thành công.', 201);
    }

    public function updateValueAddedService(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->updateValueAddedService(
            $this->id($request),
            $this->writeValidator->valueAddedService($request->jsonBody()),
        );
        return Response::success($record, 'Cập nhật dịch vụ gia tăng thành công.');
    }

    public function deleteValueAddedService(Request $request): Response
    {
        $this->authorize($request);
        $this->service->softDeleteValueAddedService($this->id($request));
        return Response::success(null, 'Ngừng hoạt động dịch vụ gia tăng thành công.');
    }

    public function surcharges(Request $request): Response
    {
        [$page, $perPage] = $this->pagination($request);
        $result = $this->service->paginateSurcharges($page, $perPage, $this->search($request));
        return $this->paginatedResponse($result['items'], $page, $perPage, $result['total'], 'Lấy danh sách phụ phí thành công.');
    }

    public function surcharge(Request $request): Response
    {
        return Response::success($this->service->findSurcharge($this->id($request)), 'Lấy thông tin phụ phí thành công.');
    }

    public function createSurcharge(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->createSurcharge($this->writeValidator->surcharge($request->jsonBody()));
        return Response::success($record, 'Tạo phụ phí thành công.', 201);
    }

    public function updateSurcharge(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->updateSurcharge(
            $this->id($request),
            $this->writeValidator->surcharge($request->jsonBody()),
        );
        return Response::success($record, 'Cập nhật phụ phí thành công.');
    }

    public function deleteSurcharge(Request $request): Response
    {
        $this->authorize($request);
        $this->service->softDeleteSurcharge($this->id($request));
        return Response::success(null, 'Ngừng hoạt động phụ phí thành công.');
    }

    public function pricingTariffs(Request $request): Response
    {
        [$page, $perPage] = $this->pagination($request);
        $result = $this->service->paginatePricingTariffs($page, $perPage, $this->search($request));
        return $this->paginatedResponse($result['items'], $page, $perPage, $result['total'], 'Lấy danh sách bảng giá thành công.');
    }

    public function pricingTariff(Request $request): Response
    {
        return Response::success($this->service->findPricingTariff($this->id($request)), 'Lấy thông tin bảng giá thành công.');
    }

    public function createPricingTariff(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->createPricingTariff($this->writeValidator->pricingTariff($request->jsonBody()));
        return Response::success($record, 'Tạo bảng giá thành công.', 201);
    }

    public function updatePricingTariff(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->updatePricingTariff(
            $this->id($request),
            $this->writeValidator->pricingTariff($request->jsonBody()),
        );
        return Response::success($record, 'Cập nhật bảng giá thành công.');
    }

    public function deletePricingTariff(Request $request): Response
    {
        $this->authorize($request);
        $this->service->softDeletePricingTariff($this->id($request));
        return Response::success(null, 'Ngừng hoạt động bảng giá thành công.');
    }

    public function weightConversionRules(Request $request): Response
    {
        [$page, $perPage] = $this->pagination($request);
        $result = $this->service->paginateWeightConversionRules($page, $perPage, $this->search($request));
        return $this->paginatedResponse($result['items'], $page, $perPage, $result['total'], 'Lấy danh sách quy tắc quy đổi trọng lượng thành công.');
    }

    public function weightConversionRule(Request $request): Response
    {
        return Response::success(
            $this->service->findWeightConversionRule($this->id($request)),
            'Lấy thông tin quy tắc quy đổi trọng lượng thành công.',
        );
    }

    public function createWeightConversionRule(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->createWeightConversionRule(
            $this->writeValidator->weightConversionRule($request->jsonBody()),
        );
        return Response::success($record, 'Tạo quy tắc quy đổi trọng lượng thành công.', 201);
    }

    public function updateWeightConversionRule(Request $request): Response
    {
        $this->authorize($request);
        $record = $this->service->updateWeightConversionRule(
            $this->id($request),
            $this->writeValidator->weightConversionRule($request->jsonBody()),
        );
        return Response::success($record, 'Cập nhật quy tắc quy đổi trọng lượng thành công.');
    }

    public function deleteWeightConversionRule(Request $request): Response
    {
        $this->authorize($request);
        $this->service->softDeleteWeightConversionRule($this->id($request));
        return Response::success(null, 'Ngừng hoạt động quy tắc quy đổi trọng lượng thành công.');
    }

    private function pagination(Request $request): array
    {
        $parameters = $this->paginationParameters($request);
        return [$parameters['page'], $parameters['per_page']];
    }

    private function search(Request $request): ?string
    {
        $search = $request->query('search');
        if (!is_string($search) || trim($search) === '') {
            return null;
        }

        $normalized = trim($search);
        if (mb_strlen($normalized) > 100) {
            throw new ApiException('422_VALIDATION_ERROR', 'Từ khóa tìm kiếm không hợp lệ.', [
                'search' => ['Từ khóa không được vượt quá 100 ký tự.'],
            ]);
        }

        return $normalized;
    }

    private function id(Request $request): int
    {
        $routeParameters = $request->attribute('route_params', []);
        $id = is_array($routeParameters) ? ($routeParameters['id'] ?? '') : '';
        return $this->idValidator->validateId(is_string($id) ? $id : '');
    }

    private function authorize(Request $request): void
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để quản lý danh mục.');
        }
        $this->service->assertMasterDataAdmin((int) $auth['user_id']);
    }
}
