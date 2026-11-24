<?php

declare(strict_types=1);

namespace App\Modules\Auth\DTOs;

final class ChangePasswordDto
{
    public function __construct(
        public readonly string $current_password,
        public readonly string $new_password,
        public readonly string $new_password_confirmation,
    ) {
    }

    /**
     * @param array<string, mixed> $input
     */
    public static function fromArray(array $input): self
    {
        return new self(
            current_password: (string) $input['current_password'],
            new_password: (string) $input['new_password'],
            new_password_confirmation: (string) $input['new_password_confirmation'],
        );
    }
}
