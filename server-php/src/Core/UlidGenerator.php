<?php

declare(strict_types=1);

namespace App\Core;

use OverflowException;

final class UlidGenerator
{
    private const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    private static ?int $lastTimestampMilliseconds = null;
    private static string $lastRandomness = '';

    public static function generate(): string
    {
        $timestampMilliseconds = (int) floor(microtime(true) * 1000);
        if (
            self::$lastTimestampMilliseconds !== null
            && $timestampMilliseconds <= self::$lastTimestampMilliseconds
        ) {
            $timestampMilliseconds = self::$lastTimestampMilliseconds;
            self::$lastRandomness = self::incrementRandomness(self::$lastRandomness);
        } else {
            self::$lastRandomness = random_bytes(10);
        }

        self::$lastTimestampMilliseconds = $timestampMilliseconds;
        $timestampHigh = intdiv($timestampMilliseconds, 65_536);
        $timestampLow = $timestampMilliseconds % 65_536;
        $bytes = pack('Nn', $timestampHigh, $timestampLow) . self::$lastRandomness;
        $ulid = '';

        for ($characterIndex = 0; $characterIndex < 26; $characterIndex++) {
            $value = 0;
            for ($bitIndex = 0; $bitIndex < 5; $bitIndex++) {
                $sourceBit = ($characterIndex * 5) + $bitIndex - 2;
                $value <<= 1;
                if ($sourceBit >= 0) {
                    $byte = ord($bytes[intdiv($sourceBit, 8)]);
                    $value |= ($byte >> (7 - ($sourceBit % 8))) & 1;
                }
            }

            $ulid .= self::ALPHABET[$value];
        }

        return $ulid;
    }

    private static function incrementRandomness(string $randomness): string
    {
        for ($index = strlen($randomness) - 1; $index >= 0; $index--) {
            $byte = ord($randomness[$index]);
            if ($byte < 255) {
                $randomness[$index] = chr($byte + 1);
                return $randomness;
            }

            $randomness[$index] = "\0";
        }

        throw new OverflowException('ULID entropy exhausted for the current millisecond.');
    }
}
