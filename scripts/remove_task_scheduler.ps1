# Windows 작업 스케줄러 등록 해제 스크립트
$TaskName = "FlightPromo_HourlyCrawler"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "✈️ 항공권 특가 자동 크롤러 작업 스케줄러 등록 해제" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "✅ 작업 스케줄러($TaskName)가 성공적으로 삭제되었습니다." -ForegroundColor Green
} else {
    Write-Host "ℹ️ 등록된 작업 스케줄러($TaskName)를 찾을 수 없습니다." -ForegroundColor Yellow
}
