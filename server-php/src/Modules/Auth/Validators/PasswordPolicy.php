<?php

declare(strict_types=1);

namespace App\Modules\Auth\Validators;

final class PasswordPolicy
{
    public static function isValid(string $password): bool
    {
        return strlen($password) >= 8
            && preg_match('/[a-z]/', $password) === 1
            && preg_match('/[A-Z]/', $password) === 1
            && preg_match('/[0-9]/', $password) === 1;
    }
}
