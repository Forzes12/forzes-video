$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$files = @(
  'c:\Users\Forzes\Desktop\forzes-video-main\_gate_test_sec.html',
  'c:\Users\Forzes\Desktop\forzes-video-main\_gate_pub\index.html'
)
$report = Join-Path $env:TEMP 'gt_report.txt'
if (Test-Path $report) { Remove-Item $report -Force }
$prof = Join-Path $env:TEMP 'gt_profile'
$i = 0
foreach ($f in $files) {
  $i++
  $out = Join-Path $env:TEMP ('gt_' + $i + '.html')
  if (Test-Path $out) { Remove-Item $out -Force }
  $uri = 'file:///' + $f.Replace([string][char]92, '/')
  $args = @(
    '--headless=new', '--disable-gpu', '--no-sandbox',
    ('--user-data-dir=' + $prof + $i),
    '--virtual-time-budget=4000', '--dump-dom', $uri
  )
  $p = Start-Process -FilePath $chrome -ArgumentList $args -RedirectStandardOutput $out -RedirectStandardError (Join-Path $env:TEMP ('gt_err_' + $i + '.txt')) -PassThru -NoNewWindow
  $p.WaitForExit()
  Start-Sleep -Seconds 1\
  $d = Get-Content $out -Raw -ErrorAction SilentlyContinue
  $line = (Split-Path $f -Leaf)
  if ($d -and $d -match '<title>([^<]+)</title>') {
    $line += ' => ' + $Matches[1]
  } else {
    $line += ' => NO TITLE / len=' + $d.Length
    $err = Get-Content (Join-Path $env:TEMP ('gt_err_' + $i + '.txt')) -Raw -ErrorAction SilentlyContinue
    if ($err) { $line += ' ERR=' + $err.Substring(0, [Math]::Min(300, $err.Length)) }
  }
  Add-Content -Path $report -Value $line
}
Get-Content $report

