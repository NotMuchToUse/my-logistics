<?php

declare(strict_types=1);

namespace App\Core;

use App\Middleware\MiddlewareInterface;
use InvalidArgumentException;

final class Router
{
    /**
     * @var array<int, array{method: string, path: string, handler: callable, middleware: array<int, MiddlewareInterface>}>
     */
    private array $routes = [];

    /**
     * @var array<int, MiddlewareInterface>
     */
    private array $globalMiddleware = [];

    /**
     * @var array<int, array{prefix: string, middleware: array<int, MiddlewareInterface>}>
     */
    private array $groups = [
        ['prefix' => '', 'middleware' => []],
    ];

    public function use(MiddlewareInterface $middleware): void
    {
        $this->globalMiddleware[] = $middleware;
    }

    /**
     * @param array<int, MiddlewareInterface> $middleware
     */
    public function group(string $prefix, array $middleware, callable $registerRoutes): void
    {
        $parentGroup = $this->groups[array_key_last($this->groups)];
        $this->groups[] = [
            'prefix' => $this->joinPaths($parentGroup['prefix'], $prefix),
            'middleware' => [...$parentGroup['middleware'], ...$middleware],
        ];

        try {
            $registerRoutes($this);
        } finally {
            array_pop($this->groups);
        }
    }

    public function get(string $path, callable $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    public function post(string $path, callable $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    public function put(string $path, callable $handler, array $middleware = []): void
    {
        $this->add('PUT', $path, $handler, $middleware);
    }

    public function patch(string $path, callable $handler, array $middleware = []): void
    {
        $this->add('PATCH', $path, $handler, $middleware);
    }

    public function delete(string $path, callable $handler, array $middleware = []): void
    {
        $this->add('DELETE', $path, $handler, $middleware);
    }

    public function dispatch(Request $request): Response
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method()) {
                continue;
            }

            $parameters = $this->matchPath($route['path'], $request->path());
            if ($parameters === null) {
                continue;
            }

            $request->setAttribute('route_params', $parameters);
            return $this->runMiddleware(
                $request,
                $route['handler'],
                [...$this->globalMiddleware, ...$route['middleware']],
            );
        }

        $notFoundHandler = static function (Request $request): Response {
            throw new ApiException('404_NOT_FOUND', 'Không tìm thấy endpoint.');
        };

        return $this->runMiddleware($request, $notFoundHandler, $this->globalMiddleware);
    }

    /**
     * @param array<int, MiddlewareInterface> $middleware
     */
    private function add(string $method, string $path, callable $handler, array $middleware): void
    {
        foreach ($middleware as $item) {
            if (!$item instanceof MiddlewareInterface) {
                throw new InvalidArgumentException('Route middleware must implement MiddlewareInterface.');
            }
        }

        $group = $this->groups[array_key_last($this->groups)];
        $this->routes[] = [
            'method' => $method,
            'path' => $this->joinPaths($group['prefix'], $path),
            'handler' => $handler,
            'middleware' => [...$group['middleware'], ...$middleware],
        ];
    }

    /**
     * @return array<string, string>|null
     */
    private function matchPath(string $routePath, string $requestPath): ?array
    {
        $routeSegments = array_values(array_filter(explode('/', trim($routePath, '/')), 'strlen'));
        $requestSegments = array_values(array_filter(explode('/', trim($requestPath, '/')), 'strlen'));
        if (count($routeSegments) !== count($requestSegments)) {
            return null;
        }

        $parameters = [];
        foreach ($routeSegments as $index => $routeSegment) {
            if (preg_match('/^\{([A-Za-z_][A-Za-z0-9_]*)\}$/', $routeSegment, $matches) === 1) {
                $parameters[$matches[1]] = rawurldecode($requestSegments[$index]);
                continue;
            }

            if (rawurldecode($routeSegment) !== rawurldecode($requestSegments[$index])) {
                return null;
            }
        }

        return $parameters;
    }

    private function joinPaths(string $prefix, string $path): string
    {
        $segments = array_filter(
            [trim($prefix, '/'), trim($path, '/')],
            static fn (string $segment): bool => $segment !== '',
        );

        return '/' . implode('/', $segments);
    }

    /**
     * @param callable(Request): Response $handler
     * @param array<int, MiddlewareInterface> $middlewareChain
     */
    private function runMiddleware(Request $request, callable $handler, array $middlewareChain): Response
    {
        foreach (array_reverse($middlewareChain) as $middleware) {
            $nextHandler = $handler;
            $currentMiddleware = $middleware;
            $handler = static function (Request $currentRequest) use ($currentMiddleware, $nextHandler): Response {
                return $currentMiddleware->process($currentRequest, $nextHandler);
            };
        }

        $response = $handler($request);
        if (!$response instanceof Response) {
            throw new InvalidArgumentException('Route handlers must return a Response instance.');
        }

        return $response;
    }

    /**
     * @return array<int, array{method: string, path: string, middleware: array<int, MiddlewareInterface>}>
     */
    public function allRoutes(): array
    {
        $result = [];
        foreach ($this->routes as $route) {
            $result[] = [
                'method' => $route['method'],
                'path' => $route['path'],
                'middleware' => $route['middleware'],
            ];
        }

        return $result;
    }
}
