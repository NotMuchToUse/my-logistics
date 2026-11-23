<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

final class Crypto
{
    private const CIPHER = 'aes-256-gcm';
    private const IV_LENGTH = 12;
    private const TAG_LENGTH = 16;

    public static function encrypt(string $plainText): string
    {
        $iv = random_bytes(self::IV_LENGTH);
        $tag = '';
        $cipherText = openssl_encrypt(
            $plainText,
            self::CIPHER,
            self::encryptionKey(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH,
        );

        if ($cipherText === false || strlen($tag) !== self::TAG_LENGTH) {
            throw new ApiException('500_INTERNAL_ERROR', 'Không thể mã hóa dữ liệu nhạy cảm.');
        }

        return $iv . $tag . $cipherText;
    }

    public static function decrypt(string $binaryPayload): string
    {
        if (strlen($binaryPayload) < self::IV_LENGTH + self::TAG_LENGTH) {
            throw new ApiException('500_INTERNAL_ERROR', 'Dữ liệu mã hóa không hợp lệ.');
        }

        $iv = substr($binaryPayload, 0, self::IV_LENGTH);
        $tag = substr($binaryPayload, self::IV_LENGTH, self::TAG_LENGTH);
        $cipherText = substr($binaryPayload, self::IV_LENGTH + self::TAG_LENGTH);
        $plainText = openssl_decrypt(
            $cipherText,
            self::CIPHER,
            self::encryptionKey(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if ($plainText === false) {
            throw new ApiException('500_INTERNAL_ERROR', 'Không thể giải mã dữ liệu nhạy cảm.');
        }

        return $plainText;
    }

    public static function hashPhone(string $phone): string
    {
        $normalizedPhone = self::normalizePhone($phone);
        $hashKey = self::securityConfig()['pii_hash_key'] ?? '';
        if (!is_string($hashKey) || strlen($hashKey) < 32) {
            throw new RuntimeException('PII_HASH_KEY must contain at least 32 characters.');
        }

        return hash_hmac('sha256', $normalizedPhone, $hashKey);
    }

    public static function maskPhone(string $phone): string
    {
        $normalizedPhone = self::normalizePhone($phone);
        if (strlen($normalizedPhone) < 7) {
            return '***';
        }

        return substr($normalizedPhone, 0, 3) . '***' . substr($normalizedPhone, -4);
    }

    private static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '0084')) {
            $digits = '0' . substr($digits, 4);
        } elseif (str_starts_with($digits, '84')) {
            $digits = '0' . substr($digits, 2);
        }

        return $digits;
    }

    private static function encryptionKey(): string
    {
        $configuredKey = self::securityConfig()['app_key'] ?? '';
        if (!is_string($configuredKey) || $configuredKey === '') {
            throw new RuntimeException('APP_KEY is not configured.');
        }

        $decodedKey = base64_decode($configuredKey, true);
        if ($decodedKey === false || strlen($decodedKey) !== 32) {
            throw new RuntimeException('APP_KEY must be a Base64-encoded 32-byte key.');
        }

        return $decodedKey;
    }

    /**
     * @return array<string, mixed>
     */
    private static function securityConfig(): array
    {
        return require dirname(__DIR__, 2) . '/config/security.php';
    }
}
