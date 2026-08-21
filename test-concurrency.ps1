$jobs = 20..39 | ForEach-Object {
    $i = $_

    Start-Job -ScriptBlock {
        param($i)

        $body = @"
{
  "eventId": 1,
  "qty": 1,
  "seatCodes": ["FL1-002"],
  "email": "concurrent-$i@example.com",
  "buyerName": "Concurrent User $i"
}
"@

        curl.exe -s -o "response-$i.json" -w "%{http_code}" `
          -X POST http://localhost:8080/orders `
          -H "Content-Type: application/json" `
          --data-binary $body

    } -ArgumentList $i
}

$jobs | Wait-Job | Out-Null

$results = $jobs | Receive-Job

$jobs | Remove-Job

$results