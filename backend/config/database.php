<?php
/**
 * Konfigurasi koneksi database FoodHub.
 * Sesuaikan nilai di bawah ini jika setting MySQL kamu berbeda
 * (default XAMPP: user "root" tanpa password).
 */

const DB_HOST = 'localhost';
const DB_PORT = 3306;
const DB_USER = 'root';
const DB_PASS = '';
const DB_NAME = 'foodhub';

/**
 * Mengembalikan satu koneksi mysqli yang dipakai bersama
 * (dibuat sekali saja per request).
 */
function db(): mysqli
{
    static $conn = null;

    if ($conn === null) {
        // Lempar exception bila ada error query, jadi tidak ada error yang terlewat
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
        $conn->set_charset('utf8mb4');
    }

    return $conn;
}
