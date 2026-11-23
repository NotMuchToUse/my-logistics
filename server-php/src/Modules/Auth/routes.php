<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\IdempotencyMiddleware;
use App\Modules\Auth\Controllers\AuthController;
use App\Modules\Auth\Repositories\AuditLogRepository;
use App\Modules\Auth\Repositories\AuthUserRepository;
use App\Modules\Auth\Repositories\ConsentRepository;
use App\Modules\Auth\Repositories\LoginAttemptRepository;
use App\Modules\Auth\Repositories\TokenRepository;
use App\Modules\Auth\Services\AuthService;
use App\Modules\Auth\Validators\ChangePasswordValidator;
use App\Modules\Auth\Validators\LoginValidator;
use App\Modules\Auth\Validators\RegisterValidator;

return static function (Router $router): void {
    $pdo = Database::getConnection();
    $controller = new AuthController(
        new AuthService(
            $pdo,
            new AuthUserRepository($pdo),
            new TokenRepository($pdo),
            new LoginAttemptRepository($pdo),
            new ConsentRepository($pdo),
            new AuditLogRepository($pdo),
            require dirname(__DIR__, 3) . '/config/security.php',
        ),
        new RegisterValidator(),
        new LoginValidator(),
        new ChangePasswordValidator(),
    );
    $authMiddleware = new AuthMiddleware($pdo);

    $router->post(
        '/api/v1/auth/register',
        [$controller, 'register'],
        [new IdempotencyMiddleware($pdo)],
    );
    $router->post('/api/v1/auth/login', [$controller, 'login']);
    $router->get('/api/v1/auth/me', [$controller, 'me'], [$authMiddleware]);
    $router->post('/api/v1/auth/change-password', [$controller, 'changePassword'], [$authMiddleware]);
    $router->post('/api/v1/auth/logout', [$controller, 'logout'], [$authMiddleware]);
};
