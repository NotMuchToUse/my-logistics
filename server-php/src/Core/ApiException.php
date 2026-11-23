<?php

declare(strict_types=1);

namespace App\Core;

use InvalidArgumentException;
use RuntimeException;
use Throwable;

final class ApiException extends RuntimeException
{
    public readonly int $httpStatus;

    private const ERROR_STATUSES = [
        '400_BAD_REQUEST' => 400,
        '401_UNAUTHORIZED' => 401,
        '403_FORBIDDEN' => 403,
        '403_BRANCH_SCOPE' => 403,
        '404_NOT_FOUND' => 404,
        '409_VERSION_CONFLICT' => 409,
        '409_IDEMPOTENCY_DUPLICATE' => 409,
        '422_VALIDATION_ERROR' => 422,
        '429_TOO_MANY_REQUESTS' => 429,
        '500_INTERNAL_ERROR' => 500,
    ];

    /**
     * @param array<string, mixed> $details
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
        ?int $httpStatus = null,
        ?Throwable $previous = null,
    ) {
        $expectedStatus = self::ERROR_STATUSES[$errorCode] ?? null;
        if ($expectedStatus === null) {
            throw new InvalidArgumentException('Unsupported API error code.');
        }

        if ($httpStatus !== null && $httpStatus !== $expectedStatus) {
            throw new InvalidArgumentException('HTTP status does not match the API error code.');
        }

        $this->httpStatus = $expectedStatus;
        parent::__construct($message, $expectedStatus, $previous);
    }
}
