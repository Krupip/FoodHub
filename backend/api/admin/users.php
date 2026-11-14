<?php

declare(strict_types=1);

require_once __DIR__ . '/../../includes/bootstrap.php';

requireAdmin();
requireCsrfForMutation();
session_write_close();

sendErrorResponse('Fitur kelola pengguna belum diimplementasikan.', 501);
