<?php

declare(strict_types=1);

function getDatabaseConnection(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $configPath = __DIR__ . '/database.local.php';

    if (!is_file($configPath)) {
        throw new RuntimeException(
            'Konfigurasi database belum tersedia. Ikuti petunjuk di backend/README.md.'
        );
    }

    if (!extension_loaded('pdo_mysql')) {
        throw new RuntimeException('Ekstensi PHP pdo_mysql belum aktif.');
    }

    $config = require $configPath;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'],
        $config['database']
    );

    try {
        $connection = new PDO($dsn, $config['username'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $exception) {
        error_log('FoodHub: koneksi database gagal. ' . $exception->getMessage());

        throw new RuntimeException(
            'Tidak dapat terhubung ke database. Periksa konfigurasi dan layanan MySQL/MariaDB.'
        );
    }

    return $connection;
}
