<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;

final class CorsMiddleware implements MiddlewareInterface
{
    /**
     * @param array{allowed_origins: array<int, string>, allowed_client_types: array<int, string>} $config
     */
    public function __construct(private readonly array $config)
    {
    }

    public function process(Request $request, callable $next): Response
    {
        $origin = $request->header('Origin');
        $allowedOrigins = $this->config['allowed_origins'];
        if ($origin !== null && !in_array($origin, $allowedOrigins, true)) {
            throw new ApiException('403_FORBIDDEN', 'Origin này không được phép truy cập API.');
        }

        header('Vary: Origin');
        if ($origin !== null) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Accept, Authorization, Content-Type, X-Branch-Id, X-Client-Type, Idempotency-Key');
        header('Access-Control-Max-Age: 600');

        if ($request->method() === 'OPTIONS') {
            return Response::noContent();
        }

        $clientType = $request->clientType();
        if ($clientType === null || !in_array($clientType, $this->config['allowed_client_types'], true)) {
            throw new ApiException('400_BAD_REQUEST', 'Header X-Client-Type bắt buộc và phải hợp lệ.');
        }

        $accept = strtolower($request->header('Accept') ?? '');
        if (!str_contains($accept, 'application/json')) {
            throw new ApiException('400_BAD_REQUEST', 'Header Accept phải chứa application/json.');
        }

        if (in_array($request->method(), ['POST', 'PUT', 'PATCH'], true)) {
            $contentType = strtolower($request->header('Content-Type') ?? '');
            if (
                !str_contains($contentType, 'application/json')
                && !str_contains($contentType, 'multipart/form-data')
            ) {
                throw new ApiException('400_BAD_REQUEST', 'Content-Type phải là JSON hoặc multipart/form-data.');
            }
        }

        return $next($request);
    }
}
