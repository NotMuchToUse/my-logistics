<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\BranchScopeMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Modules\NetworkOrg\Controllers\NetworkOrgController;
use App\Modules\NetworkOrg\Repositories\NetworkOrgRepository;

return static function (Router $router): void {
    $pdo = Database::getConnection();
    $controller = new NetworkOrgController(new NetworkOrgRepository($pdo));
    $auth = new AuthMiddleware($pdo);
    $branchScope = new BranchScopeMiddleware($pdo);

    $router->get('/api/v1/branches', [$controller, 'indexBranches'], [$auth, new PermissionMiddleware($pdo, 'network.read'), $branchScope]);
    $router->post('/api/v1/branches', [$controller, 'createBranch'], [$auth, new PermissionMiddleware($pdo, 'network.manage'), $branchScope]);
    $router->patch('/api/v1/branches/{public_id}', [$controller, 'updateBranch'], [$auth, new PermissionMiddleware($pdo, 'network.manage'), $branchScope]);

    $router->get('/api/v1/warehouses', [$controller, 'indexWarehouses'], [$auth, new PermissionMiddleware($pdo, 'network.read'), $branchScope]);
    $router->post('/api/v1/warehouses', [$controller, 'createWarehouse'], [$auth, new PermissionMiddleware($pdo, 'network.manage'), $branchScope]);
    $router->patch('/api/v1/warehouses/{public_id}', [$controller, 'updateWarehouse'], [$auth, new PermissionMiddleware($pdo, 'network.manage'), $branchScope]);

    $router->get('/api/v1/roles', [$controller, 'indexRoles'], [$auth, new PermissionMiddleware($pdo, 'users.read'), $branchScope]);
    $router->get('/api/v1/users', [$controller, 'indexUsers'], [$auth, new PermissionMiddleware($pdo, 'users.read'), $branchScope]);
    $router->get('/api/v1/users/{public_id}', [$controller, 'showUser'], [$auth, new PermissionMiddleware($pdo, 'users.read'), $branchScope]);
    $router->post('/api/v1/users', [$controller, 'createUser'], [$auth, new PermissionMiddleware($pdo, 'users.manage'), $branchScope]);
    $router->patch('/api/v1/users/{public_id}', [$controller, 'updateUser'], [$auth, new PermissionMiddleware($pdo, 'users.manage'), $branchScope]);
    $router->put('/api/v1/users/{public_id}/roles', [$controller, 'assignRoles'], [$auth, new PermissionMiddleware($pdo, 'users.assign_role'), $branchScope]);
    $router->put('/api/v1/users/{public_id}/branch-scopes', [$controller, 'assignBranchScopes'], [$auth, new PermissionMiddleware($pdo, 'users.assign_branch_scope'), $branchScope]);
};