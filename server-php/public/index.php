<?php

declare(strict_types=1);

use App\Core\ErrorHandler;
use App\Core\Request;
use App\Core\Router;
use App\Middleware\CorsMiddleware;
use Dotenv\Dotenv;

$projectRoot = dirname(__DIR__);
require $projectRoot . '/vendor/autoload.php';

Dotenv::createImmutable($projectRoot)->safeLoad();
$appConfig = require $projectRoot . '/config/app.php';
date_default_timezone_set($appConfig['timezone'] === '+07:00' ? 'Asia/Ho_Chi_Minh' : $appConfig['timezone']);
ErrorHandler::register();

try {
    $request = Request::fromGlobals();
    ErrorHandler::setCurrentRequest($request);

    $router = new Router();
    $router->use(new CorsMiddleware(require $projectRoot . '/config/cors.php'));

    $routeFiles = [
        'Auth',
        'MasterData',
        'NetworkOrg',
        'Customer',
        'Pickup',
        'Shipment',
        'Warehouse',
        'Finance',
        'IncidentCompensation',
        'ReportsAdmin',
    ];

    foreach ($routeFiles as $moduleName) {
        $registerRoutes = require $projectRoot . '/src/Modules/' . $moduleName . '/routes.php';
        $registerRoutes($router);
    }

    $router->dispatch($request)->send();
} catch (Throwable $exception) {
    ErrorHandler::handle($exception);
}
