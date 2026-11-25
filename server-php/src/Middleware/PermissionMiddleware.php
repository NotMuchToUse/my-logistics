<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use InvalidArgumentException;
use PDO;

final class PermissionMiddleware implements MiddlewareInterface
{
    /**
     * @var list<string>
     */
    private readonly array $requiredPermissions;

    private readonly string $mode;

    public function __construct(
        PDO $pdo,
        string|array $requiredPermissions,
        string $mode = 'ALL',
    ) {
        $permissions = is_string($requiredPermissions) ? [$requiredPermissions] : $requiredPermissions;
        $permissions = array_values(array_unique(array_filter(
            array_map(
                static fn (mixed $permission): string => is_string($permission) ? trim($permission) : '',
                $permissions,
            ),
            static fn (string $permission): bool => $permission !== '',
        )));
        $normalizedMode = strtoupper(trim($mode));
        if ($permissions === [] || !in_array($normalizedMode, ['ALL', 'ANY'], true)) {
            throw new InvalidArgumentException('Permission middleware requires codes and an ALL or ANY mode.');
        }

        $this->requiredPermissions = $permissions;
        $this->mode = $normalizedMode;
    }

    public function process(Request $request, callable $next): Response
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để kiểm tra quyền truy cập.');
        }

        $roles = $auth['roles'] ?? null;
        $permissions = $auth['permissions'] ?? null;
        if (!is_array($roles) || !is_array($permissions)) {
            throw new ApiException('500_INTERNAL_ERROR', 'AuthContext thiếu vai trò hoặc quyền hạn.');
        }

        if (array_intersect(['system_admin', 'system_dev'], $roles) !== []) {
            return $next($request);
        }

        $hasPermission = $this->mode === 'ALL'
            ? array_diff($this->requiredPermissions, $permissions) === []
            : array_intersect($this->requiredPermissions, $permissions) !== [];
        if (!$hasPermission) {
            throw new ApiException(
                '403_FORBIDDEN',
                'Bạn không có quyền thực hiện chức năng này',
                ['required_permissions' => $this->requiredPermissions],
                403,
            );
        }

        return $next($request);
    }
}
