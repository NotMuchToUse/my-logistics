<?php

declare(strict_types=1);

namespace App\Core;

use DateTimeImmutable;
use DateTimeZone;
use JsonException;

final class Response
{
    private function __construct(
        private readonly int $statusCode,
        private readonly string $jsonBody,
    ) {
    }

    public static function success(
        mixed $data,
        string $message = 'Thành công',
        int $statusCode = 200,
    ): self {
        return new self($statusCode, self::encode([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => [
                'timestamp' => self::timestamp(),
            ],
        ]));
    }

    /**
     * @param array<int, mixed> $items
     */
    public static function paginated(
        array $items,
        int $page,
        int $perPage,
        int $total,
        string $message = 'Thành công',
    ): self {
        $safePage = max(1, $page);
        $safePerPage = max(1, $perPage);
        $safeTotal = max(0, $total);

        return new self(200, self::encode([
            'success' => true,
            'message' => $message,
            'data' => $items,
            'meta' => [
                'pagination' => [
                    'page' => $safePage,
                    'per_page' => $safePerPage,
                    'total' => $safeTotal,
                    'total_pages' => (int) ceil($safeTotal / $safePerPage),
                ],
                'timestamp' => self::timestamp(),
            ],
        ]));
    }

    /**
     * @param array<string, mixed> $details
     */
    public static function error(
        string $errorCode,
        string $message,
        array $details = [],
        int $httpStatus = 400,
        ?string $traceId = null,
    ): self {
        $error = [
            'code' => $errorCode,
            'message' => $message,
            'details' => (object) $details,
        ];

        if ($traceId !== null) {
            $error['trace_id'] = $traceId;
        }

        return new self($httpStatus, self::encode([
            'success' => false,
            'error' => $error,
        ]));
    }

    public static function fromStoredJson(string $jsonBody, int $statusCode): self
    {
        try {
            json_decode($jsonBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new ApiException(
                '500_INTERNAL_ERROR',
                'Phản hồi Idempotency đã lưu không hợp lệ.',
                previous: $exception,
            );
        }

        return new self($statusCode, $jsonBody);
    }

    public static function noContent(): self
    {
        return new self(204, '');
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public function body(): string
    {
        return $this->jsonBody;
    }

    public function send(): void
    {
        http_response_code($this->statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        if ($this->statusCode !== 204) {
            echo $this->jsonBody;
        }
    }

    private static function timestamp(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone('+07:00')))->format(DATE_ATOM);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function encode(array $payload): string
    {
        try {
            return json_encode(
                $payload,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
            );
        } catch (JsonException $exception) {
            throw new ApiException(
                '500_INTERNAL_ERROR',
                'Không thể tạo phản hồi JSON.',
                previous: $exception,
            );
        }
    }
}
