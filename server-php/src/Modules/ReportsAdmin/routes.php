<?php

declare(strict_types=1);

use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Modules\ReportsAdmin\Services\ApiDocsCatalog;

return static function (Router $router): void {
    $router->get('/api/v1/health', static function (Request $request): Response {
        return Response::success([
            'status' => 'ok',
            'timezone' => '+07:00',
        ]);
    });

    $router->get('/api/v1/docs/spec', static function (Request $request) use ($router): Response {
        $catalog = new ApiDocsCatalog();
        return Response::success($catalog->build($router), 'Lấy tài liệu đặc tả API thành công.');
    });
};