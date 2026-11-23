<?php

declare(strict_types=1);

namespace App\Core;

use JsonException;

final class Request
{
    /**
     * @var array<string, mixed>
     */
    private array $jsonBody;

    /**
     * @var array<string, mixed>
     */
    private array $attributes = [];

    /**
     * @param array<string, mixed> $queryParameters
     * @param array<string, mixed> $uploadedFiles
     * @param array<string, string> $headers
     */
    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $queryParameters,
        private readonly string $rawBody,
        private readonly array $uploadedFiles,
        array $headers,
        private readonly ?string $ipAddress,
        private readonly ?string $userAgent,
    ) {
        $this->headers = [];
        foreach ($headers as $name => $value) {
            $this->headers[strtolower($name)] = $value;
        }

        $this->jsonBody = $this->decodeJsonBody();
    }

    /**
     * @var array<string, string>
     */
    private array $headers;

    public static function fromGlobals(): self
    {
        $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($requestUri, PHP_URL_PATH);
        $headers = [];

        if (function_exists('getallheaders')) {
            $receivedHeaders = getallheaders();
            if (is_array($receivedHeaders)) {
                foreach ($receivedHeaders as $name => $value) {
                    if (is_string($value)) {
                        $headers[(string) $name] = $value;
                    }
                }
            }
        }

        foreach ($_SERVER as $name => $value) {
            if (!is_string($value)) {
                continue;
            }

            if (str_starts_with($name, 'HTTP_')) {
                $headerName = str_replace('_', '-', substr($name, 5));
                $headers[$headerName] ??= $value;
            } elseif (in_array($name, ['CONTENT_TYPE', 'CONTENT_LENGTH'], true)) {
                $headerName = str_replace('_', '-', $name);
                $headers[$headerName] ??= $value;
            }
        }

        $rawBody = file_get_contents('php://input');

        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            is_string($path) && $path !== '' ? $path : '/',
            $_GET,
            is_string($rawBody) ? $rawBody : '',
            $_FILES,
            $headers,
            isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : null,
            isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : null,
        );
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    /**
     * @return array<string, mixed>
     */
    public function queryParameters(): array
    {
        return $this->queryParameters;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->queryParameters[$key] ?? $default;
    }

    /**
     * @return array<string, mixed>
     */
    public function jsonBody(): array
    {
        return $this->jsonBody;
    }

    public function rawBody(): string
    {
        return $this->rawBody;
    }

    /**
     * @return array<string, mixed>
     */
    public function uploadedFiles(): array
    {
        return $this->uploadedFiles;
    }

    public function ipAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function userAgent(): ?string
    {
        return $this->userAgent;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function authorization(): ?string
    {
        return $this->header('Authorization');
    }

    public function branchIdHeader(): ?string
    {
        return $this->header('X-Branch-Id');
    }

    public function clientType(): ?string
    {
        return $this->header('X-Client-Type');
    }

    public function idempotencyKey(): ?string
    {
        return $this->header('Idempotency-Key');
    }

    public function setAttribute(string $name, mixed $value): void
    {
        $this->attributes[$name] = $value;
    }

    public function attribute(string $name, mixed $default = null): mixed
    {
        return $this->attributes[$name] ?? $default;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonBody(): array
    {
        if ($this->rawBody === '' || str_contains(strtolower($this->header('Content-Type') ?? ''), 'multipart/form-data')) {
            return [];
        }

        try {
            $decoded = json_decode($this->rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new ApiException(
                '400_BAD_REQUEST',
                'JSON request body không hợp lệ.',
                previous: $exception,
            );
        }

        if (!is_array($decoded)) {
            throw new ApiException('400_BAD_REQUEST', 'JSON request body phải là một đối tượng hoặc mảng.');
        }

        return $decoded;
    }
}
