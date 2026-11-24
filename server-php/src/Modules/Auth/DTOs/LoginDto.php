<?php

declare(strict_types=1);

namespace App\Modules\Auth\DTOs;

final class LoginDto
{
    public function __construct(
        public readonly string $identifier,
        public readonly string $password,
    ) {
    }

    /**
     * @param array<string, mixed> $input
     */
    public static function fromArray(array $input): self
    {
        $identifier = $input['identifier'] ?? $input['email'] ?? '';

        return new self(
            identifier: trim((string) $identifier),
            password: (string) $input['password'],
        );
    }
}
