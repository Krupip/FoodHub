<?php

declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? '';

if ($requestMethod !== 'POST') {
    header('Allow: POST');
    sendErrorResponse('Metode HTTP tidak diizinkan.', 405);
}

$user = requireAdmin();
requireCsrfForMutation();

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    sendErrorResponse('File foto wajib dipilih.', 422);
}

$file = $_FILES['image'];
$error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;

if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
    sendErrorResponse('Ukuran file foto melebihi batas maksimal (maksimal 5 MB).', 422);
}

if ($error === UPLOAD_ERR_NO_FILE) {
    sendErrorResponse('Tidak ada file foto yang dipilih.', 422);
}

if ($error !== UPLOAD_ERR_OK) {
    sendErrorResponse('Terjadi kesalahan saat mengunggah file foto.', 500);
}

// Batas ukuran maksimal 5 MB
$maxBytes = 5 * 1024 * 1024;
$fileSize = isset($file['size']) ? (int) $file['size'] : 0;
if ($fileSize > $maxBytes) {
    sendErrorResponse('Ukuran file foto terlalu besar. Maksimal 5 MB.', 422);
}

$tmpPath = isset($file['tmp_name']) && is_string($file['tmp_name']) ? $file['tmp_name'] : '';
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    sendErrorResponse('File yang diunggah tidak valid.', 422);
}

// Validasi format gambar dengan getimagesize()
$imageInfo = @getimagesize($tmpPath);
if ($imageInfo === false) {
    sendErrorResponse('File yang diunggah bukan merupakan gambar yang valid.', 422);
}

$mime = $imageInfo['mime'] ?? '';
$allowedMimes = [
    'image/jpeg' => '.jpg',
    'image/png' => '.png',
    'image/webp' => '.webp',
];

if (!isset($allowedMimes[$mime])) {
    sendErrorResponse('Format file tidak didukung. Harap unggah foto berformat JPG, PNG, atau WebP.', 422);
}

$ext = $allowedMimes[$mime];

$uploadDir = realpath(__DIR__ . '/../../../frontend/img');
if ($uploadDir === false) {
    $uploadDir = __DIR__ . '/../../../frontend/img';
}

$targetSubDir = $uploadDir . DIRECTORY_SEPARATOR . 'uploads';
if (!is_dir($targetSubDir)) {
    mkdir($targetSubDir, 0755, true);
}

$safeFilename = 'resep_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . $ext;
$targetFilePath = $targetSubDir . DIRECTORY_SEPARATOR . $safeFilename;

if (!move_uploaded_file($tmpPath, $targetFilePath)) {
    sendErrorResponse('Gagal menyimpan file foto ke server.', 500);
}

$imagePath = 'img/uploads/' . $safeFilename;

sendJsonResponse([
    'message' => 'Foto berhasil diunggah.',
    'image_path' => $imagePath,
], 201);
