<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>400 Bad Request &bull; {{ config('app.name', 'Stellar Panel') }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: #050505;
            color: #EDEDED;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .card {
            width: 100%;
            max-width: 480px;
            background: #0A0A0A;
            border: 1px solid #1F1F1F;
            border-radius: 16px;
            padding: 28px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 600;
            color: #F59E0B;
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.25);
            padding: 4px 10px;
            border-radius: 6px;
            margin-bottom: 14px;
        }
        h1 {
            font-size: 18px;
            font-weight: 600;
            color: #FFFFFF;
            margin-bottom: 8px;
        }
        p {
            font-size: 13px;
            line-height: 1.6;
            color: #A0A0A0;
            margin-bottom: 18px;
        }
        .detail {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11.5px;
            background: #111111;
            border: 1px solid #1F1F1F;
            border-radius: 8px;
            padding: 12px;
            color: #EDEDED;
            margin-bottom: 20px;
            word-break: break-word;
        }
        .actions {
            display: flex;
            gap: 10px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 9px 16px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.15s ease;
        }
        .btn-primary {
            background: #1F1F1F;
            color: #FFFFFF;
            border: 1px solid #2E2E2E;
        }
        .btn-primary:hover {
            background: #2A2A2A;
        }
        .btn-secondary {
            background: transparent;
            color: #8A8A8A;
            border: 1px solid #1F1F1F;
        }
        .btn-secondary:hover {
            color: #FFFFFF;
            border-color: #383838;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">● HTTP 400 BAD REQUEST</div>
        <h1>Request Validation Notice</h1>
        <p>The server could not process the incoming request parameters.</p>
        @if(isset($exception) && $exception->getMessage())
            <div class="detail">{{ $exception->getMessage() }}</div>
        @endif
        <div class="actions">
            <a href="/" class="btn btn-primary">&larr; Return to Dashboard</a>
            <a href="/admin/oauth/apps" class="btn btn-secondary">OAuth 2.0 Settings</a>
        </div>
    </div>
</body>
</html>
