# ════════════════════════════════════════════════════════════════
# Деплой web-проекта на VPS — запуск с Windows.
# ════════════════════════════════════════════════════════════════
# Использование:
#   PowerShell в корне проекта:
#     .\deploy\web\deploy.ps1
#
# Что делает:
#   1. Архивирует проект (без node_modules, .next, .git, .env)
#   2. scp на VPS в /tmp/messanger.tar
#   3. На VPS: распаковка поверх /opt/messanger + bash deploy.sh
#
# При первом запуске может понадобиться разрешить выполнение скриптов:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# ════════════════════════════════════════════════════════════════

param(
    [string]$Server = "root@194.87.201.226",
    [string]$RemotePath = "/opt/messanger"
)

$ErrorActionPreference = "Stop"

# Корень проекта = на 2 уровня выше этого скрипта
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$archive = "$env:TEMP\messanger_$ts.tar"

Write-Host ">>> Архивирую $projectRoot → $archive" -ForegroundColor Cyan
tar -cf $archive `
    --exclude=node_modules `
    --exclude=.next `
    --exclude=.git `
    --exclude=.env `
    --exclude=*.tar `
    --exclude=build `
    *

if (-not (Test-Path $archive)) {
    Write-Host "[!] Архив не создался" -ForegroundColor Red
    exit 1
}
$size = (Get-Item $archive).Length / 1MB
Write-Host (">>> Размер архива: {0:N1} MB" -f $size) -ForegroundColor Cyan

Write-Host ">>> Заливаю на $Server" -ForegroundColor Cyan
scp $archive "$Server`:/tmp/messanger.tar"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] scp упал" -ForegroundColor Red
    Remove-Item $archive
    exit 1
}
Remove-Item $archive

Write-Host ">>> Распаковка + deploy.sh на VPS (займёт 3-7 минут)" -ForegroundColor Cyan
ssh $Server "tar -xf /tmp/messanger.tar -C $RemotePath && rm /tmp/messanger.tar && cd $RemotePath && bash deploy/web/deploy.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Что-то пошло не так на VPS — см. вывод выше" -ForegroundColor Red
    exit 1
}

Write-Host ">>> Готово! Проверьте: http://194.87.201.226" -ForegroundColor Green
