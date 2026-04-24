<?php
date_default_timezone_set('Asia/Kuala_Lumpur');

// Only set JSON header if this file is accessed directly (not included)
if (!defined('API_JWT_INCLUDED')) {
    header('Content-Type: application/json');
}

// Start session if not already started (PHP 5.3 compatible)
if (session_id() == '') {
    session_start();
}

// Include database connection
$connect = 1;
include(__DIR__ . '/../common/index_adv.php');

if (!isset($conn)) {
    die(json_encode(array("status" => 500, "message" => "Database connection error")));
}

// Get staff information from session
$staff_id = null;
$department = null;
$status_semasa = null;
$outlet = null;

if (isset($_SESSION["myusername"])) {
    $username = $_SESSION["myusername"];
    $query = "select * from staff where username = '$username' and recycle!=1";
    $result = $conn->query($query);

    if ($result->num_rows > 0) {
        while ($rows = $result->fetch_assoc()) {
            $staff_id = stripslashes($rows['id']);
            $department = stripslashes($rows['department']);
            $status_semasa = stripslashes($rows['status_semasa']);
            $outlet = stripslashes($rows['outlet']);
            $consult_call = stripslashes($rows['consult_call']);
        }
    }
}

/**
 * Log JWT API operations for monitoring and debugging
 * @param string $operation Operation name (e.g., 'getJWTToken')
 * @param string $message Log message describing the event
 * @param mixed $data Optional context data (will be JSON encoded if array)
 * @param string $level Log level: INFO, WARNING, ERROR
 * @return bool Success status of log write operation
 */
function logJWTOperation($operation, $message, $data = null, $level = 'INFO')
{
    $log_dir = __DIR__ . '/logs';
    $log_file = $log_dir . '/jwt_operations.log';

    // Create logs directory if it doesn't exist
    if (!is_dir($log_dir)) {
        if (!@mkdir($log_dir, 0755, true)) {
            @mkdir($log_dir, 0755);
        }
    }

    // Verify logs directory exists
    if (!is_dir($log_dir)) {
        return false;
    }

    // Ensure directory is writable
    if (!is_writable($log_dir)) {
        @chmod($log_dir, 0755);
    }

    // Build log message
    $timestamp = date('Y-m-d H:i:s');
    $env = getEnvironment();
    $log_message = "[$timestamp] [$env.$level] [$operation] $message";

    // Append data if provided
    if ($data !== null) {
        if (is_array($data)) {
            $log_message .= ' | ' . json_encode($data);
        } else {
            $log_message .= ' | ' . $data;
        }
    }

    $log_message .= "\n";

    // Write to log file with fallback
    $result = @file_put_contents($log_file, $log_message, FILE_APPEND);

    // If write failed and file doesn't exist, create it
    if ($result === false && !file_exists($log_file)) {
        @touch($log_file);
        @chmod($log_file, 0644);
        $result = @file_put_contents($log_file, $log_message, FILE_APPEND);
    }

    return $result !== false;
}

/**
 * Get current environment (local or production)
 * @return string Environment name ('local' or 'production')
 */
function getEnvironment()
{
    // Check if running on localhost (PHP 5.3 compatible)
    $serverName = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '';
    $httpHost = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';

    $isLocal = in_array($serverName, array('localhost', '127.0.0.1')) ||
        strpos($serverName, 'localhost') !== false ||
        strpos($httpHost, 'localhost') !== false ||
        strpos($httpHost, '127.0.0.1') !== false;

    return $isLocal ? 'local' : 'production';
}

/**
 * Get API host based on environment (auto-detect)
 * @return string API host URL
 */
function getApiHost()
{
    $env = getEnvironment();

    if ($env === 'local') {
        // return 'http://127.0.0.1:8000/api/v1/consult-call/';
         return 'http://127.0.0.1:8001/api/v1/consult-call/';
    } else {
        return 'http://mytotalhealth.com.my/production/api/v1/consult-call/'; //production
    }
}

/**
 * Get staff information for JWT authentication
 * @param int $staff_id Staff ID from session
 * @return array Staff data or null if not found
 */
function getStaffAuthData($staff_id)
{
    global $conn;

    $staff_id = mysqli_real_escape_string($conn, $staff_id);

    logJWTOperation(
        'getStaffAuthData',
        'Retrieving staff authentication data',
        array('staff_id' => $staff_id),
        'INFO'
    );

    $query = "SELECT id, department, status_semasa, outlet, consult_call FROM staff WHERE id = $staff_id";
    $result = mysqli_query($conn, $query);

    if (!$result) {
        logJWTOperation(
            'getStaffAuthData',
            'Database query failed',
            array('staff_id' => $staff_id, 'error' => mysqli_error($conn)),
            'ERROR'
        );
        return null;
    }

    $row = mysqli_fetch_assoc($result);
    if (!$row) {
        logJWTOperation(
            'getStaffAuthData',
            'Staff not found',
            array('staff_id' => $staff_id),
            'WARNING'
        );
        return null;
    }

    // Convert outlet string to array of integers
    $outlet = array();
    if (!empty($row['outlet'])) {
        $outletArray = explode(',', $row['outlet']);
        foreach ($outletArray as $outletId) {
            $outlet[] = (int)trim($outletId);
        }
    }

    // Prepare return data
    $returnData = array(
        'staff_id' => (int)$row['id'],
        'staff_department_id' => (int)$row['department'],
        'status_semasa' => $row['status_semasa'],
        'outlet' => $outlet,
        'consult_call' => isset($row['consult_call']) ? (int)$row['consult_call'] : 2
    );

    // Dev role override: localhost only, for testing different roles without re-login
    if (getEnvironment() === 'local' && isset($_SESSION['dev_role_override'])) {
        $returnData['consult_call'] = (int)$_SESSION['dev_role_override'];
        logJWTOperation(
            'getStaffAuthData',
            'Dev role override applied',
            array('staff_id' => $staff_id, 'override_role' => $returnData['consult_call']),
            'WARNING'
        );
    }

    // Return in the format expected by JWT API
    return $returnData;
}

/**
 * Get JWT token from the consult call API
 * @param int $staff_id Staff ID
 * @param int $staff_department_id Staff department ID
 * @param string $status_semasa Staff status
 * @param array $outlet Outlet IDs array
 * @param int $consult_call role
 * @return string|null JWT token or null on failure
 */
function getJWTToken($staff_id, $staff_department_id, $status_semasa, $outlet, $consult_call)
{
    logJWTOperation(
        'getJWTToken',
        'Requesting new JWT token',
        array('staff_id' => $staff_id),
        'INFO'
    );

    $host = getApiHost();
    $url = $host . 'auth';

    $authData = array(
        'staff_id' => (int)$staff_id,
        'staff_department_id' => (int)$staff_department_id,
        'status_semasa' => $status_semasa,
        'outlet' => $outlet,
        'consult_call' => $consult_call
    );

    $headers = array(
        'Accept: application/json',
        'Content-Type: application/json'
    );

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($authData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    // Log the API request
    logJWTOperation(
        'getJWTToken',
        'Calling auth API',
        array(
            'endpoint' => $url,
            'method' => 'POST',
            'staff_id' => $staff_id
        ),
        'INFO'
    );

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        $error_data = json_decode($response, true);
        logJWTOperation(
            'getJWTToken',
            'Failed to obtain JWT token',
            array(
                'httpCode' => $httpCode,
                'staff_id' => $staff_id,
                'error' => $error ? $error : (isset($error_data['message']) ? $error_data['message'] : 'Unknown error'),
                'response' => $response
            ),
            'ERROR'
        );

        error_log("JWT Auth failed: HTTP $httpCode, Error: $error, Response: $response");
        return null;
    }

    logJWTOperation(
        'getJWTToken',
        'JWT token obtained successfully',
        array('httpCode' => $httpCode, 'staff_id' => $staff_id),
        'INFO'
    );

    $decoded = json_decode($response, true);
    return isset($decoded['token']) ? $decoded['token'] : null;
}

/**
 * Get or refresh JWT token with caching
 * @param int $staff_id Staff ID from session
 * @return string|null JWT token or null on failure
 */
function getAuthToken($staff_id)
{
    // Check if token exists in session and is still valid (basic check)
    if (
        isset($_SESSION['jwt_token']) && isset($_SESSION['jwt_expires']) &&
        time() < $_SESSION['jwt_expires']
    ) {
        logJWTOperation(
            'getAuthToken',
            'Using cached token',
            array('staff_id' => $staff_id, 'expiry' => date('Y-m-d H:i:s', $_SESSION['jwt_expires'])),
            'INFO'
        );
        return $_SESSION['jwt_token'];
    } else if (isset($_SESSION['jwt_expires'])) {
        logJWTOperation(
            'getAuthToken',
            'Cached token expired, refreshing',
            array('staff_id' => $staff_id, 'expired_at' => date('Y-m-d H:i:s', $_SESSION['jwt_expires'])),
            'WARNING'
        );
    }

    // Get staff data for authentication
    $staffData = getStaffAuthData($staff_id);

    if (!$staffData) {
        error_log("Staff data not found for ID: $staff_id");
        return null;
    }

    // Get new JWT token
    $token = getJWTToken(
        $staffData['staff_id'],
        $staffData['staff_department_id'],
        $staffData['status_semasa'],
        $staffData['outlet'],
        $staffData['consult_call']
    );

    if ($token) {
        // Store token in session (expires in 1 hour - adjust as needed)
        $_SESSION['jwt_token'] = $token;
        $_SESSION['jwt_expires'] = time() + 3600; // 1 hour
        $_SESSION['jwt_staff_id'] = $staff_id;

        logJWTOperation(
            'getAuthToken',
            'New token cached',
            array('staff_id' => $staff_id, 'expiry' => date('Y-m-d H:i:s', $_SESSION['jwt_expires'])),
            'INFO'
        );
    } else {
        logJWTOperation(
            'getAuthToken',
            'Failed to get auth token',
            array('staff_id' => $staff_id),
            'ERROR'
        );
    }

    return $token;
}

/**
 * Make API call with JWT authentication
 * @param string $endpoint API endpoint
 * @param array|null $data Request data
 * @param string $method HTTP method
 * @param int $staff_id Staff ID for authentication
 * @return array API response
 */
function getApiDataWithJWT($endpoint, $data = null, $method = 'GET', $staff_id = null)
{
    logJWTOperation(
        'getApiDataWithJWT',
        'Starting API call',
        array(
            'endpoint' => $endpoint,
            'method' => $method,
            'staff_id' => $staff_id,
            'has_data' => $data !== null
        ),
        'INFO'
    );

    $host = getApiHost();
    $url = $host . $endpoint;

    // Get JWT token
    $token = getAuthToken($staff_id);
    if (!$token) {
        logJWTOperation(
            'getApiDataWithJWT',
            'Authentication failed - no token',
            array('endpoint' => $endpoint, 'staff_id' => $staff_id),
            'ERROR'
        );

        return array(
            'success' => false,
            'error' => 'Authentication failed - could not get JWT token',
            'response' => json_encode(array('error' => 'Authentication failed')),
            'httpCode' => 401
        );
    }

    $method = strtoupper($method);

    $headers = array(
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
        'Content-Type: application/json'
    );

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    if ($method === 'GET') {
        curl_setopt($ch, CURLOPT_URL, $url);
    } elseif ($method === 'POST') {
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    } elseif ($method === 'PUT') {
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    } elseif ($method === 'PATCH') {
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    } elseif ($method === 'DELETE') {
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    }

    // Log the outgoing request
    logJWTOperation(
        'getApiDataWithJWT',
        'Sending request to API',
        array(
            'url' => $url,
            'method' => $method,
            'data' => $data
        ),
        'INFO'
    );

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    // Use a separate variable so the original $headers array is not overwritten
    $sentHeaders = curl_getinfo($ch, CURLINFO_HEADER_OUT);

    // If unauthorized, clear token and retry once
    if ($httpCode === 401 && isset($_SESSION['jwt_token'])) {
        unset($_SESSION['jwt_token']);
        unset($_SESSION['jwt_expires']);

        // Get new token and retry
        $token = getAuthToken($staff_id);
        if ($token) {
            $headers[0] = 'Authorization: Bearer ' . $token; // Update Authorization in request headers array
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
        }
    }

    curl_close($ch);

    // Handle HTTP status codes according to API documentation
    if ($response === false) {
        return array(
            'success' => false,
            'error' => 'API Request Failed',
            'message' => 'cURL error: ' . $error,
            'response' => json_encode(array('error' => 'No response')),
            'httpCode' => 0
        );
    }

    // Success codes: 200, 201, 204
    if ($httpCode === 200 || $httpCode === 201 || $httpCode === 204) {
        logJWTOperation(
            'getApiDataWithJWT',
            'API call successful',
            array(
                'endpoint' => $endpoint,
                'httpCode' => $httpCode,
                'response_length' => strlen($response)
            ),
            'INFO'
        );

        return array(
            'success' => true,
            'response' => $response,
            'httpCode' => $httpCode,
            'headers' => $sentHeaders
        );
    }

    // Handle error codes according to API documentation
    $decodedError = json_decode($response, true);
    $errorMessage = isset($decodedError['message']) ? $decodedError['message'] : 'API Request Failed';

    logJWTOperation(
        'getApiDataWithJWT',
        'API call failed',
        array(
            'endpoint' => $endpoint,
            'httpCode' => $httpCode,
            'message' => $errorMessage,
            'response' => $response
        ),
        'ERROR'
    );

    return array(
        'success' => false,
        'error' => $errorMessage,
        'message' => $errorMessage,
        'response' => $response,
        'httpCode' => $httpCode,
        'details' => $decodedError
    );
}

/**
 * Verify JWT token
 * @param string $token JWT token to verify
 * @return array Verification result
 */
function verifyToken($token)
{
    $host = getApiHost();
    $url = $host . 'auth/verify';

    $data = array(
        'token' => $token
    );

    $headers = array(
        'Accept: application/json',
        'Content-Type: application/json'
    );

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return array(
            'success' => false,
            'message' => 'cURL error: ' . $error
        );
    }

    $decoded = json_decode($response, true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'valid' => $decoded['valid'],
            'message' => $decoded['message'],
            'payload' => isset($decoded['payload']) ? $decoded['payload'] : null
        );
    } else {
        return array(
            'success' => false,
            'valid' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Token verification failed'
        );
    }
}

/**
 * Get all consult calls with optional filters
 * @param int $staff_id Staff ID for authentication
 * @param array $params Optional filter parameters
 * @return array Consult calls data with pagination
 */
function getAllConsultCall($staff_id, $params = array())
{
    $endpoint = '';
    if (!empty($params)) {
        $endpoint = '?' . http_build_query($params);
    }

    $result = getApiDataWithJWT($endpoint, null, 'GET', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : $decoded
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to retrieve consult calls'
        );
    }
}

/**
 * Get a single consult call by ID
 * @param int $id Consult call ID
 * @param int $staff_id Staff ID for authentication
 * @return array Consult call data
 */
function getConsultCall($id, $staff_id)
{
    $result = getApiDataWithJWT($id, null, 'GET', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : $decoded
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to retrieve consult call'
        );
    }
}

/**
 * Get consult call summary
 * @param int $staff_id Staff ID for authentication
 * @return array Summary data
 */
function getConsultCallSummary($staff_id)
{
    $result = getApiDataWithJWT('summary', null, 'GET', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : $decoded
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to retrieve summary'
        );
    }
}

/**
 * Create a new consult call
 * @param array $data Consult call data
 * @param int $staff_id Staff ID for authentication
 * @return array Creation result
 */
function createConsultCall($data, $staff_id)
{
    $result = getApiDataWithJWT('', $data, 'POST', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200 || $httpCode == 201) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : null,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Consult call created successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to create consult call',
            'errors' => isset($decoded['data']) ? $decoded['data'] : null
        );
    }
}

/**
 * Update an existing consult call
 * @param int $id Consult call ID
 * @param array $data Updated consult call data
 * @param int $staff_id Staff ID for authentication
 * @return array Update result
 */
function updateConsultCall($id, $data, $staff_id)
{
    $result = getApiDataWithJWT($id, $data, 'PUT', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : null,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Consult call updated successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to update consult call',
            'errors' => isset($decoded['data']) ? $decoded['data'] : null
        );
    }
}

/**
 * Delete a consult call
 * @param int $id Consult call ID
 * @param int $staff_id Staff ID for authentication
 * @return array Deletion result
 */
function deleteConsultCall($id, $staff_id)
{
    $result = getApiDataWithJWT($id, null, 'DELETE', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200 || $httpCode == 204) {
        return array(
            'success' => true,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Consult call deleted successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to delete consult call'
        );
    }
}

/**
 * Create a consult call detail
 * @param int $consult_call_id Consult call ID
 * @param array $data Detail data
 * @param int $staff_id Staff ID for authentication
 * @return array Creation result
 */
function createConsultCallDetail($consult_call_id, $data, $staff_id)
{
    $result = getApiDataWithJWT($consult_call_id . '/details', $data, 'POST', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200 || $httpCode == 201) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : null,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Detail created successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to create detail',
            'errors' => isset($decoded['data']) ? $decoded['data'] : null
        );
    }
}

/**
 * Update a consult call detail
 * @param int $consult_call_id Consult call ID
 * @param int $detail_id Detail ID
 * @param array $data Updated detail data
 * @param int $staff_id Staff ID for authentication
 * @return array Update result
 */
function updateConsultCallDetail($consult_call_id, $detail_id, $data, $staff_id)
{
    $result = getApiDataWithJWT($consult_call_id . '/details/' . $detail_id, $data, 'PUT', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : null,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Detail updated successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to update detail',
            'errors' => isset($decoded['data']) ? $decoded['data'] : null
        );
    }
}

/**
 * Delete a consult call detail
 * @param int $consult_call_id Consult call ID
 * @param int $detail_id Detail ID
 * @param int $staff_id Staff ID for authentication
 * @return array Deletion result
 */
function deleteConsultCallDetail($consult_call_id, $detail_id, $staff_id)
{
    $result = getApiDataWithJWT($consult_call_id . '/details/' . $detail_id, null, 'DELETE', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200 || $httpCode == 204) {
        return array(
            'success' => true,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Detail deleted successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to delete detail'
        );
    }
}

/**
 * Create a consult call follow-up
 * @param int $consult_call_id Consult call ID
 * @param array $data Follow-up data
 * @param int $staff_id Staff ID for authentication
 * @return array Creation result
 */
function createConsultCallFollowUp($consult_call_id, $data, $staff_id)
{
    $result = getApiDataWithJWT($consult_call_id . '/follow-up', $data, 'POST', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200 || $httpCode == 201) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : null,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Follow-up created successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to create follow-up',
            'errors' => isset($decoded['data']) ? $decoded['data'] : null
        );
    }
}

/**
 * Update a consult call follow-up
 * @param int $consult_call_id Consult call ID
 * @param int $follow_up_id Follow-up ID
 * @param array $data Updated follow-up data
 * @param int $staff_id Staff ID for authentication
 * @return array Update result
 */
function updateConsultCallFollowUp($consult_call_id, $follow_up_id, $data, $staff_id)
{
    $result = getApiDataWithJWT($consult_call_id . '/follow-up/' . $follow_up_id, $data, 'PUT', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : null,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Follow-up updated successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to update follow-up',
            'errors' => isset($decoded['data']) ? $decoded['data'] : null
        );
    }
}

/**
 * Link a MyReferral record to a consult call follow-up.
 * Stores referral_to (outlet ID) and my_referral_id on the follow-up record.
 * @param int $consult_call_id Consult call ID
 * @param int $follow_up_id Follow-up ID
 * @param array $data Must contain my_referral_id; optionally referral_to
 * @param int $staff_id Staff ID for authentication
 * @return array Result
 */
function linkConsultCallReferral($consult_call_id, $follow_up_id, $data, $staff_id)
{
    $endpoint = $consult_call_id . '/follow-up/' . $follow_up_id . '/link-referral';
    $result = getApiDataWithJWT($endpoint, $data, 'PATCH', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data'    => isset($decoded['data']) ? $decoded['data'] : null,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Referral linked successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to link referral',
            'errors'  => isset($decoded['data']) ? $decoded['data'] : null
        );
    }
}

/**
 * Delete a consult call follow-up
 * @param int $consult_call_id Consult call ID
 * @param int $follow_up_id Follow-up ID
 * @param int $staff_id Staff ID for authentication
 * @return array Deletion result
 */
function deleteConsultCallFollowUp($consult_call_id, $follow_up_id, $staff_id)
{
    $result = getApiDataWithJWT($consult_call_id . '/follow-up/' . $follow_up_id, null, 'DELETE', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200 || $httpCode == 204) {
        return array(
            'success' => true,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Follow-up deleted successfully'
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to delete follow-up'
        );
    }
}

/**
 * Get status library by type
 * @param string $type Status type (e.g., 'enrollment-types', 'consent-call-statuses')
 * @param int $staff_id Staff ID for authentication
 * @return array Status library data
 */
function getStatusLibrary($type, $staff_id)
{
    $result = getApiDataWithJWT('statuses/' . $type, null, 'GET', $staff_id);
    $httpCode = $result['httpCode'];
    $decoded = json_decode($result['response'], true);

    if ($httpCode == 200) {
        return array(
            'success' => true,
            'data' => isset($decoded['data']) ? $decoded['data'] : $decoded
        );
    } else {
        return array(
            'success' => false,
            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to retrieve status library'
        );
    }
}

/**
 * Get a single customer from ODB customer table by ID
 * @param int $customer_id Customer ID
 * @return array Customer data or error
 */
function getCustomerById($customer_id)
{
    global $conn;

    if (!$customer_id) {
        return array('success' => false, 'message' => 'Missing customer ID');
    }

    $customer_id = (int)$customer_id;
    $query = "SELECT id, customer_name, ic, gender, birth_date, phone, email, c_addr FROM customer WHERE id = $customer_id";
    $result = mysqli_query($conn, $query);

    if (!$result || mysqli_num_rows($result) == 0) {
        return array('success' => false, 'message' => 'Customer not found');
    }

    $row = mysqli_fetch_assoc($result);

    $age = null;
    if ($row['birth_date'] && $row['birth_date'] !== '0000-00-00') {
        $birthDate = new DateTime($row['birth_date']);
        $today = new DateTime();
        $age = $today->diff($birthDate)->y;
    }

    return array(
        'success' => true,
        'data' => array(
            'id' => $row['id'],
            'name' => $row['customer_name'],
            'ic' => $row['ic'],
            'gender' => $row['gender'],
            'birth_date' => $row['birth_date'],
            'age' => $age,
            'phone' => $row['phone'],
            'email' => $row['email'],
            'address' => $row['c_addr']
        )
    );
}

/**
 * Get multiple customers from ODB customer table by IDs (batch)
 * @param array $customer_ids Array of customer IDs
 * @return array Customers keyed by ID
 */
function getCustomersByIds($customer_ids)
{
    global $conn;

    if (empty($customer_ids)) {
        return array('success' => true, 'data' => array());
    }

    $ids = array_map('intval', $customer_ids);
    $ids = array_filter($ids);

    if (empty($ids)) {
        return array('success' => true, 'data' => array());
    }

    $ids_str = implode(',', $ids);
    $query = "SELECT id, customer_name, ic, gender, birth_date, phone, email, c_addr FROM customer WHERE id IN ($ids_str)";
    $result = mysqli_query($conn, $query);

    if (!$result) {
        return array('success' => false, 'message' => 'Database error: ' . mysqli_error($conn));
    }

    $customers = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $age = null;
        if ($row['birth_date'] && $row['birth_date'] !== '0000-00-00') {
            $birthDate = new DateTime($row['birth_date']);
            $today = new DateTime();
            $age = $today->diff($birthDate)->y;
        }

        $customers[$row['id']] = array(
            'id' => $row['id'],
            'name' => $row['customer_name'],
            'ic' => $row['ic'],
            'gender' => $row['gender'],
            'birth_date' => $row['birth_date'],
            'age' => $age,
            'phone' => $row['phone'],
            'email' => $row['email'],
            'address' => $row['c_addr']
        );
    }

    return array('success' => true, 'data' => $customers);
}

/**
 * Fetch staff names for a list of staff IDs from the ODB staff table.
 * @param array $staff_ids Array of staff IDs (integers)
 * @return array Standard response with data keyed by staff ID
 */
function getStaffByIds($staff_ids)
{
    global $conn;

    if (empty($staff_ids)) {
        return array('success' => true, 'data' => array());
    }

    $ids = array_map('intval', $staff_ids);
    $ids = array_filter($ids);

    if (empty($ids)) {
        return array('success' => true, 'data' => array());
    }

    $ids_str = implode(',', $ids);
    $query = "SELECT id, nama_staff FROM staff WHERE id IN ($ids_str)";
    $result = mysqli_query($conn, $query);

    if (!$result) {
        return array('success' => false, 'message' => 'Database error: ' . mysqli_error($conn));
    }

    $staff = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $staff[$row['id']] = array(
            'id'   => (int)$row['id'],
            'name' => $row['nama_staff']
        );
    }

    return array('success' => true, 'data' => $staff);
}

/**
 * Fetch outlet code and name for a list of outlet IDs from the ODB outlet table.
 * @param array $outlet_ids Array of outlet IDs (integers)
 * @return array Standard response with data keyed by outlet ID
 */
function getOutletsByIds($outlet_ids)
{
    global $conn;

    if (empty($outlet_ids)) {
        return array('success' => true, 'data' => array());
    }

    $ids = array_map('intval', $outlet_ids);
    $ids = array_filter($ids);

    if (empty($ids)) {
        return array('success' => true, 'data' => array());
    }

    $ids_str = implode(',', $ids);
    $query = "SELECT id, code, comp_name FROM outlet WHERE id IN ($ids_str)";
    $result = mysqli_query($conn, $query);

    if (!$result) {
        return array('success' => false, 'message' => 'Database error: ' . mysqli_error($conn));
    }

    $outlets = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $outlets[$row['id']] = array(
            'id'        => (int)$row['id'],
            'code'      => $row['code'],
            'comp_name' => $row['comp_name']
        );
    }

    return array('success' => true, 'data' => $outlets);
}

// Only run request handler if this file is accessed directly (not included)
if (!defined('API_JWT_INCLUDED')) {
    // Check if we have a staff ID for authentication
    if (!$staff_id) {
        echo json_encode(array(
            'success' => false,
            'error' => 'No staff ID available for authentication',
            'message' => 'Staff ID is required for JWT authentication. Please ensure you are logged in.',
            'debug' => array(
                'session_username' => isset($_SESSION["myusername"]) ? $_SESSION["myusername"] : 'not set',
                'staff_id' => $staff_id
            )
        ));
        exit;
    }

    // Main request handler
    $input = file_get_contents('php://input');
    $jsonData = json_decode($input, true);
    $response = array('success' => false, 'message' => 'Invalid request');

    // Check for action in query parameter or JSON body
    $action = isset($_GET['action']) ? $_GET['action'] : (isset($jsonData['action']) ? $jsonData['action'] : null);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($action) {
            switch ($action) {
                case 'verify-token':
                    if (isset($jsonData['token'])) {
                        $response = verifyToken($jsonData['token']);
                    }
                    break;
                case 'verify-session':
                    if (isset($_SESSION['jwt_token'])) {
                        $response = verifyToken($_SESSION['jwt_token']);
                    } else {
                        $response = array(
                            'success' => false,
                            'valid' => false,
                            'message' => 'No JWT token found in session'
                        );
                    }
                    break;
                case 'get-auth-token':
                    $token = getAuthToken($staff_id);
                    if ($token) {
                        $response = array(
                            'success' => true,
                            'message' => 'JWT token retrieved successfully',
                            'token' => $token,
                            'staff_id' => $staff_id,
                            'expires_at' => isset($_SESSION['jwt_expires']) ? date('Y-m-d H:i:s', $_SESSION['jwt_expires']) : 'Unknown'
                        );
                    } else {
                        $response = array(
                            'success' => false,
                            'message' => 'Failed to get JWT token',
                            'staff_id' => $staff_id
                        );
                    }
                    break;

                case 'all-consult-call':
                    $params = array();
                    $allowedParams = array(
                        'id', 'patient_id', 'consent_call_status', 'scheduled_status',
                        'date_from', 'date_to', 'search', 'enrollment_type',
                        'process_status', 'followup_reminder', 'scheduled_from',
                        'scheduled_to', 'consulted_by', 'per_page', 'page', 'draft_status'
                    );
                    foreach ($allowedParams as $param) {
                        if (isset($jsonData[$param]) && $jsonData[$param] !== '') {
                            $params[$param] = $jsonData[$param];
                        }
                    }
                    // detail_action avoids collision with the 'action' dispatch key in the request body
                    if (isset($jsonData['detail_action']) && $jsonData['detail_action'] !== '') {
                        $params['action'] = $jsonData['detail_action'];
                    }
                    $response = getAllConsultCall($staff_id, $params);
                    break;

                case 'get-consult-call':
                    if (isset($jsonData['id'])) {
                        $response = getConsultCall($jsonData['id'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID');
                    }
                    break;

                case 'get-summary':
                    $response = getConsultCallSummary($staff_id);
                    break;

                case 'create-consult-call':
                    if (isset($jsonData['data'])) {
                        $response = createConsultCall($jsonData['data'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call data');
                    }
                    break;

                case 'update-consult-call':
                    if (isset($jsonData['id']) && isset($jsonData['data'])) {
                        $response = updateConsultCall($jsonData['id'], $jsonData['data'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID or data');
                    }
                    break;

                case 'delete-consult-call':
                    if (isset($jsonData['id'])) {
                        $response = deleteConsultCall($jsonData['id'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID');
                    }
                    break;

                case 'create-detail':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['data'])) {
                        $response = createConsultCallDetail($jsonData['consult_call_id'], $jsonData['data'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID or detail data');
                    }
                    break;

                case 'update-detail':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['detail_id']) && isset($jsonData['data'])) {
                        $response = updateConsultCallDetail($jsonData['consult_call_id'], $jsonData['detail_id'], $jsonData['data'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID, detail ID, or data');
                    }
                    break;

                case 'delete-detail':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['detail_id'])) {
                        $response = deleteConsultCallDetail($jsonData['consult_call_id'], $jsonData['detail_id'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID or detail ID');
                    }
                    break;

                case 'create-follow-up':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['data'])) {
                        $response = createConsultCallFollowUp($jsonData['consult_call_id'], $jsonData['data'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID or follow-up data');
                    }
                    break;

                case 'update-follow-up':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['follow_up_id']) && isset($jsonData['data'])) {
                        $response = updateConsultCallFollowUp($jsonData['consult_call_id'], $jsonData['follow_up_id'], $jsonData['data'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID, follow-up ID, or data');
                    }
                    break;

                case 'link-referral':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['follow_up_id']) && isset($jsonData['data'])) {
                        $response = linkConsultCallReferral($jsonData['consult_call_id'], $jsonData['follow_up_id'], $jsonData['data'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult_call_id, follow_up_id, or data');
                    }
                    break;

                case 'link-referral-by-call':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['my_referral_id'])) {
                        $ccId      = (int)$jsonData['consult_call_id'];
                        $data      = array('my_referral_id' => (int)$jsonData['my_referral_id']);
                        if (isset($jsonData['referral_to']) && (int)$jsonData['referral_to'] > 0) {
                            $data['referral_to'] = (int)$jsonData['referral_to'];
                        }
                        $endpoint  = $ccId . '/link-referral-by-call';
                        $result    = getApiDataWithJWT($endpoint, $data, 'PATCH', $staff_id);
                        $decoded   = json_decode($result['response'], true);
                        $response  = array(
                            'success' => $result['httpCode'] == 200,
                            'message' => isset($decoded['message']) ? $decoded['message'] : 'Request completed',
                            'data'    => isset($decoded['data']) ? $decoded['data'] : null
                        );
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult_call_id or my_referral_id');
                    }
                    break;

                case 'delete-follow-up':
                    if (isset($jsonData['consult_call_id']) && isset($jsonData['follow_up_id'])) {
                        $response = deleteConsultCallFollowUp($jsonData['consult_call_id'], $jsonData['follow_up_id'], $staff_id);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing consult call ID or follow-up ID');
                    }
                    break;

                case 'get-customer':
                    if (isset($jsonData['customer_id'])) {
                        $response = getCustomerById($jsonData['customer_id']);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing customer_id');
                    }
                    break;

                case 'get-customers':
                    if (isset($jsonData['customer_ids']) && is_array($jsonData['customer_ids'])) {
                        $response = getCustomersByIds($jsonData['customer_ids']);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing or invalid customer_ids array');
                    }
                    break;

                case 'get-outlets':
                    if (isset($jsonData['outlet_ids']) && is_array($jsonData['outlet_ids'])) {
                        $response = getOutletsByIds($jsonData['outlet_ids']);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing or invalid outlet_ids array');
                    }
                    break;

                case 'get-staff':
                    if (isset($jsonData['staff_ids']) && is_array($jsonData['staff_ids'])) {
                        $response = getStaffByIds($jsonData['staff_ids']);
                    } else {
                        $response = array('success' => false, 'message' => 'Missing or invalid staff_ids array');
                    }
                    break;

                case 'get-pdf':
                    $consultCallId = isset($jsonData['consult_call_id']) ? intval($jsonData['consult_call_id']) : 0;
                    if (!$consultCallId) {
                        $response = array('success' => false, 'message' => 'consult_call_id is required.');
                        break;
                    }
                    $pdfEndpoint = $consultCallId . '/pdf';
                    if (isset($jsonData['test_result_id']) && intval($jsonData['test_result_id']) > 0) {
                        $pdfEndpoint .= '?test_result_id=' . intval($jsonData['test_result_id']);
                    }
                    $apiResult = getApiDataWithJWT($pdfEndpoint, null, 'GET', $staff_id);
                    if ($apiResult['success']) {
                        $decoded = json_decode($apiResult['response'], true);
                        $response = array(
                            'success' => true,
                            'data' => $decoded
                        );
                    } else {
                        $decoded = json_decode($apiResult['response'], true);
                        $response = array(
                            'success' => false,
                            'message' => isset($decoded['message']) ? $decoded['message'] : 'Failed to generate PDF'
                        );
                    }
                    break;

                case 'get-statuses':
                    $allowedTypes = array(
                        'enrollment-types', 'consent-call-statuses', 'scheduled-statuses',
                        'modes-of-consultation', 'actions', 'consult-statuses',
                        'process-statuses', 'follow-up-types', 'next-follow-ups',
                        'referral-statuses', 'follow-up-reminders'
                    );
                    if (isset($jsonData['type']) && in_array($jsonData['type'], $allowedTypes)) {
                        $response = getStatusLibrary($jsonData['type'], $staff_id);
                    } else {
                        $response = array(
                            'success' => false,
                            'message' => 'Missing or invalid status type. Allowed: ' . implode(', ', $allowedTypes)
                        );
                    }
                    break;
            }
            echo json_encode($response);
        }
    } else {
        echo json_encode($response);
    }
} // End of direct access check
