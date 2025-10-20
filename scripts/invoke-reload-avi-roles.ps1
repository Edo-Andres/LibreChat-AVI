# Script PowerShell para invocar reload-avi-roles.sh dentro del contenedor
# Uso desde Windows (PowerShell):
#   .\scripts\invoke-reload-avi-roles.ps1              # Modo automático
#   .\scripts\invoke-reload-avi-roles.ps1 -Interactive # Modo interactivo

param(
    [switch]$Interactive
)

$ContainerName = "LibreChat-API"
$ScriptPath = "/app/scripts/reload-avi-roles.sh"

Write-Host "🔄 Ejecutando recarga de AVI Roles en contenedor $ContainerName..." -ForegroundColor Cyan

# Verificar que Docker está disponible
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Docker no está disponible en PATH" -ForegroundColor Red
    exit 1
}

# Verificar que el contenedor existe y está corriendo
$containerStatus = docker ps --filter "name=$ContainerName" --format "{{.Status}}" 2>$null
if (-not $containerStatus) {
    Write-Host "❌ Error: Contenedor '$ContainerName' no está corriendo" -ForegroundColor Red
    Write-Host "   Inicie el contenedor con: docker-compose -f deploy-compose.yml up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Contenedor '$ContainerName' está corriendo" -ForegroundColor Green

# Construir comando
$dockerArgs = @("exec")

if ($Interactive) {
    Write-Host "📝 Modo interactivo habilitado" -ForegroundColor Yellow
    $dockerArgs += "-it"
    $dockerArgs += $ContainerName
    $dockerArgs += $ScriptPath
    $dockerArgs += "--interactive"
} else {
    Write-Host "🤖 Modo automático" -ForegroundColor Yellow
    $dockerArgs += $ContainerName
    $dockerArgs += $ScriptPath
}

# Ejecutar comando
Write-Host ""
Write-Host "Ejecutando: docker $($dockerArgs -join ' ')" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

& docker $dockerArgs

$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Gray

if ($exitCode -eq 0) {
    Write-Host "✅ Recarga completada exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ Recarga falló con código de salida: $exitCode" -ForegroundColor Red
}

exit $exitCode
