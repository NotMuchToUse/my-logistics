<?php

declare(strict_types=1);

namespace App\Core;

use finfo;
use RuntimeException;
use Throwable;

final class FileSecurityHelper
{
    private const MAX_IMAGE_BYTES = 5_242_880;
    private const MAX_IMAGE_PIXELS = 40_000_000;

    private const ALLOWED_IMAGE_MIMES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    /**
     * @param array{tmp_name: string, size: int, error: int} $uploadedFile
     */
    public static function sanitizeAndStoreImage(array $uploadedFile, string $targetDirectory): string
    {
        if (($uploadedFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ApiException('422_VALIDATION_ERROR', 'Tệp tải lên không hợp lệ.');
        }

        $temporaryPath = $uploadedFile['tmp_name'] ?? '';
        if (!is_string($temporaryPath) || !is_file($temporaryPath) || !is_uploaded_file($temporaryPath)) {
            throw new ApiException('422_VALIDATION_ERROR', 'Không tìm thấy tệp tải lên.');
        }

        $actualSize = filesize($temporaryPath);
        if ($actualSize === false || $actualSize > self::MAX_IMAGE_BYTES || $actualSize <= 0) {
            throw new ApiException('422_VALIDATION_ERROR', 'Ảnh phải có dung lượng tối đa 5 MB.');
        }

        $fileInfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $fileInfo->file($temporaryPath);
        if (!is_string($mimeType) || !isset(self::ALLOWED_IMAGE_MIMES[$mimeType])) {
            throw new ApiException('422_VALIDATION_ERROR', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
        }

        try {
            $imageSize = getimagesize($temporaryPath);
        } catch (Throwable) {
            throw new ApiException('422_VALIDATION_ERROR', 'Nội dung ảnh không hợp lệ.');
        }

        $expectedImageType = match ($mimeType) {
            'image/jpeg' => IMAGETYPE_JPEG,
            'image/png' => IMAGETYPE_PNG,
            'image/webp' => IMAGETYPE_WEBP,
        };
        if (
            $imageSize === false
            || $imageSize[2] !== $expectedImageType
            || ($imageSize[0] * $imageSize[1]) > self::MAX_IMAGE_PIXELS
        ) {
            throw new ApiException('422_VALIDATION_ERROR', 'Kích thước ảnh không hợp lệ.');
        }

        if (!is_dir($targetDirectory) || !is_writable($targetDirectory)) {
            throw new RuntimeException('Upload destination is unavailable.');
        }

        try {
            $image = match ($mimeType) {
                'image/jpeg' => imagecreatefromjpeg($temporaryPath),
                'image/png' => imagecreatefrompng($temporaryPath),
                'image/webp' => function_exists('imagecreatefromwebp')
                    ? imagecreatefromwebp($temporaryPath)
                    : false,
            };
        } catch (Throwable) {
            throw new ApiException('422_VALIDATION_ERROR', 'Không thể đọc nội dung ảnh.');
        }

        if ($image === false) {
            throw new ApiException('422_VALIDATION_ERROR', 'Không thể đọc nội dung ảnh.');
        }

        $fileName = UlidGenerator::generate() . '.' . self::ALLOWED_IMAGE_MIMES[$mimeType];
        $destinationPath = rtrim($targetDirectory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $fileName;

        try {
            if ($mimeType === 'image/png') {
                imagealphablending($image, false);
                imagesavealpha($image, true);
            }

            $saved = match ($mimeType) {
                'image/jpeg' => imagejpeg($image, $destinationPath, 88),
                'image/png' => imagepng($image, $destinationPath, 6),
                'image/webp' => function_exists('imagewebp') ? imagewebp($image, $destinationPath, 88) : false,
            };
        } finally {
            imagedestroy($image);
        }

        if (!$saved) {
            throw new RuntimeException('Unable to re-encode uploaded image.');
        }

        return $fileName;
    }

    public static function sanitizeSpreadsheetCell(string|int|float|null $value): string
    {
        if ($value === null) {
            return '';
        }

        $text = (string) $value;
        if ($text !== '' && preg_match('/^[=+\-@\t\r]/', $text) === 1) {
            return "'" . $text;
        }

        return $text;
    }
}
