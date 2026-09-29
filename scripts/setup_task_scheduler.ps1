# Windows 작업 스케줄러에 1시간마다 항공권 크롤링 자동 등록 스크립트
$TaskName = "FlightPromo_HourlyCrawler"
$ProjectDir = (Get-Item $PSScriptRoot).Parent.FullName
$RunnerScript = Join-Path $ProjectDir "crawler\runner.py"

# Python 실행 경로 찾기
$PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    Write-Error "Python이 PATH에 등록되어 있지 않습니다. Python 경로를 확인해주세요."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "✈️ 항공권 특가 1시간 주기 자동 크롤러 등록 마법사" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "프로젝트 경로: $ProjectDir"
Write-Host "파이썬 경로: $PythonExe"
Write-Host "실행 대상: $RunnerScript"
Write-Host ""

# 기존 작업이 있다면 제거
$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing) {
    Write-Host "기존 작업 스케줄러 태스크($TaskName)를 갱신합니다..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# 작업 동작 정의 (백그라운드에서 python runner.py 실행)
$Action = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$RunnerScript`"" -WorkingDirectory $ProjectDir

# 1시간 간격 트리거 정의 (매일 시작, 1시간마다 반복, 무한 지속)
$Trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
$Trigger.RepetitionInterval = (New-TimeSpan -Hours 1)
$Trigger.RepetitionDuration = (New-TimeSpan -Days 9999)

# 설정 정의 (전원 연결 여부 무관 실행, 백그라운드 우선순위)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

# 작업 등록
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "JapanFlight 항공권 프로모션 및 뉴스 1시간 주기 자동 수집"

Write-Host ""
Write-Host "🎉 성공적으로 Windows 작업 스케줄러에 등록되었습니다!" -ForegroundColor Green
Write-Host "작업 이름: $TaskName"
Write-Host "실행 주기: 매 1시간마다 자동 실행"
Write-Host "해제 방법: scripts\remove_task_scheduler.ps1 실행" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
