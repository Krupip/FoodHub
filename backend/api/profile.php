<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

requireLogin();
requireCsrfForMutation();
session_write_close();

sendErrorResponse('Fitur profil belum diimplementasikan.', 501);
