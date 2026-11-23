<?php

declare(strict_types=1);

use App\Core\Response;
use App\Core\Request;
use App\Core\Router;

return static function (Router $router): void {
    $router->get('/api/v1/health', static function (Request $request): Response {
        return Response::success([
            'status' => 'ok',
            'timezone' => '+07:00',
        ]);
    });
};
